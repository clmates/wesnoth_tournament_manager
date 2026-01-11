import React, { useState } from 'react';
import './TeamJoinModal.css';

interface TeamJoinModalProps {
  tournamentId: string;
  existingTeams: Array<{ id: string; name: string; member_count: number }>;
  onSubmit: (teamName: string, teamPosition: number) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export const TeamJoinModal: React.FC<TeamJoinModalProps> = ({
  tournamentId,
  existingTeams,
  onSubmit,
  onClose,
  isLoading = false
}) => {
  const [joinMode, setJoinMode] = useState<'create' | 'existing'>('create');
  const [teamName, setTeamName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [teamPosition, setTeamPosition] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const availableTeams = existingTeams.filter((t) => t.member_count < 2);
  const selectedTeam = availableTeams.find((t) => t.id === selectedTeamId);

  const handleSubmit = async () => {
    setError(null);

    if (joinMode === 'create') {
      if (!teamName.trim()) {
        setError('Please enter a team name');
        return;
      }
      if (teamName.length < 2) {
        setError('Team name must be at least 2 characters');
        return;
      }
    } else {
      if (!selectedTeamId) {
        setError('Please select a team');
        return;
      }
      if (!teamPosition) {
        setError('Please select a position');
        return;
      }
    }

    try {
      const finalTeamName = joinMode === 'create' ? teamName : selectedTeam?.name || '';
      onSubmit(finalTeamName, teamPosition);
    } catch (err: any) {
      setError(err.message || 'Failed to join team');
    }
  };

  // Determine available positions for selected team
  const getAvailablePositions = () => {
    if (!selectedTeam) return [1, 2];
    // This is simplified - in reality you'd check which position is taken
    // For now, just return both positions (backend will validate)
    return [1, 2];
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

          {/* Mode Selection */}
          <div className="mode-selection">
            <label className="mode-option">
              <input
                type="radio"
                checked={joinMode === 'create'}
                onChange={() => {
                  setJoinMode('create');
                  setError(null);
                }}
                disabled={isLoading}
              />
              <span>Create New Team</span>
            </label>
            <label className="mode-option">
              <input
                type="radio"
                checked={joinMode === 'existing'}
                onChange={() => {
                  setJoinMode('existing');
                  setError(null);
                }}
                disabled={isLoading || availableTeams.length === 0}
              />
              <span>Join Existing Team ({availableTeams.length} available)</span>
            </label>
          </div>

          {/* Create New Team Section */}
          {joinMode === 'create' && (
            <div className="form-section">
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
              <small>You will be assigned Position 1. Position 2 will be for the next member.</small>
              <div className="position-auto-assign">
                <input type="hidden" value="1" />
                <p>Your Position: <strong>1</strong></p>
              </div>
            </div>
          )}

          {/* Join Existing Team Section */}
          {joinMode === 'existing' && (
            <div className="form-section">
              {availableTeams.length > 0 ? (
                <>
                  <label htmlFor="team-select">Select Team *</label>
                  <select
                    id="team-select"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="">-- Choose a team --</option>
                    {availableTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.member_count}/2 members)
                      </option>
                    ))}
                  </select>

                  {selectedTeam && (
                    <>
                      <label htmlFor="position-select">Your Position *</label>
                      <select
                        id="position-select"
                        value={teamPosition}
                        onChange={(e) => setTeamPosition(parseInt(e.target.value))}
                        disabled={isLoading}
                      >
                        {getAvailablePositions().map((pos) => (
                          <option key={pos} value={pos}>
                            Position {pos}
                          </option>
                        ))}
                      </select>
                      <small>Server will validate position availability. Contact admin if issue occurs.</small>
                    </>
                  )}
                </>
              ) : (
                <p className="no-teams">No teams available to join. Create a new team instead.</p>
              )}
            </div>
          )}

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
              disabled={isLoading}
            >
              {isLoading ? 'Joining...' : 'Join Team'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
