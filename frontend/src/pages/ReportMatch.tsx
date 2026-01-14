import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { matchService, userService, api } from '../services/api';
import { parseReplayFile, getOpponentFromReplay, getMapFromReplay, getPlayerFactionFromReplay } from '../services/replayParser';
import MainLayout from '../components/MainLayout';
import OpponentSelector from '../components/OpponentSelector';
import FileUploadInput from '../components/FileUploadInput';
// TEMP DEBUG: Commented out CSS to test if it breaks global CSS
// import '../styles/ReportMatch.css';

interface GameMap {
  id: string;
  name: string;
}

interface Faction {
  id: string;
  name: string;
}

const ReportMatch: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  console.log('🔍 DEBUG: ReportMatch component LOADED');
  console.log('🔍 DEBUG: CSS imported:', '../styles/ReportMatch.css');
  
  const [users, setUsers] = useState<any[]>([]);
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    opponent_id: '',
    map: '',
    winner_faction: '',
    loser_faction: '',
    comments: '',
    rating: '',
    replay: null as File | null,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        // Load maps, factions and users from API
        const [mapsResponse, factionsResponse, usersResponse] = await Promise.all([
          api.get('/public/maps'),
          api.get('/public/factions'),
          userService.getAllUsers(),
        ]);
        setMaps(mapsResponse.data || []);
        setFactions(factionsResponse.data || []);
        setUsers((usersResponse as any)?.data?.data || (usersResponse as any)?.data || []);
        
        if ((!mapsResponse.data || mapsResponse.data.length === 0) || 
            (!factionsResponse.data || factionsResponse.data.length === 0)) {
          setError('No maps or factions available. Please contact an administrator.');
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load maps and factions. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, navigate]);

  const handleReplayFileChange = async (file: File | null) => {
    setFormData((prev) => ({
      ...prev,
      replay: file,
    }));

    if (!file) return;

    try {
      setError('');
      const replayData = await parseReplayFile(file);
      console.log('Parsed replay data:', replayData);

      // Get profile to know current player name
      try {
        const profileRes = await userService.getProfile();
        const currentPlayerName = profileRes.data?.nickname;
        console.log('Current player:', currentPlayerName);

        // Autocomplete map (always load if found)
        if (replayData.map) {
          const matchingMap = maps.find((m) =>
            m.name.toLowerCase() === replayData.map?.toLowerCase()
          );
          if (matchingMap) {
            setFormData((prev) => ({
              ...prev,
              map: matchingMap.name,
            }));
            console.log('Set map to:', matchingMap.name);
          }
        }

        // Autocomplete factions first (always load if found, independent of opponent)
        const playerFaction = getPlayerFactionFromReplay(replayData, currentPlayerName);
        if (playerFaction) {
          const matchingFaction = factions.find(
            (f) => f.name.toLowerCase() === playerFaction.toLowerCase()
          );
          if (matchingFaction) {
            setFormData((prev) => ({
              ...prev,
              winner_faction: matchingFaction.name,
            }));
            console.log('Set winner faction to:', matchingFaction.name);
          }
        }

        // Autocomplete opponent from replay
        const opponent = getOpponentFromReplay(replayData, currentPlayerName);
        let opponentFound = false;
        if (opponent) {
          // Find opponent in users list by nickname
          const opponentUser = users.find(
            (u) => u.nickname.toLowerCase() === opponent.name.toLowerCase()
          );
          if (opponentUser) {
            setFormData((prev) => ({
              ...prev,
              opponent_id: opponentUser.id,
            }));
            console.log('Set opponent to:', opponentUser.nickname);
            opponentFound = true;
          } else {
            console.warn(`Opponent "${opponent.name}" not found in users list`);
            setError(`Opponent "${opponent.name}" is not registered. Please select manually.`);
          }

          // Load opponent faction regardless of whether user is registered
          const opponentFaction = opponent?.faction;
          if (opponentFaction) {
            const matchingFaction = factions.find(
              (f) => f.name.toLowerCase() === opponentFaction.toLowerCase()
            );
            if (matchingFaction) {
              setFormData((prev) => ({
                ...prev,
                loser_faction: matchingFaction.name,
              }));
              console.log('Set loser faction to:', matchingFaction.name);
            }
          }
        }
      } catch (profileErr) {
        console.error('Error fetching profile:', profileErr);
      }
    } catch (err: any) {
      setError(`Replay parsing error: ${err.message}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.opponent_id || !formData.map || !formData.winner_faction || !formData.loser_faction) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const data = new FormData();
      data.append('opponent_id', formData.opponent_id);
      data.append('map', formData.map);
      data.append('winner_faction', formData.winner_faction);
      data.append('loser_faction', formData.loser_faction);
      data.append('comments', formData.comments);
      if (formData.rating) {
        data.append('rating', formData.rating);
      }
      if (formData.replay) {
        data.append('replay', formData.replay);
      }

      const response = await matchService.reportMatch(data);
      setMessage('Match reported successfully! Redirecting...');
      setFormData({
        opponent_id: '',
        map: '',
        winner_faction: '',
        loser_faction: '',
        comments: '',
        rating: '',
        replay: null,
      });
      
      // Redirect to home after 1.5 seconds using navigate instead of window.location.href
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error reporting match');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <MainLayout><div className="report-match-container"><p>{t('loading')}</p></div></MainLayout>;
  }

  if (!isAuthenticated) {
    return <MainLayout><div className="report-match-container"><p>{t('report.please_login')}</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="report-match-container">
      <div className="report-match-form-wrapper">
        <h1>{t('report_match_title')}</h1>
        
        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}

        <form onSubmit={handleSubmit} className="report-match-form">
          <div className="form-group">
            <label htmlFor="replay">{t('report_replay')}</label>
            <FileUploadInput
              value={formData.replay}
              onChange={handleReplayFileChange}
              accept=".gz,.bz2"
            />
            <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
              {t('report.replay_upload_help')}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="opponent_id">{t('report_opponent')} *</label>
            <OpponentSelector
              value={formData.opponent_id}
              onChange={(userId) => {
                setFormData((prev) => ({
                  ...prev,
                  opponent_id: userId,
                }));
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="map">{t('report_map')} *</label>
            <select
              id="map"
              name="map"
              value={formData.map}
              onChange={handleInputChange}
              required
            >
              <option value="">{t('report.select_map')}</option>
              {maps.map((map) => (
                <option key={map.id} value={map.name}>
                  {map.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="winner_faction">{t('report.your_faction')} *</label>
              <select
                id="winner_faction"
                name="winner_faction"
                value={formData.winner_faction}
                onChange={handleInputChange}
                required
              >
                <option value="">{t('report.select_faction')}</option>
                {factions.map((faction) => (
                  <option key={faction.id} value={faction.name}>
                    {faction.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="loser_faction">{t('report.opponent_faction')} *</label>
              <select
                id="loser_faction"
                name="loser_faction"
                value={formData.loser_faction}
                onChange={handleInputChange}
                required
              >
                <option value="">{t('report.select_faction')}</option>
                {factions.map((faction) => (
                  <option key={faction.id} value={faction.name}>
                    {faction.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="comments">{t('report_comments')}</label>
            <textarea
              id="comments"
              name="comments"
              value={formData.comments}
              onChange={handleInputChange}
              placeholder={t('report.comments_placeholder')}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label htmlFor="rating">{t('report.rate_opponent')}</label>
            <select
              id="rating"
              name="rating"
              value={formData.rating}
              onChange={handleInputChange}
            >
              <option value="">{t('report.rating_no')}</option>
              <option value="1">1 - {t('report.rating_1')}</option>
              <option value="2">2 - {t('report.rating_2')}</option>
              <option value="3">3 - {t('report.rating_3')}</option>
              <option value="4">4 - {t('report.rating_4')}</option>
              <option value="5">5 - {t('report.rating_5')}</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={() => navigate('/')}
              disabled={submitting}
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={submitting}
            >
              {submitting ? t('report.submitting') : t('report_button')}
            </button>
          </div>
        </form>
      </div>
      </div>
    </MainLayout>
  );
};

export default ReportMatch;
