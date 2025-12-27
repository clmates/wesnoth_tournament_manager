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
};
