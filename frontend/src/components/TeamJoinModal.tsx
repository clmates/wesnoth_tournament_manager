import React, { useState, useEffect } from 'react';
import './TeamJoinModal.css';
import { api, userService } from '../services/api';
import OpponentSelector from './OpponentSelector';

interface User {
  id: string;
  nickname: string;
  elo_rating?: number;
}

interface TeamJoinModalProps {
  tournamentId: string;
  onSubmit: (teamName: string, teammateName: string) => void;
  onClose: () => void;
  isLoading?: boolean;
  currentUserId?: string;
  currentUserNickname?: string;
}

export const TeamJoinModal: React.FC<TeamJoinModalProps> = ({
  tournamentId,
  onSubmit,
  onClose,
  isLoading = false,
  currentUserId,
  currentUserNickname
}) => {
  const [teamName, setTeamName] = useState('');
  const [teammateId, setTeammateId] = useState('');
  const [teammateName, setTeammateName] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [existingTeams, setExistingTeams] = useState<Array<{id: string; name: string; member_count: number}>>([]);
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const [joinMode, setJoinMode] = useState<'create' | 'join'>('create');

  // Fetch existing teams with available slots
  useEffect(() => {
    const fetchExistingTeams = async () => {
      try {
        console.log('📥 Fetching teams for tournament:', tournamentId);
        const response = await api.get(`/public/tournaments/${tournamentId}/teams`);
        console.log('✅ Teams response:', response);
        const teams = response.data?.data || [];
        // Filter teams that have only 1 member (have an available slot)
        // Note: API returns member_count in snake_case
        const availableTeams = teams.filter((team: any) => team.member_count === 1);
        console.log('✅ Available teams (1 member):', availableTeams);
        setExistingTeams(availableTeams);
      } catch (err: any) {
        console.error('❌ Failed to fetch teams:', err?.response?.status, err?.response?.data || err.message);
        // If fetch fails, just show create-only mode
        setExistingTeams([]);
      }
    };
    if (tournamentId) {
      fetchExistingTeams();
    }
  }, [tournamentId]);

  // Search for teammate when typing
  const handleTeammateChange = (userId: string, user: User | null) => {
    setTeammateId(userId);
    setTeammateName(user?.nickname || '');
  };

  const handleSelectTeam = (team: any) => {
    setTeamName(team.name);
    setShowTeamSuggestions(false);
  };

  const handleTeamNameSearch = (value: string) => {
    setTeamName(value);
    
    if (value.length === 0) {
      setShowTeamSuggestions(false);
      return;
    }

    // Show teams that match the search
    const filtered = existingTeams.filter(t => 
      t.name.toLowerCase().includes(value.toLowerCase())
    );
    
    if (filtered.length > 0) {
      setShowTeamSuggestions(true);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    // Validate team name
    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }
    if (teamName.length < 2) {
      setError('Team name must be at least 2 characters');
      return;
    }
    if (teamName.length > 50) {
      setError('Team name must be at most 50 characters');
      return;
    }

    // Teammate is optional now
    if (teammateName.trim()) {
      // Check not selecting self
      if (teammateName.toLowerCase() === currentUserNickname?.toLowerCase()) {
        setError('You cannot select yourself as teammate');
        return;
      }
      
      // Note: Don't validate if user exists here - let backend handle it
      // This allows writing the full nickname without selecting from list
    }

    try {
      // Pass empty string if no teammate selected
      onSubmit(teamName, teammateName || '');
    } catch (err: any) {
      setError(err.message || 'Failed to create team');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content team-join-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Join Team Tournament</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          {/* Mode Tabs */}
          <div className="mode-tabs">
            <button
              className={`tab-btn ${joinMode === 'create' ? 'active' : ''}`}
              onClick={() => { setJoinMode('create'); setError(null); setTeamName(''); setTeammateName(''); }}
            >
              Create New Team
            </button>
            {existingTeams.length > 0 && (
              <button
                className={`tab-btn ${joinMode === 'join' ? 'active' : ''}`}
                onClick={() => { setJoinMode('join'); setError(null); setTeamName(''); setTeammateName(''); }}
              >
                Join Existing Team ({existingTeams.length})
              </button>
            )}
          </div>

          <div className="form-section">
            {joinMode === 'create' ? (
              <>
                {/* Create New Team Mode */}
                <div className="form-group">
                  <label htmlFor="team-name">Team Name *</label>
                  <input
                    id="team-name"
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter team name (e.g., Dragon Slayers)"
                    disabled={isLoading}
                    maxLength={50}
                  />
                  <small>You will be assigned Position 1</small>
                </div>

                {/* Teammate Selection - Optional */}
                <div className="form-group">
                  <label>Teammate <span className="optional-label">(optional)</span></label>
                  <OpponentSelector
                    value={teammateId}
                    onChange={handleTeammateChange}
                  />
                  <small>
                    {teammateName.trim() 
                      ? 'They will be added as Position 2 (pending confirmation)'
                      : 'Leave empty to register alone. Another player can join later.'
                    }
                  </small>
                </div>
              </>
            ) : (
              <>
                {/* Join Existing Team Mode */}
                <div className="form-group">
                  <label htmlFor="existing-team-search">Select Team to Join *</label>
                  <div className="teammate-search-container">
                    <input
                      id="existing-team-search"
                      type="text"
                      value={teamName}
                      onChange={(e) => handleTeamNameSearch(e.target.value)}
                      onFocus={() => setShowTeamSuggestions(true)}
                      placeholder="Search for a team with an available slot..."
                      disabled={isLoading}
                      autoComplete="off"
                    />
                  </div>

                  {/* Team Suggestions */}
                  {showTeamSuggestions && existingTeams.length > 0 && (
                    <div className="suggestions-dropdown">
                      {existingTeams
                        .filter(t => t.name.toLowerCase().includes(teamName.toLowerCase()))
                        .slice(0, 10)
                        .map((team) => (
                          <div
                            key={team.id}
                            className="suggestion-item"
                            onClick={() => handleSelectTeam(team)}
                          >
                            <span className="nickname">{team.name}</span>
                            <span className="member-count">1/2 members</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {showTeamSuggestions && teamName.trim() && 
                    existingTeams.filter(t => t.name.toLowerCase().includes(teamName.toLowerCase())).length === 0 && (
                    <div className="suggestions-empty">
                      No teams found with that name.
                    </div>
                  )}

                  <small>You will be added as Position 2</small>
                </div>

                {/* Optional: Invite a teammate */}
                <div className="form-group">
                  <label>Bring a Teammate <span className="optional-label">(optional)</span></label>
                  <OpponentSelector
                    value={teammateId}
                    onChange={handleTeammateChange}
                  />
                  <small>
                    {teammateName.trim() 
                      ? 'They will be added as Position 1 (pending confirmation)'
                      : 'Optional - register alone or with a teammate'
                    }
                  </small>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button
              className="btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              className="btn-submit"
              onClick={handleSubmit}
              disabled={isLoading || !teamName.trim() || (joinMode === 'join' && !teamName.trim())}
            >
              {isLoading ? 'Joining...' : (joinMode === 'create' ? 'Create Team' : 'Join Team')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
