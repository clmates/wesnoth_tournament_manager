import React, { useState } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import '../styles/MatchConfirmationModal.css';

interface MatchConfirmationModalProps {
  match: any;
  currentPlayerId: string;
  onClose: () => void;
  onSubmit: () => void;
}

const MatchConfirmationModal: React.FC<MatchConfirmationModalProps> = ({
  match,
  currentPlayerId,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    rating: '',
    comments: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const { isAuthenticated } = useAuthStore();

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      // Use match_id if it exists (tournament match), otherwise use id (regular match)
      const matchId = match.match_id || match.id;
      if (import.meta.env.VITE_DEBUG_LOGS === 'true') console.log('Confirming match with ID:', matchId, 'match object:', match);
      
      await api.post(`/matches/${matchId}/confirm`, {
        action: 'confirm',
        opponent_rating: formData.rating,
        comments: formData.comments,
      });

      onSubmit();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to confirm match');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispute = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      // Use match_id if it exists (tournament match), otherwise use id (regular match)
      const matchId = match.match_id || match.id;
      if (import.meta.env.VITE_DEBUG_LOGS === 'true') console.log('Disputing match with ID:', matchId, 'match object:', match);
      
      await api.post(`/matches/${matchId}/confirm`, {
        action: 'dispute',
        opponent_rating: formData.rating,
        comments: formData.comments,
      });

      onSubmit();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to dispute match');
    } finally {
      setIsSubmitting(false);
    }
  };

  const winnerElo = match.winner_elo_before || 'N/A';
  const loserElo = match.loser_elo_before || 'N/A';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Match Confirmation</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="match-info">
            <div className="match-players">
              <div className="player-block winner">
                <h3>Winner</h3>
                <p className="player-name">{match.winner_nickname}</p>
                <p className="player-elo">ELO: {winnerElo}</p>
                <p className="faction">Faction: {match.winner_faction || 'N/A'}</p>
              </div>

              <div className="vs-divider">
                <span>vs</span>
              </div>

              <div className="player-block loser">
                <h3>You (Loser)</h3>
                <p className="player-name">{match.loser_nickname}</p>
                <p className="player-elo">ELO: {loserElo}</p>
                <p className="faction">Faction: {match.loser_faction || 'N/A'}</p>
              </div>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label htmlFor="rating">Rate opponent's performance:</label>
                <select
                  id="rating"
                  name="rating"
                  value={formData.rating}
                  onChange={handleInputChange}
                >
                  <option value="">No rating</option>
                  <option value="1">1 - Poor</option>
                  <option value="2">2 - Fair</option>
                  <option value="3">3 - Good</option>
                  <option value="4">4 - Very Good</option>
                  <option value="5">5 - Excellent</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="comments">Comments:</label>
                <textarea
                  id="comments"
                  name="comments"
                  value={formData.comments}
                  onChange={handleInputChange}
                  placeholder="Optional: Explain any issues or add comments about the match..."
                  rows={4}
                  disabled={isSubmitting}
                  maxLength={500}
                />
                <span className="char-count">{formData.comments.length}/500</span>
              </div>

              {error && <div className="error-message">{error}</div>}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          {isAuthenticated && (
            <>
              <button
                className="btn btn-danger"
                onClick={handleDispute}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Dispute'}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Confirm'}
              </button>
            </>
          )}
          {!isAuthenticated && (
            <div className="unauthenticated-message">
              Please log in to confirm or dispute this match.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchConfirmationModal;
