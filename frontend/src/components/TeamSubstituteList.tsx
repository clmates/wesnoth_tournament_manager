import React, { useState, useEffect } from 'react';
import './TeamSubstituteList.css';

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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  // Fetch available players
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await fetch(
          `${API_URL}/tournaments/${tournamentId}/participants`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch participants');
        }

        const data = await response.json();
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
        const response = await fetch(
          `${API_URL}/tournaments/${tournamentId}/teams`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch substitutes');
        }

        const data: ApiResponse = await response.json();
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

      const response = await fetch(
        `${API_URL}/admin/tournaments/${tournamentId}/teams/${teamId}/substitutes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            player_id: selectedPlayer
          })
        }
      );

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to add substitute');
      }

      setSelectedPlayer('');
      onSubstitutesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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

      const response = await fetch(
        `${API_URL}/admin/tournaments/${tournamentId}/teams/${teamId}/substitutes/${playerId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to remove substitute');
      }

      onSubstitutesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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
