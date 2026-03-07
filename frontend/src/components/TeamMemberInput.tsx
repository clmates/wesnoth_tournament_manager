import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface TeamMemberInputProps {
  tournamentId: number;
  teamId: string;
  onMembersUpdated: () => void;
}

interface Player {
  id: string;
  nickname: string;
}

interface TeamMember {
  id: string;
  nickname: string;
  position?: number | null;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export const TeamMemberInput: React.FC<TeamMemberInputProps> = ({
  tournamentId,
  teamId,
  onMembersUpdated
}) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tournament participants (available players)
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

  // Fetch current team members
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await api.get(`/tournaments/${tournamentId}/teams`);
        const data: ApiResponse = response.data;
        if (data.success && data.data) {
          const team = data.data.find((t: any) => t.id === teamId);
          if (team && team.members) {
            setMembers(team.members);
          }
        }
      } catch (err) {
        console.error('Error fetching members:', err);
      }
    };

    if (teamId) {
      fetchMembers();
    }
  }, [teamId, tournamentId]);

  const handleAddMember = async () => {
    if (!selectedPlayer || !selectedPosition) {
      setError('Please select both a player and position');
      return;
    }

    if (members.length >= 2) {
      setError('Team is full (maximum 2 members)');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.post(
        `/admin/tournaments/${tournamentId}/teams/${teamId}/members`,
        {
          player_id: selectedPlayer,
          team_position: selectedPosition
        }
      );

      const data: ApiResponse = response.data;

      setSelectedPlayer('');
      setSelectedPosition(null);
      onMembersUpdated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || (err instanceof Error ? err.message : 'Failed to add member'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (playerId: string) => {
    if (!confirm('Remove this member from the team?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await api.delete(
        `/admin/tournaments/${tournamentId}/teams/${teamId}/members/${playerId}`
      );

      const data: ApiResponse = response.data;

      onMembersUpdated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || (err instanceof Error ? err.message : 'Failed to remove member'));
    } finally {
      setLoading(false);
    }
  };

  const availablePlayers = players.filter(
    (p) => !members.some((m) => m.id === p.id)
  );

  return (
    <div className="bg-gray-50 border border-gray-300 rounded-md p-3 mb-4">
      <h4 className="m-0 mb-3 text-sm font-semibold text-gray-800">Team Members</h4>

      {error && <div className="bg-red-100 text-red-800 px-3 py-2 rounded text-xs mb-3">{error}</div>}

      <div className="flex flex-col gap-2 mb-3">
        {members.length === 0 ? (
          <p className="text-gray-500 italic text-sm m-0 p-2">No members yet</p>
        ) : (
          members.map((member) => (
            <div key={member.id} className="flex justify-between items-center bg-white p-2.5 border border-gray-200 rounded">
              <span className="text-sm font-medium flex items-center gap-2">
                {member.nickname}
                {member.position && <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">Position {member.position}</span>}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveMember(member.id)}
                disabled={loading}
                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {members.length < 2 && (
        <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            disabled={loading || availablePlayers.length === 0}
            className="px-2 py-2 border border-gray-300 rounded text-sm bg-white cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            <option value="">-- Select player --</option>
            {availablePlayers.map((player) => (
              <option key={player.id} value={player.id}>
                {player.nickname}
              </option>
            ))}
          </select>

          <select
            value={selectedPosition || ''}
            onChange={(e) => setSelectedPosition(e.target.value ? parseInt(e.target.value) : null)}
            disabled={loading}
            className="px-2 py-2 border border-gray-300 rounded text-sm bg-white cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            <option value="">-- Select position --</option>
            {!members.some((m) => m.position === 1) && <option value="1">Position 1</option>}
            {!members.some((m) => m.position === 2) && <option value="2">Position 2</option>}
          </select>

          <button
            type="button"
            onClick={handleAddMember}
            disabled={loading || !selectedPlayer || !selectedPosition}
            className="px-3 py-2 bg-green-500 text-white text-sm font-semibold rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      )}
    </div>
  );
};
