import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StarRating from './StarRating';
import { reportConfidence1Replay } from '../services/api';

interface ReplayConfirmationModalProps {
  isOpen: boolean;
  replayId: string;
  player1_nickname: string;
  player2_nickname: string;
  currentUserNickname: string;
  your_choice: 'I won' | 'I lost';
  map: string;
  player1_faction: string;
  player2_faction: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReplayConfirmationModal: React.FC<ReplayConfirmationModalProps> = ({
  isOpen,
  replayId,
  player1_nickname,
  player2_nickname,
  currentUserNickname,
  your_choice,
  map,
  player1_faction,
  player2_faction,
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

  // Determine who is the current user and who is the opponent
  const isPlayer1 = currentUserNickname === player1_nickname.toLowerCase();
  const isWinner = your_choice === 'I won';
  
  // Your info
  const yourName = isPlayer1 ? player1_nickname : player2_nickname;
  const yourFaction = isPlayer1 ? player1_faction : player2_faction;
  
  // Opponent info
  const opponentName = isPlayer1 ? player2_nickname : player1_nickname;
  const opponentFaction = isPlayer1 ? player2_faction : player1_faction;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 border-b">
          <h2 className="text-2xl font-bold">{t('label_confirm_match_report') || 'Confirm Match Report'}</h2>
          <p className="text-blue-100 text-sm mt-1">{t('label_unconfirmed_replay') || 'Auto-detected Replay'}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Match Summary */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              🎮 {t('label_match_details') || 'Match Details'}
            </h3>
            
            <div className="space-y-3">
              {/* Players and Result */}
              <div className="flex items-center justify-between gap-4 p-4 bg-white rounded border border-gray-200">
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">{t('label_you') || 'You'}</div>
                  <div className="font-semibold text-gray-800">{yourName}</div>
                  <div className="text-xs text-gray-500 mt-1">{yourFaction}</div>
                </div>
                
                <div className="text-center">
                  <div className={`text-2xl font-bold px-4 py-2 rounded ${
                    isWinner 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {isWinner ? '✓ Won' : '✗ Lost'}
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="text-sm text-gray-600 mb-1">{t('label_opponent') || 'Opponent'}</div>
                  <div className="font-semibold text-gray-800">{opponentName}</div>
                  <div className="text-xs text-gray-500 mt-1">{opponentFaction}</div>
                </div>
              </div>

              {/* Map */}
              <div className="p-4 bg-white rounded border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">📍 {t('label_map') || 'Map'}</div>
                <div className="font-semibold text-gray-800">{map}</div>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('label_comments') || 'Comments'} <span className="text-gray-500 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder={t('label_additional_notes') || 'Share your thoughts about this match...'}
              maxLength={500}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {comments.length}/500
            </p>
          </div>

          {/* Rating Section */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              {t('label_rate_opponent') || 'Rate Opponent'} <span className="text-gray-500 font-normal text-xs">(optional)</span>
            </label>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <StarRating 
                value={rating ? String(rating) : ''} 
                onChange={(val) => setRating(val ? parseInt(val, 10) : undefined)} 
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              <strong>{t('label_error') || 'Error'}:</strong> {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
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
              {isSubmitting ? (
                <>⏳ {t('label_submitting') || 'Submitting'}...</>
              ) : isWinner ? (
                <>✓ {t('button_confirm_win') || 'Confirm Win'}</>
              ) : (
                <>✗ {t('button_confirm_loss') || 'Confirm Loss'}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplayConfirmationModal;
