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
    <div className="bg-gray-50 border border-gray-300 rounded-md p-3 mb-4">
      <h4 className="m-0 mb-3 text-sm font-semibold text-gray-800">Substitutes (Backup Players)</h4>

      {error && <div className="bg-red-100 text-red-800 px-3 py-2 rounded text-xs mb-3">{error}</div>}

      <div className="flex flex-col gap-2 mb-3">
        {substitutes.length === 0 ? (
          <p className="text-gray-500 italic text-sm m-0 p-2">No substitutes yet</p>
        ) : (
          substitutes
            .sort((a, b) => a.substitute_order - b.substitute_order)
            .map((substitute) => (
              <div key={substitute.player_id} className="flex items-center gap-3 bg-white p-2.5 border border-gray-200 rounded">
                <span className="font-semibold text-blue-600 text-sm flex-shrink-0">#{substitute.substitute_order}</span>
                <span className="text-sm font-medium flex-grow">{substitute.nickname}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSubstitute(substitute.player_id, substitute.substitute_order)}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
        <select
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
          disabled={loading || availablePlayers.length === 0}
          className="px-2 py-2 border border-gray-300 rounded text-sm bg-white cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
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
          className="px-3 py-2 bg-blue-500 text-white text-sm font-semibold rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Adding...' : 'Add Substitute'}
        </button>
      </div>
    </div>
  );
};
