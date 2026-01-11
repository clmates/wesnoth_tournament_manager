import React, { useState, useEffect } from 'react';
import './TeamMemberInput.css';

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

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  // Fetch tournament participants (available players)
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

  // Fetch current team members
  useEffect(() => {
    const fetchMembers = async () => {
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
          throw new Error('Failed to fetch team members');
        }

        const data: ApiResponse = await response.json();
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

      const response = await fetch(
        `${API_URL}/admin/tournaments/${tournamentId}/teams/${teamId}/members`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            player_id: selectedPlayer,
            team_position: selectedPosition
          })
        }
      );

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to add member');
      }

      setSelectedPlayer('');
      setSelectedPosition(null);
      onMembersUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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

      const response = await fetch(
        `${API_URL}/admin/tournaments/${tournamentId}/teams/${teamId}/members/${playerId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to remove member');
      }

      onMembersUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const availablePlayers = players.filter(
    (p) => !members.some((m) => m.id === p.id)
  );

  return (
    <div className="team-member-input">
      <h4>Team Members</h4>

      {error && <div className="error-message">{error}</div>}

      <div className="member-list">
        {members.length === 0 ? (
          <p className="no-members">No members yet</p>
        ) : (
          members.map((member) => (
            <div key={member.id} className="member-item">
              <span className="member-name">
                {member.nickname}
                {member.position && <span className="position">Position {member.position}</span>}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveMember(member.id)}
                disabled={loading}
                className="remove-btn"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {members.length < 2 && (
        <div className="add-member-form">
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            disabled={loading || availablePlayers.length === 0}
            className="player-select"
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
            className="position-select"
          >
            <option value="">-- Select position --</option>
            {!members.some((m) => m.position === 1) && <option value="1">Position 1</option>}
            {!members.some((m) => m.position === 2) && <option value="2">Position 2</option>}
          </select>

          <button
            type="button"
            onClick={handleAddMember}
            disabled={loading || !selectedPlayer || !selectedPosition}
            className="add-btn"
          >
            {loading ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      )}
    </div>
  );
};
