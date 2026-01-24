import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { matchService, userService, api } from '../services/api';
import { parseReplayFile, getOpponentFromReplay, getMapFromReplay, getPlayerFactionFromReplay } from '../services/replayParser';
import MainLayout from '../components/MainLayout';
import OpponentSelector from '../components/OpponentSelector';
import FileUploadInput from '../components/FileUploadInput';
import StarRating from '../components/StarRating';

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
        // Load ranked maps, factions and users from API
        const [mapsResponse, factionsResponse, usersResponse] = await Promise.all([
          api.get('/public/maps?is_ranked=true'),
          api.get('/public/factions?is_ranked=true'),
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
        console.error('❌ Error fetching data:', err);
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
    return <MainLayout><div className="max-w-xl mx-auto px-4 py-8"><p className="text-gray-600">{t('loading')}</p></div></MainLayout>;
  }

  if (!isAuthenticated) {
    return <MainLayout><div className="max-w-xl mx-auto px-4 py-8"><p className="text-gray-600">{t('report.please_login')}</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto px-4 py-16 min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-center text-gray-800 mb-8 text-3xl font-bold uppercase tracking-wide">{t('report_match_title')}</h1>
        
        {error && <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">{error}</div>}
        {message && <div className="mb-6 p-4 bg-green-100 border-l-4 border-green-500 text-green-700 rounded">{message}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label htmlFor="replay" className="block font-semibold text-gray-700 mb-2">{t('report_replay')}</label>
            <FileUploadInput
              value={formData.replay}
              onChange={handleReplayFileChange}
              accept=".gz,.bz2"
            />
            <small className="text-gray-600 mt-2 block">
              {t('report.replay_upload_help')}
            </small>
          </div>

          <div>
            <label htmlFor="opponent_id" className="block font-semibold text-gray-700 mb-2">{t('report_opponent')} *</label>
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

          <div>
            <label htmlFor="map" className="block font-semibold text-gray-700 mb-2">{t('report_map')} *</label>
            <select
              id="map"
              name="map"
              value={formData.map}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-gray-800"
            >
              <option value="">{t('report.select_map')}</option>
              {maps.map((map) => (
                <option key={map.id} value={map.name}>
                  {map.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label htmlFor="winner_faction" className="block font-semibold text-gray-700 mb-2">{t('report.your_faction')} *</label>
              <select
                id="winner_faction"
                name="winner_faction"
                value={formData.winner_faction}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-gray-800"
              >
                <option value="">{t('report.select_faction')}</option>
                {factions.map((faction) => (
                  <option key={faction.id} value={faction.name}>
                    {faction.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="loser_faction" className="block font-semibold text-gray-700 mb-2">{t('report.opponent_faction')} *</label>
              <select
                id="loser_faction"
                name="loser_faction"
                value={formData.loser_faction}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-gray-800"
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

          <div>
            <label htmlFor="comments" className="block font-semibold text-gray-700 mb-2">{t('report_comments')}</label>
            <textarea
              id="comments"
              name="comments"
              value={formData.comments}
              onChange={handleInputChange}
              placeholder={t('report.comments_placeholder')}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-gray-800 resize-vertical"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-2">{t('report.rate_opponent')}</label>
            <StarRating
              value={formData.rating}
              onChange={(value) => setFormData((prev) => ({ ...prev, rating: value }))}
            />
          </div>

          <div className="flex gap-4 mt-8">
            <button
              type="button"
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-sm"
              onClick={() => navigate('/')}
              disabled={submitting}
            >
              {t('btn_cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold hover:shadow-lg hover:from-purple-600 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-sm"
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
