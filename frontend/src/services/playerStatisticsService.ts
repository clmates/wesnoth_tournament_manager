import axios from 'axios';

// Determine API URL based on environment at runtime (not build time)
const getApiBaseUrl = (): string => {
  if (window.location.hostname === 'main.wesnoth-tournament-manager.pages.dev') {
    return 'https://wesnothtournamentmanager-main.up.railway.app/api';
  } else if (window.location.hostname === 'wesnoth-tournament-manager.pages.dev') {
    return 'https://wesnothtournamentmanager-production.up.railway.app/api';
  } else if (window.location.hostname.includes('feature-unranked-tournaments')) {
    return 'https://wesnothtournamentmanager-wesnothtournamentmanager-pr-1.up.railway.app/api';
  } else if (window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1') {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    return apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
  } else {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    return apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
  }
};

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export const playerStatisticsService = {
  // Get global player statistics
  getGlobalStats: async (playerId: string) => {
    const response = await apiClient.get(`/player-statistics/player/${playerId}/global`);
    return response.data;
  },

  // Get player statistics by map
  getStatsByMap: async (playerId: string, minGames = 2) => {
    const response = await apiClient.get(`/player-statistics/player/${playerId}/by-map`, {
      params: { minGames },
    });
    return response.data;
  },

  // Get player statistics by faction
  getStatsByFaction: async (playerId: string, minGames = 2) => {
    const response = await apiClient.get(`/player-statistics/player/${playerId}/by-faction`, {
      params: { minGames },
    });
    return response.data;
  },

  // Get head-to-head vs specific opponent
  getHeadToHead: async (playerId: string, opponentId: string) => {
    const response = await apiClient.get(`/player-statistics/player/${playerId}/vs-player/${opponentId}`);
    return response.data;
  },

  // Get player stats on specific map
  getMapStats: async (playerId: string, mapId: string) => {
    const response = await apiClient.get(`/player-statistics/player/${playerId}/map/${mapId}`);
    return response.data;
  },

  // Get player stats with specific faction
  getFactionStats: async (playerId: string, factionId: string) => {
    const response = await apiClient.get(`/player-statistics/player/${playerId}/faction/${factionId}`);
    return response.data;
  },

  // Get player stats with faction on map
  getMapFactionStats: async (playerId: string, mapId: string, factionId: string) => {
    const response = await apiClient.get(`/player-statistics/player/${playerId}/map/${mapId}/faction/${factionId}`);
    return response.data;
  },

  // Get recent opponents
  getRecentOpponents: async (playerId: string, limit = 10) => {
    const response = await apiClient.get(`/player-statistics/player/${playerId}/recent-opponents`, {
      params: { limit },
    });
    return response.data;
  },
};
