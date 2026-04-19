import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { tournamentSchedulingService } from '../services/tournamentSchedulingService';

interface ScheduleProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string | null;
  player1_nickname: string;
  player2_nickname: string;
  onSuccess?: () => void;
}

const ScheduleProposalModal: React.FC<ScheduleProposalModalProps> = ({
  isOpen,
  onClose,
  matchId,
  player1_nickname,
  player2_nickname,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('12:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [schedule, setSchedule] = useState<any>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  if (!isOpen || !matchId) {
    return null;
  }

  // Get user's timezone
  const getUserTimeZone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      return 'UTC';
    }
  };

  // Load current schedule - only runs when component is actually rendered
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setLoadingSchedule(true);
    tournamentSchedulingService
      .getSchedule(matchId)
      .then((data) => {
        setSchedule(data.schedule);
      })
      .catch((err) => {
        console.error('Error loading schedule:', err);
      })
      .finally(() => {
        setLoadingSchedule(false);
      });
  }, [matchId]);

  // Format schedule datetime for display
  const formatScheduleDisplay = (dateTimeStr: string, timezone: string) => {
    if (!dateTimeStr) return 'No schedule';
    
    const date = new Date(dateTimeStr);
    try {
      const localTime = date.toLocaleString('es-ES', { 
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      const utcTime = date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      return `${localTime} (${timezone}) / ${utcTime} UTC`;
    } catch (e) {
      return dateTimeStr;
    }
  };

  // Convert local datetime input to UTC ISO string
  const localToUTC = (dateStr: string, timeStr: string): string => {
    // Create a date in user's local timezone
    const localDateTime = `${dateStr}T${timeStr}:00`;
    const date = new Date(localDateTime);
    return date.toISOString();
  };

  // Convert UTC ISO string to local date/time inputs
  const utcToLocal = (utcStr: string): { date: string; time: string } => {
    const date = new Date(utcStr);
    const localDate = date.toISOString().split('T')[0];
    const localTime = date.toISOString().split('T')[1].substring(0, 5);
    return { date: localDate, time: localTime };
  };

  const handlePropose = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!selectedDate || !selectedTime) {
        setError('Please select both date and time');
        return;
      }

      // Convert to UTC
      const utcDatetime = localToUTC(selectedDate, selectedTime);

      await tournamentSchedulingService.proposeSchedule(matchId, utcDatetime);
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to propose schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setError(null);
      setLoading(true);

      await tournamentSchedulingService.confirmSchedule(matchId);
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to confirm schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      setError(null);
      setLoading(true);

      await tournamentSchedulingService.cancelSchedule(matchId);
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to cancel schedule');
    } finally {
      setLoading(false);
    }
  };

  const timezone = getUserTimeZone();
  const isConfirmed = schedule?.scheduled_status === 'confirmed';
  const hasProposal = schedule?.scheduled_datetime && schedule?.scheduled_status !== 'pending';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4 max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Schedule Match</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-bold text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Match info */}
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <p className="text-sm text-gray-600 mb-2">
            <strong>{player1_nickname}</strong> vs{' '}
            <strong>{player2_nickname}</strong>
          </p>
          <p className="text-xs text-gray-500">Your timezone: {timezone}</p>
        </div>

        {/* Current schedule display */}
        {loadingSchedule ? (
          <div className="mb-6 p-4 bg-blue-50 rounded text-sm text-gray-600">
            Loading schedule...
          </div>
        ) : hasProposal ? (
          <div className="mb-6 p-4 bg-blue-50 rounded">
            <p className="text-sm font-semibold text-gray-700 mb-2">Current proposal:</p>
            <p className="text-sm text-gray-600">
              {formatScheduleDisplay(schedule?.scheduled_datetime, timezone)}
            </p>
            {isConfirmed ? (
              <p className="text-sm text-green-600 font-semibold mt-2">✅ Confirmed by both</p>
            ) : (
              <p className="text-sm text-orange-600 font-semibold mt-2">
                ⏳ Awaiting opponent confirmation
              </p>
            )}
          </div>
        ) : null}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            ✅ Success!
          </div>
        )}

        {/* Proposal form (only show if no confirmed schedule) */}
        {!isConfirmed && !hasProposal && (
          <div className="mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time ({timezone})
              </label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>

            <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              Time will be converted to UTC for storage. Opponent will see this in their timezone.
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          {!isConfirmed && hasProposal && (
            <>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '...' : '✅ Confirm'}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded font-semibold hover:bg-gray-400 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '...' : '✕ Cancel'}
              </button>
            </>
          )}

          {!hasProposal && (
            <>
              <button
                onClick={handlePropose}
                disabled={loading || !selectedDate || !selectedTime}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded font-semibold hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '...' : '📅 Propose'}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded font-semibold hover:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Close
              </button>
            </>
          )}

          {isConfirmed && (
            <>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded font-semibold hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '...' : '🗑️ Cancel Schedule'}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded font-semibold hover:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleProposalModal;
