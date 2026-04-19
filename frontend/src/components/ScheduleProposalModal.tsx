import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { tournamentSchedulingService } from '../services/tournamentSchedulingService';

interface ScheduleProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string | null;
  player1_nickname: string;
  player2_nickname: string;
  scheduled_datetime?: string;
  scheduled_status?: string;
  scheduled_by_player_id?: string;
  onSuccess?: () => void;
}

interface Schedule {
  id: string;
  scheduled_datetime: string | null;
  scheduled_status: string;
  scheduled_by_player_id: string | null;
  scheduled_confirmed_at: string | null;
}

const ScheduleProposalModal: React.FC<ScheduleProposalModalProps> = ({
  isOpen,
  onClose,
  matchId,
  player1_nickname,
  player2_nickname,
  scheduled_datetime,
  scheduled_status,
  scheduled_by_player_id,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('12:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Get user's timezone
  const getUserTimeZone = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      return 'UTC';
    }
  };

  const timezone = getUserTimeZone();

  // Load existing schedule when modal opens
  useEffect(() => {
    if (isOpen && matchId && scheduled_datetime) {
      // Use schedule data passed from parent component
      setSchedule({
        id: matchId,
        scheduled_datetime,
        scheduled_status: scheduled_status || 'pending',
        scheduled_by_player_id: scheduled_by_player_id || null,
        scheduled_confirmed_at: null,
      });
      
      // Parse datetime to populate form
      const date = new Date(scheduled_datetime);
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toISOString().split('T')[1].substring(0, 5);
      setSelectedDate(dateStr);
      setSelectedTime(timeStr);
    } else if (isOpen && matchId && !scheduled_datetime) {
      // No existing schedule
      setSchedule(null);
      setSelectedDate('');
      setSelectedTime('12:00');
    }
  }, [isOpen, matchId, scheduled_datetime, scheduled_status, scheduled_by_player_id]);

  const loadSchedule = async () => {
    try {
      setLoadingSchedule(true);
      const response = await tournamentSchedulingService.getSchedule(matchId!);
      if (response.schedule) {
        setSchedule(response.schedule);
        // If there's a scheduled datetime, parse it to populate the form
        if (response.schedule.scheduled_datetime) {
          const date = new Date(response.schedule.scheduled_datetime);
          const dateStr = date.toISOString().split('T')[0];
          const timeStr = date.toISOString().split('T')[1].substring(0, 5);
          setSelectedDate(dateStr);
          setSelectedTime(timeStr);
        }
      }
    } catch (err) {
      console.error('Failed to load schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  if (!isOpen || !matchId) {
    return null;
  }

  // Convert local datetime input to UTC ISO string
  const localToUTC = (dateStr: string, timeStr: string): string => {
    const localDateTime = `${dateStr}T${timeStr}:00`;
    const date = new Date(localDateTime);
    return date.toISOString();
  };

  // Format datetime for display in user's timezone
  const formatDateTimeDisplay = (dateTimeStr: string | null): string => {
    if (!dateTimeStr) return 'Not scheduled';
    const date = new Date(dateTimeStr);
    return date.toLocaleString('es-ES', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePropose = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!selectedDate || !selectedTime) {
        setError('Please select both date and time');
        return;
      }

      const utcDatetime = localToUTC(selectedDate, selectedTime);
      await tournamentSchedulingService.proposeSchedule(matchId, utcDatetime);
      setSuccess(true);

      setTimeout(async () => {
        setSuccess(false);
        // Reload schedule after proposing
        await loadSchedule();
        if (onSuccess) onSuccess();
      }, 1500);
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

      if (!selectedDate || !selectedTime) {
        setError('Please select both date and time');
        return;
      }

      const utcDatetime = localToUTC(selectedDate, selectedTime);
      await tournamentSchedulingService.confirmSchedule(matchId, utcDatetime);
      setSuccess(true);

      setTimeout(async () => {
        setSuccess(false);
        // Reload schedule after confirming
        await loadSchedule();
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to confirm schedule');
    } finally {
      setLoading(false);
    }
  };

  const isConfirmed = schedule?.scheduled_status === 'confirmed';
  const hasProposal = schedule?.scheduled_datetime && schedule?.scheduled_status !== 'pending';
  const isPending = schedule?.scheduled_status === 'pending';
  
  // Determine if current user is the one who proposed
  const isUserTheProposer = schedule?.scheduled_by_player_id === user?.id;
  // If user is NOT the proposer but there's a proposal, they need to confirm
  const userNeedsToConfirm = hasProposal && !isUserTheProposer && !isConfirmed;

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

        {/* Loading schedule */}
        {loadingSchedule && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
            Loading schedule...
          </div>
        )}

        {/* Current schedule display */}
        {!loadingSchedule && hasProposal && (
          <div className="mb-6 p-4 bg-blue-50 rounded">
            <p className="text-sm font-semibold text-gray-700 mb-2">Proposed time:</p>
            <p className="text-sm text-gray-600 mb-3">
              {formatDateTimeDisplay(schedule?.scheduled_datetime)}
            </p>
            {isConfirmed ? (
              <p className="text-sm text-green-600 font-semibold">✅ Confirmed by both</p>
            ) : (
              <p className="text-sm text-orange-600 font-semibold">
                ⏳ Awaiting confirmation
              </p>
            )}
          </div>
        )}

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

        {/* Proposal form - only show if no confirmed schedule and user needs to confirm or no proposal yet */}
        {!isConfirmed && (userNeedsToConfirm || !hasProposal) && (
          <div className="mb-6 space-y-4">
            {userNeedsToConfirm && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                ⏳ Your opponent proposed a time. You can confirm it or propose a different time.
              </div>
            )}
            
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
          {!isConfirmed && (userNeedsToConfirm || !hasProposal) && (
            <button
              onClick={userNeedsToConfirm ? handleConfirm : handlePropose}
              disabled={loading || !selectedDate || !selectedTime}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded font-semibold hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '...' : userNeedsToConfirm ? '✅ Confirm' : '📅 Propose'}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded font-semibold hover:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isConfirmed ? 'Close' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleProposalModal;
