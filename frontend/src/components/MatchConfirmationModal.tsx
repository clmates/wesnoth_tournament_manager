import React, { useState } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-11/12 max-h-screen overflow-y-auto animate-slideUp border border-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b-2 border-gray-100 px-6 py-6 bg-gray-50">
          <h2 className="text-2xl font-semibold text-gray-800 m-0">Match Confirmation</h2>
          <button 
            className="bg-none border-none text-gray-400 text-3xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded hover:text-gray-800 hover:bg-gray-100 transition-all"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="mb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 bg-gray-50 rounded-lg p-4 text-center border border-gray-200 border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-gray-50">
                <h3 className="text-gray-800 m-0 mb-2 text-xs font-semibold uppercase tracking-wide">Winner</h3>
                <p className="text-gray-900 font-semibold text-base m-0 mb-1">{match.winner_nickname}</p>
                <p className="text-yellow-600 font-semibold text-sm m-0 mb-1">ELO: {winnerElo}</p>
                <p className="text-gray-600 m-0 text-xs">Faction: {match.winner_faction || 'N/A'}</p>
              </div>

              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 flex-shrink-0">
                <span className="text-gray-700 font-bold">vs</span>
              </div>

              <div className="flex-1 bg-gray-50 rounded-lg p-4 text-center border border-gray-200 border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 to-gray-50">
                <h3 className="text-gray-800 m-0 mb-2 text-xs font-semibold uppercase tracking-wide">You (Loser)</h3>
                <p className="text-gray-900 font-semibold text-base m-0 mb-1">{match.loser_nickname}</p>
                <p className="text-yellow-600 font-semibold text-sm m-0 mb-1">ELO: {loserElo}</p>
                <p className="text-gray-600 m-0 text-xs">Faction: {match.loser_faction || 'N/A'}</p>
              </div>
            </div>

            <div className="mt-6">
              <div>
                <label htmlFor="rating" className="block font-semibold text-gray-700 mb-2">Rate opponent's performance:</label>
                <select
                  id="rating"
                  name="rating"
                  value={formData.rating}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-gray-800"
                >
                  <option value="">No rating</option>
                  <option value="1">1 - Poor</option>
                  <option value="2">2 - Fair</option>
                  <option value="3">3 - Good</option>
                  <option value="4">4 - Very Good</option>
                  <option value="5">5 - Excellent</option>
                </select>
              </div>

              <div className="mt-4">
                <label htmlFor="comments" className="block font-semibold text-gray-700 mb-2">Comments:</label>
                <textarea
                  id="comments"
                  name="comments"
                  value={formData.comments}
                  onChange={handleInputChange}
                  placeholder="Optional: Explain any issues or add comments about the match..."
                  rows={4}
                  disabled={isSubmitting}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all bg-white text-gray-800 resize-vertical disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-xs text-gray-500 float-right mt-1">{formData.comments.length}/500</span>
              </div>

              {error && <div className="mt-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">{error}</div>}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          {isAuthenticated && (
            <>
              <button
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDispute}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Dispute'}
              </button>
              <button
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Confirm'}
              </button>
            </>
          )}
          {!isAuthenticated && (
            <div className="flex-1 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm text-center">
              Please log in to confirm or dispute this match.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchConfirmationModal;
