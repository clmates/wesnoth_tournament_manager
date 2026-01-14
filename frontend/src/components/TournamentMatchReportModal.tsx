import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { matchService, api } from '../services/api';
import { parseReplayFile, getMapFromReplay, getPlayerFactionFromReplay } from '../services/replayParser';
import FileUploadInput from './FileUploadInput';
import '../styles/ReportMatch.css';

interface TournamentMatchReportProps {
  tournamentMatchId: string;
  tournamentId: string;
  tournamentName: string;
  tournamentMode?: 'ranked' | 'unranked' | 'team';
  player1Id: string;
  player1Name: string;
  player2Id: string;
  player2Name: string;
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface GameMap {
  id: string;
  name: string;
}

interface Faction {
  id: string;
  name: string;
}

const TournamentMatchReportModal: React.FC<TournamentMatchReportProps> = ({
  tournamentMatchId,
  tournamentId,
  tournamentName,
  tournamentMode = 'ranked',
  player1Id,
  player1Name,
  player2Id,
  player2Name,
  currentUserId,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    map: '',
    winner_faction: '',
    loser_faction: '',
    comments: '',
    rating: '',
    replay: null as File | null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [tournamentAssets, setTournamentAssets] = useState<{ maps: GameMap[]; factions: Faction[] } | null>(null);

  // Determine who is winner and who is loser
  const isPlayer1 = currentUserId === player1Id;
  const winnerId = currentUserId;
  const loserId = isPlayer1 ? player2Id : player1Id;
  const winnerName = isPlayer1 ? player1Name : player2Name;
  const loserName = isPlayer1 ? player2Name : player1Name;

  // Load maps and factions from database
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);
        
        let mapsResponse, factionsResponse;
        
        // If this is a tournament match, load tournament-specific assets
        if (tournamentId) {
          try {
            const tourAssetsRes = await api.get(`/public/tournaments/${tournamentId}/unranked-assets`);
            if (tourAssetsRes.data.success && (tourAssetsRes.data.data.factions.length > 0 || tourAssetsRes.data.data.maps.length > 0)) {
              // Tournament has specific assets - use those
              setTournamentAssets({
                maps: tourAssetsRes.data.data.maps,
                factions: tourAssetsRes.data.data.factions
              });
              mapsResponse = tourAssetsRes.data.data.maps;
              factionsResponse = tourAssetsRes.data.data.factions;
            } else {
              // Tournament has no specific assets - load all ranked assets
              const results = await Promise.all([
                api.get('/public/maps?is_ranked=true'),
                api.get('/public/factions?is_ranked=true'),
              ]);
              mapsResponse = results[0].data;
              factionsResponse = results[1].data;
            }
          } catch (err) {
            // Fallback to ranked assets if tournament assets fail
            const results = await Promise.all([
              api.get('/public/maps?is_ranked=true'),
              api.get('/public/factions?is_ranked=true'),
            ]);
            mapsResponse = results[0].data;
            factionsResponse = results[1].data;
          }
        } else {
          // Global report match - only ranked assets
          const results = await Promise.all([
            api.get('/public/maps?is_ranked=true'),
            api.get('/public/factions?is_ranked=true'),
          ]);
          mapsResponse = results[0].data;
          factionsResponse = results[1].data;
        }
        
        setMaps(mapsResponse || []);
        setFactions(factionsResponse || []);
        
        if ((!mapsResponse || mapsResponse.length === 0) || 
            (!factionsResponse || factionsResponse.length === 0)) {
          setError('No maps or factions available. Please contact an administrator.');
        }
      } catch (err) {
        console.error('Error loading maps and factions:', err);
        setError('Failed to load maps and factions. Please try again later.');
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [tournamentId]);

  const handleReplayFileChange = async (file: File | null) => {
    setFormData((prev) => ({
      ...prev,
      replay: file,
    }));

    if (!file) return;

    try {
      setError('');
      const replayData = await parseReplayFile(file);

      // Autocomplete map
      if (replayData.map) {
        const matchingMap = maps.find((m) =>
          m.name.toLowerCase() === replayData.map?.toLowerCase()
        );
        if (matchingMap) {
          setFormData((prev) => ({
            ...prev,
            map: matchingMap.name,
          }));
        }
      }

      // Autocomplete factions based on current player
      const playerFaction = getPlayerFactionFromReplay(replayData, winnerName);
      if (playerFaction) {
        const matchingFaction = factions.find(
          (f) => f.name.toLowerCase() === playerFaction.toLowerCase()
        );
        if (matchingFaction) {
          setFormData((prev) => ({
            ...prev,
            winner_faction: matchingFaction.name,
          }));
        }
      }

      const opponentFaction = replayData.players.find(
        (p) => p.name !== winnerName
      )?.faction;
      if (opponentFaction) {
        const matchingFaction = factions.find(
          (f) => f.name.toLowerCase() === opponentFaction.toLowerCase()
        );
        if (matchingFaction) {
          setFormData((prev) => ({
            ...prev,
            loser_faction: matchingFaction.name,
          }));
        }
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
    setError('');

    if (!formData.map || !formData.winner_faction || !formData.loser_faction) {
      setError('Map and factions are required');
      return;
    }

    // Validate map is in allowed assets
    const mapExists = maps.some(m => m.name === formData.map);
    if (!mapExists) {
      setError(`Map "${formData.map}" is not in the allowed list for this tournament`);
      return;
    }

    // Validate factions are in allowed assets
    const winnerFactionExists = factions.some(f => f.name === formData.winner_faction);
    if (!winnerFactionExists) {
      setError(`Faction "${formData.winner_faction}" is not in the allowed list for this tournament`);
      return;
    }

    const loserFactionExists = factions.some(f => f.name === formData.loser_faction);
    if (!loserFactionExists) {
      setError(`Faction "${formData.loser_faction}" is not in the allowed list for this tournament`);
      return;
    }

    try {
      setLoading(true);

      const data = new FormData();
      data.append('opponent_id', loserId);
      data.append('map', formData.map);
      data.append('winner_faction', formData.winner_faction);
      data.append('loser_faction', formData.loser_faction);
      data.append('comments', formData.comments);
      data.append('tournament_id', tournamentId);
      data.append('tournament_match_id', tournamentMatchId);
      if (formData.rating) {
        data.append('rating', formData.rating);
      }
      if (formData.replay) {
        data.append('replay', formData.replay);
      }

      // Report the match
      await matchService.reportMatch(data);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error reporting match:', err);
      setError(err.response?.data?.error || 'Failed to report match');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{t('report_match_title')} - {tournamentName}</h2>
          </div>
          <button className="close-btn" onClick={onClose} disabled={loading}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="player-info" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <strong>{winnerName}</strong> (You) vs <strong>{loserName}</strong>
          </div>

          {error && <div className="error-message">{error}</div>}
          {loadingData && <div style={{ color: '#666', fontSize: '14px', marginBottom: '1rem' }}>{t('loading')}</div>}

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
              <label htmlFor="map">{t('report_map')} *</label>
              <select
                id="map"
                name="map"
                value={formData.map}
                onChange={handleInputChange}
                required
                disabled={loadingData}
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
                  disabled={loadingData}
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
                  disabled={loadingData}
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
                onClick={onClose}
                disabled={loading}
              >
                {t('btn_cancel')}
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? t('report.submitting') : t('report_button')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TournamentMatchReportModal;
