import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface TeamSubstituteListProps {
  tournamentId: number;
  teamId: string;
  onSubstitutesUpdated: () => void;
}

interface Player {
  id: string;
  nickname: string;
}

interface Substitute {
  player_id: string;
  nickname: string;
  substitute_order: number;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export const TeamSubstituteList: React.FC<TeamSubstituteListProps> = ({
  tournamentId,
  teamId,
  onSubstitutesUpdated
}) => {
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available players
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await api.get(`/tournaments/${tournamentId}/participants`);
        const data = response.data;
        if (data.success && data.data) {
          setPlayers(data.data);
        }
      } catch (err) {
        console.error('Error fetching players:', err);
      }
    };

    if (tournamentId) {
      fetchPlayers();
    }
  }, [tournamentId]);

  // Fetch current substitutes
  useEffect(() => {
    const fetchSubstitutes = async () => {
      try {
        const response = await api.get(`/tournaments/${tournamentId}/teams`);
        const data: ApiResponse = response.data;
        if (data.success && data.data) {
          const team = data.data.find((t: any) => t.id === teamId);
          if (team && team.substitutes) {
            setSubstitutes(
              team.substitutes.map((sub: any, idx: number) => ({
                player_id: sub.id,
                nickname: sub.nickname,
                substitute_order: idx + 1
              }))
            );
          }
        }
      } catch (err) {
        console.error('Error fetching substitutes:', err);
      }
    };

    if (teamId) {
      fetchSubstitutes();
    }
  }, [teamId, tournamentId]);

  const handleAddSubstitute = async () => {
    if (!selectedPlayer) {
      setError('Please select a player');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.post(
        `/admin/tournaments/${tournamentId}/teams/${teamId}/substitutes`,
        {
          player_id: selectedPlayer
        }
      );

      const data: ApiResponse = response.data;

      setSelectedPlayer('');
      onSubstitutesUpdated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || (err instanceof Error ? err.message : 'Failed to add substitute'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSubstitute = async (playerId: string, order: number) => {
    if (!confirm(`Remove substitute #${order}?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.delete(
        `/admin/tournaments/${tournamentId}/teams/${teamId}/substitutes/${playerId}`
      );

      const data: ApiResponse = response.data;

      onSubstitutesUpdated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || (err instanceof Error ? err.message : 'Failed to remove substitute'));
    } finally {
      setLoading(false);
    }
  };

  const usedPlayerIds = substitutes.map((s) => s.player_id);
  const availablePlayers = players.filter((p) => !usedPlayerIds.includes(p.id));

  return (
    <div className="team-substitute-list">
      <h4>Substitutes (Backup Players)</h4>

      {error && <div className="error-message">{error}</div>}

      <div className="substitute-list">
        {substitutes.length === 0 ? (
          <p className="no-substitutes">No substitutes yet</p>
        ) : (
          substitutes
            .sort((a, b) => a.substitute_order - b.substitute_order)
            .map((substitute) => (
              <div key={substitute.player_id} className="substitute-item">
                <span className="substitute-order">#{substitute.substitute_order}</span>
                <span className="substitute-name">{substitute.nickname}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSubstitute(substitute.player_id, substitute.substitute_order)}
                  disabled={loading}
                  className="remove-substitute-btn"
                >
                  Remove
                </button>
              </div>
            ))
        )}
      </div>

      <div className="add-substitute-form">
        <select
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
          disabled={loading || availablePlayers.length === 0}
          className="player-select"
        >
          <option value="">-- Select substitute player --</option>
          {availablePlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.nickname}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleAddSubstitute}
          disabled={loading || !selectedPlayer}
          className="add-substitute-btn"
        >
          {loading ? 'Adding...' : 'Add Substitute'}
        </button>
      </div>
    </div>
  );
};
