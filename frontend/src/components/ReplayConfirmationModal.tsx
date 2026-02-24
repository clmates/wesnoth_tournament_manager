import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportConfidence1Replay } from '../services/api';

interface ReplayConfirmationModalProps {
  isOpen: boolean;
  replayId: string;
  winner_nickname: string;
  loser_nickname: string;
  your_choice: 'I won' | 'I lost';
  map: string;
  winner_faction: string;
  loser_faction: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReplayConfirmationModal: React.FC<ReplayConfirmationModalProps> = ({
  isOpen,
  replayId,
  winner_nickname,
  loser_nickname,
  your_choice,
  map,
  winner_faction,
  loser_faction,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState('');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setError('');
    setIsSubmitting(true);

    try {
      await reportConfidence1Replay(replayId, your_choice, comments, rating);
      onSuccess();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to report replay';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Determine the winner and loser based on user's choice
  const isWinner = your_choice === 'I won';
  const opponentName = isWinner ? loser_nickname : winner_nickname;
  const yourFaction = isWinner ? winner_faction : loser_faction;
  const opponentFaction = isWinner ? loser_faction : winner_faction;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        {/* Header */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          {t('label_confirm_match_report') || 'Confirm Match Report'}
        </h2>

        {/* Match Summary */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">
                vs {opponentName}
              </span>
              <span className={`px-3 py-1 rounded text-sm font-semibold ${
                isWinner 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {isWinner ? '✓ You Won' : '✗ You Lost'}
              </span>
            </div>
            <div className="flex gap-4 text-sm text-gray-600">
              <span>🎮 {yourFaction} vs {opponentFaction}</span>
              <span>📍 {map}</span>
            </div>
          </div>
        </div>

        {/* Optional: Comments */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('label_comments') || 'Comments'} (Optional)
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={`Share your thoughts about this match with ${opponentName}...`}
            maxLength={500}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500 mt-1">
            {comments.length}/500
          </p>
        </div>

        {/* Optional: Rating */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('label_rate_opponent') || 'Rate Opponent'} (Optional)
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                disabled={isSubmitting}
                className={`w-10 h-10 rounded border-2 font-semibold transition ${
                  rating === star
                    ? 'bg-yellow-400 border-yellow-500 text-yellow-800'
                    : 'border-gray-300 text-gray-500 hover:border-yellow-400'
                }`}
              >
                ⭐
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('button_cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`flex-1 px-4 py-2 text-white rounded-lg font-semibold transition ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : isWinner
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {isSubmitting ? '⏳ Submitting...' : (isWinner ? '✓ Confirm Win' : '✗ Confirm Loss')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplayConfirmationModal;
