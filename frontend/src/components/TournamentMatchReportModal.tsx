import React, { useState, useEffect } from 'react';
import { matchService, api } from '../services/api';
import '../styles/MatchConfirmationModal.css';

interface TournamentMatchReportProps {
  tournamentMatchId: string;
  tournamentId: string;
  tournamentName: string;
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
  player1Id,
  player1Name,
  player2Id,
  player2Name,
  currentUserId,
  onClose,
  onSuccess,
}) => {
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
        const [mapsResponse, factionsResponse] = await Promise.all([
          api.get('/public/maps'),
          api.get('/public/factions'),
        ]);
        setMaps(mapsResponse.data || []);
        setFactions(factionsResponse.data || []);
      } catch (err) {
        console.error('Error loading maps and factions:', err);
        // Fallback to hardcoded values if API fails
        setMaps([
          { id: '1', name: 'Den of Onis' },
          { id: '2', name: 'Fallenstar Lake' },
          { id: '3', name: 'Hamlets' },
          { id: '4', name: 'Silverhead Crossing' },
          { id: '5', name: 'The Freelands' },
        ]);
        setFactions([
          { id: '1', name: 'Elves' },
          { id: '2', name: 'Loyals' },
          { id: '3', name: 'Northerners' },
          { id: '4', name: 'Knalgan' },
          { id: '5', name: 'Drakes' },
          { id: '6', name: 'Undead' },
        ]);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFormData((prev) => ({
        ...prev,
        replay: e.target.files![0],
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.map || !formData.winner_faction || !formData.loser_faction) {
      setError('Map and factions are required');
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
            <h2>Report Tournament Match</h2>
            <p style={{ color: '#888', margin: '4px 0 0 0', fontSize: '14px' }}>{tournamentName}</p>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}
          {loadingData && <div style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>Loading maps and factions...</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                <strong>{winnerName}</strong> (You) vs <strong>{loserName}</strong>
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="map">Map *</label>
              <select
                id="map"
                name="map"
                value={formData.map}
                onChange={handleInputChange}
                required
                disabled={loadingData}
              >
                <option value="">Select map...</option>
                {maps.map((map) => (
                  <option key={map.id} value={map.name}>
                    {map.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="winner_faction">Your Faction *</label>
                <select
                  id="winner_faction"
                  name="winner_faction"
                  value={formData.winner_faction}
                  onChange={handleInputChange}
                  required
                  disabled={loadingData}
                >
                  <option value="">Select faction...</option>
                  {factions.map((faction) => (
                    <option key={faction.id} value={faction.name}>
                      {faction.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="loser_faction">Opponent Faction *</label>
                <select
                  id="loser_faction"
                  name="loser_faction"
                  value={formData.loser_faction}
                  onChange={handleInputChange}
                  required
                  disabled={loadingData}
                >
                  <option value="">Select faction...</option>
                  {factions.map((faction) => (
                    <option key={faction.id} value={faction.name}>
                      {faction.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="comments">Comments</label>
              <textarea
                id="comments"
                name="comments"
                value={formData.comments}
                onChange={handleInputChange}
                placeholder="Any additional comments about the match..."
                rows={4}
              />
            </div>

            <div className="form-group">
              <label htmlFor="rating">Rate Your Opponent (1-5)</label>
              <select
                id="rating"
                name="rating"
                value={formData.rating}
                onChange={handleInputChange}
              >
                <option value="">No rating</option>
                <option value="1">1 - Poor</option>
                <option value="2">2 - Fair</option>
                <option value="3">3 - Good</option>
                <option value="4">4 - Very Good</option>
                <option value="5">5 - Excellent</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="replay">Replay File</label>
              <input
                type="file"
                id="replay"
                name="replay"
                onChange={handleFileChange}
                accept=".gz,.json,.zip"
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? 'Reporting...' : 'Report Match'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TournamentMatchReportModal;
