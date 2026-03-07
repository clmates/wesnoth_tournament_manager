import { api } from './api.js';

export const playerStatisticsService = {
  // Get global player statistics
  getGlobalStats: async (playerId: string) => {
    const response = await api.get(`/player-statistics/player/${playerId}/global`);
    return response.data;
  },

  // Get player statistics by map
  getStatsByMap: async (playerId: string, minGames = 2) => {
    const response = await api.get(`/player-statistics/player/${playerId}/by-map`, {
      params: { minGames },
    });
    return response.data;
  },

  // Get player statistics by faction
  getStatsByFaction: async (playerId: string, minGames = 2) => {
    const response = await api.get(`/player-statistics/player/${playerId}/by-faction`, {
      params: { minGames },
    });
    return response.data;
  },

  // Get head-to-head vs specific opponent
  getHeadToHead: async (playerId: string, opponentId: string) => {
    const response = await api.get(`/player-statistics/player/${playerId}/vs-player/${opponentId}`);
    return response.data;
  },

  // Get player stats on specific map
  getMapStats: async (playerId: string, mapId: string) => {
    const response = await api.get(`/player-statistics/player/${playerId}/map/${mapId}`);
    return response.data;
  },

  // Get player stats with specific faction
  getFactionStats: async (playerId: string, factionId: string) => {
    const response = await api.get(`/player-statistics/player/${playerId}/faction/${factionId}`);
    return response.data;
  },

  // Get player stats with faction on map
  getMapFactionStats: async (playerId: string, mapId: string, factionId: string) => {
    const response = await api.get(`/player-statistics/player/${playerId}/map/${mapId}/faction/${factionId}`);
    return response.data;
  },

  // Get recent opponents
  getRecentOpponents: async (playerId: string, limit = 10) => {
    const response = await api.get(`/player-statistics/player/${playerId}/recent-opponents`, {
      params: { limit },
    });
    return response.data;
  },
};
