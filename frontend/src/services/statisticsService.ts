import axios from 'axios';

// Use the same API URL configuration as the main api service
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export const statisticsService = {
  // Get faction statistics by map
  getFactionByMapStats: async () => {
    const response = await apiClient.get('/statistics/faction-by-map');
    return response.data;
  },

  // Get matchup statistics (unbalanced matchups)
  getMatchupStats: async (minGames = 5) => {
    const response = await apiClient.get('/statistics/matchups', {
      params: { minGames },
    });
    return response.data;
  },

  // Get global faction winrates
  getGlobalFactionStats: async () => {
    const response = await apiClient.get('/statistics/faction-global');
    return response.data;
  },

  // Get map balance statistics
  getMapBalanceStats: async () => {
    const response = await apiClient.get('/statistics/map-balance');
    return response.data;
  },

  // Get statistics for a specific faction
  getFactionStats: async (factionId: string) => {
    const response = await apiClient.get(`/statistics/faction/${factionId}`);
    return response.data;
  },

  // Get statistics for a specific map
  getMapStats: async (mapId: string) => {
    const response = await apiClient.get(`/statistics/map/${mapId}`);
    return response.data;
  },

  // ===== BALANCE HISTORY =====
  
  // Get balance events with optional filters
  getBalanceEvents: async (filters?: { factionId?: string; mapId?: string; eventType?: string; limit?: number; offset?: number }) => {
    const response = await apiClient.get('/statistics/history/events', { params: filters });
    return response.data;
  },

  // Get balance trend for a specific matchup over date range
  getBalanceTrend: async (mapId: string, factionId: string, opponentFactionId: string, dateFrom: string, dateTo: string) => {
    const response = await apiClient.get('/statistics/history/trend', {
      params: { mapId, factionId, opponentFactionId, dateFrom, dateTo },
    });
    return response.data;
  },

  // Get balance event impact (before/after comparison)
  getEventImpact: async (eventId: string, daysBefore = 30, daysAfter = 30) => {
    const response = await apiClient.get(`/statistics/history/events/${eventId}/impact`, {
      params: { daysBefore, daysAfter },
    });
    return response.data;
  },

  // Create a new balance event (admin only)
  createBalanceEvent: async (event: {
    event_date: string;
    event_type: 'BUFF' | 'NERF' | 'REWORK' | 'HOTFIX' | 'GENERAL_BALANCE_CHANGE';
    description: string;
    faction_id?: string;
    map_id?: string;
    patch_version?: string;
    notes?: string;
  }) => {
    const response = await apiClient.post('/statistics/history/events', event);
    return response.data;
  },

  // Get snapshot for a specific date
  getSnapshot: async (date: string, minGames = 2) => {
    const response = await apiClient.get('/statistics/history/snapshot', {
      params: { date, minGames },
    });
    return response.data;
  },
};
