import { api } from './api';

export const tournamentSchedulingService = {
  /**
   * Get all pending/in_progress matches available for scheduling
   */
  getPendingScheduleMatches: async (tournamentId: string) => {
    const response = await api.get(
      `/tournament-scheduling/${tournamentId}/matches-pending-schedule`
    );
    return response.data;
  },

  /**
   * Get schedule status for a match
   */
  getSchedule: async (tournamentRoundMatchId: string) => {
    const response = await api.get(
      `/tournament-scheduling/${tournamentRoundMatchId}/schedule`
    );
    return response.data;
  },

  /**
   * Propose a match schedule
   */
  proposeSchedule: async (tournamentRoundMatchId: string, scheduledDatetime: string, scheduleMessage?: string) => {
    const response = await api.post(
      `/tournament-scheduling/${tournamentRoundMatchId}/propose-schedule`,
      { 
        scheduled_datetime: scheduledDatetime,
        ...(scheduleMessage && { scheduleMessage })
      }
    );
    return response.data;
  },

  /**
   * Confirm a proposed schedule (can also counter-propose with a different time)
   */
  confirmSchedule: async (tournamentRoundMatchId: string, scheduledDatetime?: string, scheduleMessage?: string) => {
    const response = await api.post(
      `/tournament-scheduling/${tournamentRoundMatchId}/confirm-schedule`,
      {
        ...(scheduledDatetime && { scheduled_datetime: scheduledDatetime }),
        ...(scheduleMessage && { scheduleMessage })
      }
    );
    return response.data;
  },

  /**
   * Cancel/withdraw a schedule proposal or confirmation
   */
  cancelSchedule: async (tournamentRoundMatchId: string) => {
    const response = await api.post(
      `/tournament-scheduling/${tournamentRoundMatchId}/cancel-schedule`,
      {}
    );
    return response.data;
  },
};
