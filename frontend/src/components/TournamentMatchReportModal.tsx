import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { matchService, api } from '../services/api';
import { parseReplayFile, getMapFromReplay, getPlayerFactionFromReplay } from '../services/replayParser';
import FileUploadInput from './FileUploadInput';
import StarRating from './StarRating';

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
  const [currentUserTeamId, setCurrentUserTeamId] = useState<string | null>(null);

  // For team tournaments, find which team the current user belongs to
  useEffect(() => {
    if (tournamentMode === 'team') {
      const determineUserTeam = async () => {
        try {
          // Fetch participants to find which team this user belongs to
          const participantsRes = await api.get(`/public/tournaments/${tournamentId}/participants`);
          const participants = participantsRes.data;
          
          // Find the participant record for current user
          const userParticipant = participants.find((p: any) => p.user_id === currentUserId);
          
          if (userParticipant && userParticipant.team_id) {
            setCurrentUserTeamId(userParticipant.team_id);
          }
        } catch (err) {
          console.error('Error fetching user team:', err);
        }
      };
      
      determineUserTeam();
    }
  }, [tournamentMode, tournamentId, currentUserId]);

  // Determine who is winner and who is loser
  // For team tournaments: compare currentUserTeamId with player1Id and player2Id
  // For 1v1 tournaments: compare currentUserId with player1Id and player2Id
  let isPlayer1: boolean;
  let winnerId: string;
  
  if (tournamentMode === 'team') {
    if (currentUserTeamId) {
      isPlayer1 = currentUserTeamId === player1Id;
      winnerId = currentUserTeamId;
    } else {
      // Team ID not yet loaded, make an assumption based on user ID match
      // This shouldn't normally happen but is a fallback
      isPlayer1 = false;
      winnerId = currentUserId;
    }
  } else {
    // 1v1 mode: compare user IDs
    isPlayer1 = currentUserId === player1Id;
    winnerId = currentUserId;
  }
  
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

    // Validation: map is always required
    if (!formData.map) {
      setError('Map is required');
      return;
    }

    // Validation: factions required only in 1v1 mode
    if (tournamentMode !== 'team' && (!formData.winner_faction || !formData.loser_faction)) {
      setError('Map and factions are required');
      return;
    }

    // Validate map is in allowed assets
    const mapExists = maps.some(m => m.name === formData.map);
    if (!mapExists) {
      setError(`Map "${formData.map}" is not in the allowed list for this tournament`);
      return;
    }

    // Validate factions are in allowed assets (only for 1v1 mode)
    if (tournamentMode !== 'team') {
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
    }

    try {
      setLoading(true);

      // Determine opponent_id based on tournament mode
      // For team tournaments, the opponent team is already defined in the match
      // For 1v1 tournaments, opponent_id is the other player
      let actualOpponentId: string;
      
      if (tournamentMode === 'team') {
        // For team mode, we don't have a specific opponent user ID, but we have the opponent team ID
        // The backend will deduce the opponent team from the match definition
        // Use the opponent team ID or leave it empty - backend will handle it
        actualOpponentId = isPlayer1 ? player2Id : player1Id;
      } else {
        // For 1v1 mode, opponent_id is simply the other player
        actualOpponentId = isPlayer1 ? player2Id : player1Id;
      }

      const data = new FormData();
      data.append('opponent_id', actualOpponentId);
      data.append('map', formData.map);
      // Always include factions (empty string for team mode)
      data.append('winner_faction', formData.winner_faction || '');
      data.append('loser_faction', formData.loser_faction || '');
      data.append('comments', formData.comments);
      data.append('tournament_id', tournamentId);
      data.append('tournament_match_id', tournamentMatchId);
      if (formData.rating) {
        data.append('rating', formData.rating);
      }
      if (formData.replay) {
        data.append('replay', formData.replay);
      }

      // Report the match using report endpoint (multipart supports team mode with replay)
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-gray-200 p-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{t('report_match_title')} - {tournamentName}</h2>
          </div>
          <button 
            className="text-2xl text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onClose} 
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
            <strong className="text-gray-800">{winnerName}</strong> <span className="text-gray-600">(You)</span> vs <strong className="text-gray-800">{loserName}</strong>
          </div>

          {error && <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">{error}</div>}
          {loadingData && <div className="mb-4 text-gray-600 text-sm">{t('loading')}</div>}

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
              <label htmlFor="map" className="block font-semibold text-gray-700 mb-2">{t('report_map')} *</label>
              <select
                id="map"
                name="map"
                value={formData.map}
                onChange={handleInputChange}
                required
                disabled={loadingData}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">{t('report.select_map')}</option>
                {maps.map((map) => (
                  <option key={map.id} value={map.name}>
                    {map.name}
                  </option>
                ))}
              </select>
            </div>

            {tournamentMode !== 'team' && (
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label htmlFor="winner_faction" className="block font-semibold text-gray-700 mb-2">{t('report.your_faction')} *</label>
                <select
                  id="winner_faction"
                  name="winner_faction"
                  value={formData.winner_faction}
                  onChange={handleInputChange}
                  required
                  disabled={loadingData}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={loadingData}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
            )}

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

            <div className="flex gap-4 mt-6">
              <button
                type="button"
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-sm"
                onClick={onClose}
                disabled={loading}
              >
                {t('btn_cancel')}
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold hover:shadow-lg hover:from-purple-600 hover:to-purple-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-sm"
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
