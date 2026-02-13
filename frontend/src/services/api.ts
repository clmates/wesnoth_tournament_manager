import axios, { AxiosError } from 'axios';

// Determine API URL based on environment
let API_URL: string;

// Check hostname first (more specific than environment variables)
if (window.location.hostname === 'main.wesnoth-tournament-manager.pages.dev') {
  // Main branch preview on Cloudflare
  API_URL = 'https://wesnothtournamentmanager-main.up.railway.app/api';
} else if (window.location.hostname === 'wesnoth-tournament-manager.pages.dev') {
  // Production environment (production branch on Cloudflare)
  API_URL = 'https://wesnothtournamentmanager-production.up.railway.app/api';
} else if (window.location.hostname === 'wesnoth.playranked.org') {
  // Custom domain production - use production backend
  API_URL = 'https://wesnothtournamentmanager-production.up.railway.app/api';
} else if (window.location.hostname.includes('feature-unranked-tournaments')) {
  // PR preview on Cloudflare (feature-unranked-tournaments.wesnoth-tournament-manager.pages.dev)
  API_URL = 'https://wesnothtournamentmanager-wesnothtournamentmanager-pr-1.up.railway.app/api';
} else if (import.meta.env.VITE_API_URL) {
  // Explicit environment variable as fallback
  API_URL = import.meta.env.VITE_API_URL;
} else {
  // Development/fallback
  API_URL = '/api';
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Don't add cache busting for public endpoints - they should be cached
  // Only add for authenticated requests
  if (config.method === 'get' && token) {
    config.params = config.params || {};
    config.params._t = Date.now();
  }
  
  return config;
});

// Retry logic for rate limiting (429) and server errors
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config;
    
    // Don't retry if no config or if it's not a GET request
    if (!config || config.method !== 'get') {
      return Promise.reject(error);
    }
    
    // Check if we should retry
    const status = error.response?.status;
    const retryCount = (config as any).__retryCount || 0;
    
    // Retry on 429 (Too Many Requests) or 5xx errors
    const shouldRetry = (status === 429 || (status && status >= 500)) && retryCount < retryConfig.maxRetries;
    
    if (shouldRetry) {
      (config as any).__retryCount = retryCount + 1;
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        retryConfig.baseDelay * Math.pow(2, retryCount),
        retryConfig.maxDelay
      );
      
      console.warn(`API error ${status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${retryConfig.maxRetries})`);
      
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      // Retry the request
      return api(config);
    }
    
    return Promise.reject(error);
  }
);

export const authService = {
  register: (data: any) => api.post('/auth/register', data),
  login: (usernameOrEmail: string, password: string) => {
    // Determine if input is email or nickname
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usernameOrEmail);
    
    return api.post('/auth/login', {
      nickname: isEmail ? undefined : usernameOrEmail,
      email: isEmail ? usernameOrEmail : undefined,
      password
    });
  },
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { oldPassword, newPassword }),
  requestPasswordReset: (data: { nickname: string; discord_id: string }) =>
    api.post('/auth/request-password-reset', data),
  checkDiscordPasswordResetAvailable: () =>
    api.get('/auth/discord-password-reset-available'),
};

export const userService = {
  getProfile: () => api.get('/users/profile'),
  updateDiscordId: (discordId: string) => api.put('/users/profile/discord', { discord_id: discordId }),
  updateProfile: (data: { country?: string; avatar?: string }) => 
    api.put('/users/profile/update', data),
  getUserStats: (id: string) => api.get(`/users/${id}/stats`),
  getUserMonthlyStats: (id: string) => api.get(`/users/${id}/stats/month`),
  getRecentMatches: (id: string) => api.get(`/users/${id}/matches`),
  getMatches: () => api.get('/matches'),
  searchUsers: (query: string) => api.get(`/users/search/${query}`),
  getGlobalRanking: (page: number = 1, filters?: any) => {
    const params: any = { page };
    if (filters) {
      if (filters.nickname) params.nickname = filters.nickname;
      if (filters.min_elo) params.min_elo = filters.min_elo;
      if (filters.max_elo) params.max_elo = filters.max_elo;
    }
    return api.get('/users/ranking/global', { params });
  },
  getAllUsers: () => api.get('/users/all'),
};

export const matchService = {
  reportMatch: (data: any) => api.post('/matches/report', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  reportMatchJson: (data: any) => api.post('/matches/report-json', data),
  confirmMatch: (id: string, data: any) => api.post(`/matches/${id}/confirm`, data),
  getAllMatches: (page: number = 1, filters?: any) => {
    const params: any = { page };
    if (filters) {
      if (filters.player) params.player = filters.player;
      if (filters.map) params.map = filters.map;
      if (filters.status) params.status = filters.status;
      if (filters.confirmed) params.confirmed = filters.confirmed;
    }
    return api.get('/matches', { params });
  },
  getUserMatches: (userId: string, page: number = 1, filters?: any) => {
    const params: any = { page };
    if (filters) {
      if (filters.player) params.player = filters.player;
      if (filters.map) params.map = filters.map;
      if (filters.status) params.status = filters.status;
      if (filters.faction) params.faction = filters.faction;
    }
    return api.get(`/users/${userId}/matches`, { params });
  },
  getPendingMatches: () => api.get('/matches/pending/user'),
  getAllPendingMatches: () => api.get('/matches/pending/all'),
  getAllDisputedMatches: () => api.get('/matches/disputed/all'),
  cancelOwnMatch: (id: string) => api.post(`/matches/${id}/cancel-own`),
  validateDispute: (id: string) => api.post(`/matches/admin/${id}/dispute`, { action: 'validate' }),
  rejectDispute: (id: string) => api.post(`/matches/admin/${id}/dispute`, { action: 'reject' }),
  incrementReplayDownloads: (matchId: string) => api.post(`/matches/${matchId}/replay/download-count`),
};

export const tournamentService = {
  createTournament: (data: any) => api.post('/tournaments', data),
  getTournament: (id: string) => api.get(`/tournaments/${id}`),
  updateTournament: (id: string, data: any) => api.put(`/tournaments/${id}`, data),
  deleteTournament: (id: string) => api.delete(`/tournaments/${id}`),
  prepareTournament: (id: string) => api.post(`/tournaments/${id}/prepare`),
  startTournament: (id: string) => api.post(`/tournaments/${id}/start`),
  closeRegistration: (id: string, confirm?: boolean) => 
    api.post(`/tournaments/${id}/close-registration`, confirm ? { confirm: true } : {}),
  getAllTournaments: () => api.get('/tournaments'),
  getMyTournaments: () => api.get('/tournaments/my'),
  joinTournament: (id: string) => api.post(`/tournaments/${id}/join`),
  requestJoinTournament: (id: string, data?: { team_name?: string; teammate_name?: string }) => 
    api.post(`/tournaments/${id}/request-join`, data || {}),
  getTournamentRounds: (id: string) => api.get(`/tournaments/${id}/rounds`),
  getTournamentRanking: (id: string) => api.get(`/tournaments/${id}/ranking`),
  getTournamentStandings: (id: string, roundId?: string) => 
    api.get(`/tournaments/${id}/standings`, { params: roundId ? { round_id: roundId } : {} }),
  calculateTournamentTiebreakers: (id: string) => api.post(`/tournaments/${id}/calculate-tiebreakers`, {}),
  calculateLeagueTiebreakers: (leagueId: string) => api.post(`/leagues/${leagueId}/calculate-tiebreakers`, {}),
  getTournamentMatches: (id: string) => api.get(`/tournaments/${id}/matches`),
  getTournamentRoundMatches: (id: string) => api.get(`/tournaments/${id}/round-matches`),
  getRoundMatches: (tournamentId: string, roundId: string) => 
    api.get(`/tournaments/${tournamentId}/rounds/${roundId}/matches`),
  recordMatchResult: (tournamentId: string, matchId: string, data: any) =>
    api.post(`/tournaments/${tournamentId}/matches/${matchId}/result`, data),
  determineMatchWinner: (tournamentId: string, matchId: string, data: any) =>
    api.post(`/tournaments/${tournamentId}/matches/${matchId}/determine-winner`, data),
  startNextRound: (id: string) => api.post(`/tournaments/${id}/next-round`),
  acceptParticipant: (tournamentId: string, participantId: string) => 
    api.post(`/tournaments/${tournamentId}/participants/${participantId}/accept`),
  confirmParticipation: (tournamentId: string, participantId: string) => 
    api.post(`/tournaments/${tournamentId}/participants/${participantId}/confirm`),
  rejectParticipant: (tournamentId: string, participantId: string) => 
    api.post(`/tournaments/${tournamentId}/participants/${participantId}/reject`),
};

export const adminService = {
  getRegistrationRequests: () => api.get('/admin/registration-requests'),
  approveRegistration: (id: string, password: string) =>
    api.post(`/admin/registration-requests/${id}/approve`, { password }),
  rejectRegistration: (id: string) => api.post(`/admin/registration-requests/${id}/reject`),
  
  // User management
  getAllUsers: () => api.get('/admin/users'),
  blockUser: (id: string) => api.post(`/admin/users/${id}/block`),
  unblockUser: (id: string) => api.post(`/admin/users/${id}/unblock`),
  unlockAccount: (id: string) => api.post(`/admin/users/${id}/unlock`),
  makeAdmin: (id: string) => api.post(`/admin/users/${id}/make-admin`),
  removeAdmin: (id: string) => api.post(`/admin/users/${id}/remove-admin`),

  // Maintenance mode
  getMaintenanceStatus: () => api.get('/admin/maintenance-status'),
  toggleMaintenance: (enable: boolean, reason?: string) =>
    api.post('/admin/toggle-maintenance', { enable, reason }),
  getMaintenanceLogs: (limit?: number) =>
    api.get('/admin/maintenance-logs', { params: limit ? { limit } : {} }),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  forceResetPassword: (id: string) => api.post(`/admin/users/${id}/force-reset-password`),
  resendVerificationEmail: (id: string) => api.post(`/admin/users/${id}/resend-verification-email`),
  recalculateAllStats: () => api.post('/admin/recalculate-all-stats'),
  
  // Audit logs
  getAuditLogs: (params?: any) => api.get('/admin/audit-logs', { params }),
  deleteAuditLogs: (logIds: string[]) => api.delete('/admin/audit-logs', { data: { logIds } }),
  deleteOldAuditLogs: (daysBack: number) => api.delete('/admin/audit-logs/old', { data: { daysBack } }),
  
  // Password policy
  updatePasswordPolicy: (data: any) => api.put('/admin/password-policy', data),
  
  // News/Announcements
  getNews: () => api.get('/admin/news'),
  createNews: (data: any) => api.post('/admin/news', data),
  updateNews: (id: string, data: any) => api.put(`/admin/news/${id}`, data),
  deleteNews: (id: string) => api.delete(`/admin/news/${id}`),
  
  // FAQ
  getFaq: () => api.get('/admin/faq'),
  createFaq: (data: any) => api.post('/admin/faq', data),
  updateFaq: (id: string, data: any) => api.put(`/admin/faq/${id}`, data),
  deleteFaq: (id: string) => api.delete(`/admin/faq/${id}`),
};

// Public API endpoints (no auth required)
export const publicService = {
  getFaqByLanguage: (language: string) => api.get(`/public/faq`), // Now returns all languages, frontend handles fallback
  getFaq: () => api.get('/public/faq'), // Get all FAQ items (all languages)
  getNews: () => api.get('/public/news'),
  getRecentMatches: () => api.get('/public/matches/recent'),
  getPlayerProfile: (id: string) => api.get(`/public/players/${id}`),
  getFactions: (rankedOnly: boolean = true) => api.get('/public/factions', { params: { is_ranked: rankedOnly } }),
  getAllMatches: (page: number = 1, filters?: any) => {
    const params: any = { page };
    if (filters) {
      if (filters.player) params.player = filters.player;
      if (filters.map) params.map = filters.map;
      if (filters.status) params.status = filters.status;
      if (filters.confirmed) params.confirmed = filters.confirmed;
      if (filters.faction) params.faction = filters.faction;
    }
    return api.get('/public/matches', { params });
  },
  getAllPlayers: (page: number = 1, filters?: any) => {
    const params: any = { page };
    if (filters) {
      if (filters.nickname) params.nickname = filters.nickname;
      if (filters.min_elo) params.min_elo = filters.min_elo;
      if (filters.max_elo) params.max_elo = filters.max_elo;
      if (filters.min_matches) params.min_matches = filters.min_matches;
      if (filters.rated_only) params.rated_only = filters.rated_only;
    }
    return api.get('/public/players', { params });
  },
  getTournaments: (page: number = 1, filters?: any) => {
    const params: any = { page };
    if (filters) {
      if (filters.name) params.name = filters.name;
      if (filters.status) params.status = filters.status;
      if (filters.type) params.type = filters.type;
      if (filters.my_tournaments) params.my_tournaments = filters.my_tournaments;
    }
    return api.get('/public/tournaments', { params });
  },
  getTournamentById: (id: string) => api.get(`/public/tournaments/${id}`),
  getTournamentParticipants: (id: string) => api.get(`/public/tournaments/${id}/participants`),
  getTournamentMatches: (id: string) => api.get(`/public/tournaments/${id}/matches`),
  getTournamentUnrankedAssets: (id: string) => api.get(`/public/tournaments/${id}/unranked-assets`),
  getMatch: (id: string) => api.get(`/matches/${id}`),
  getDebug: () => api.get('/public/debug'),
  getPlayerOfMonth: () => api.get('/public/player-of-month'),
};

export { api };
export default api;
