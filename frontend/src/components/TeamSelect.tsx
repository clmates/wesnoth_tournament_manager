import React, { useState, useEffect } from 'react';
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
    return <div className="px-4 py-2 text-gray-600">Loading teams...</div>;
  }

  if (error) {
    return (
      <div className="px-4 py-2 bg-red-50 text-red-600 rounded-lg">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="team-select" className="text-sm font-semibold text-gray-700">
        Select Team
      </label>
      <select
        id="team-select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || teams.length === 0}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      >
        <option value="">-- Choose a team --</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} ({team.member_count}/2 members)
          </option>
        ))}
      </select>
      {teams.length === 0 && (
        <p className="text-sm text-gray-500">No teams available for this tournament</p>
      )}
    </div>
  );
};
