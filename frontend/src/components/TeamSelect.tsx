import React, { useState, useEffect } from 'react';
import './TeamSelect.css';
import { api } from '../services/api';

interface TeamSelectProps {
  tournamentId: number;
  value?: string;
  onChange: (teamId: string) => void;
  disabled?: boolean;
}

interface Team {
  id: string;
  name: string;
  member_count: number;
  members?: Array<{
    id: string;
    nickname: string;
    position?: number;
  }>;
}

interface ApiResponse {
  success: boolean;
  data?: Team[];
  error?: string;
}

export const TeamSelect: React.FC<TeamSelectProps> = ({
  tournamentId,
  value,
  onChange,
  disabled = false
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/tournaments/${tournamentId}/teams`);
        const data: ApiResponse = response.data;
        if (data.success && data.data) {
          setTeams(data.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch teams');
      } finally {
        setLoading(false);
      }
    };

    if (tournamentId) {
      fetchTeams();
    }
  }, [tournamentId]);

  if (loading) {
    return <div className="team-select-container">Loading teams...</div>;
  }

  if (error) {
    return (
      <div className="team-select-container error">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="team-select-container">
      <label htmlFor="team-select" className="team-select-label">
        Select Team
      </label>
      <select
        id="team-select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || teams.length === 0}
        className="team-select-input"
      >
        <option value="">-- Choose a team --</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} ({team.member_count}/2 members)
          </option>
        ))}
      </select>
      {teams.length === 0 && (
        <p className="team-select-empty">No teams available for this tournament</p>
      )}
    </div>
  );
};
