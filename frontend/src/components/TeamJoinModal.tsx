import React, { useState, useEffect } from 'react';
import './TeamJoinModal.css';
import * as api from '../services/api';
import { userService } from '../services/api';

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
  const [teammateName, setTeammateName] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // Search for teammate when typing
  const handleTeammateSearch = async (value: string) => {
    setTeammateName(value);
    
    if (value.length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setSearching(true);
      const response = await userService.searchUsers(value);
      const results = response.data || response;
      
      // Filter out current user
      const filtered = results.filter((user: User) => user.nickname.toLowerCase() !== currentUserNickname?.toLowerCase());
      setSearchResults(filtered);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Failed to search users:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectTeammate = (user: User) => {
    setTeammateName(user.nickname);
    setShowSuggestions(false);
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

    // Validate teammate
    if (!teammateName.trim()) {
      setError('Please enter a teammate name');
      return;
    }

    // Check if teammate is in search results or just typed
    const selectedUser = searchResults.find(u => u.nickname.toLowerCase() === teammateName.toLowerCase());
    if (!selectedUser && teammateName) {
      setError('Please select a teammate from the list');
      return;
    }

    // Check not selecting self
    if (teammateName.toLowerCase() === currentUserNickname?.toLowerCase()) {
      setError('You cannot select yourself as teammate');
      return;
    }

    try {
      onSubmit(teamName, teammateName);
    } catch (err: any) {
      setError(err.message || 'Failed to create team');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content team-join-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Team</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <div className="form-section">
            {/* Team Name */}
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

            {/* Teammate Search */}
            <div className="form-group">
              <label htmlFor="teammate-search">Teammate Name *</label>
              <div className="teammate-search-container">
                <input
                  id="teammate-search"
                  type="text"
                  value={teammateName}
                  onChange={(e) => handleTeammateSearch(e.target.value)}
                  onFocus={() => teammateName.length >= 2 && setShowSuggestions(true)}
                  placeholder="Search teammate by nickname..."
                  disabled={isLoading}
                  autoComplete="off"
                />
                {searching && <span className="searching">Searching...</span>}
              </div>

              {/* Search Suggestions */}
              {showSuggestions && searchResults.length > 0 && (
                <div className="suggestions-dropdown">
                  {searchResults.slice(0, 10).map((user) => (
                    <div
                      key={user.id}
                      className="suggestion-item"
                      onClick={() => handleSelectTeammate(user)}
                    >
                      <span className="nickname">{user.nickname}</span>
                      {user.elo_rating && <span className="elo">ELO: {user.elo_rating}</span>}
                    </div>
                  ))}
                </div>
              )}

              {showSuggestions && teammateName.length >= 2 && searchResults.length === 0 && (
                <div className="suggestions-empty">
                  No players found. Make sure the nickname is correct.
                </div>
              )}

              <small>Select a player from suggestions. They will be added as Position 2 to the team.</small>
            </div>
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
              disabled={isLoading || !teamName.trim() || !teammateName.trim()}
            >
              {isLoading ? 'Creating Team...' : 'Create Team'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
