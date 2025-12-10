import axios from 'axios';

const API_URL = '/api';

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
  
  // Disable caching for GET requests by adding a timestamp parameter
  if (config.method === 'get') {
    config.params = config.params || {};
    config.params._t = Date.now();
  }
  
  return config;
});

export const authService = {
  register: (data: any) => api.post('/auth/register', data),
  login: (nickname: string, password: string) => api.post('/auth/login', { nickname, password }),
  changePassword: (oldPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { oldPassword, newPassword }),
};

export const userService = {
  getProfile: () => api.get('/users/profile'),
  updateDiscordId: (discordId: string) => api.put('/users/profile/discord', { discord_id: discordId }),
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
  confirmMatch: (id: string, data: any) => api.post(`/matches/${id}/confirm`, data),
  getAllMatches: (page: number = 1, filters?: any) => {
    const params: any = { page };
    if (filters) {
      if (filters.winner) params.winner = filters.winner;
      if (filters.loser) params.loser = filters.loser;
      if (filters.map) params.map = filters.map;
      if (filters.status) params.status = filters.status;
      if (filters.confirmed) params.confirmed = filters.confirmed;
    }
    return api.get('/matches', { params });
  },
  getPendingMatches: () => api.get('/matches/pending/user'),
  getAllPendingMatches: () => api.get('/matches/pending/all'),
  getAllDisputedMatches: () => api.get('/matches/disputed/all'),
  validateDispute: (id: string) => api.post(`/matches/admin/${id}/dispute`, { action: 'validate' }),
  rejectDispute: (id: string) => api.post(`/matches/admin/${id}/dispute`, { action: 'reject' }),
  incrementReplayDownloads: (matchId: string) => api.post(`/matches/${matchId}/replay/download-count`),
};

export const tournamentService = {
  createTournament: (data: any) => api.post('/tournaments', data),
  getTournament: (id: string) => api.get(`/tournaments/${id}`),
  updateTournament: (id: string, data: any) => api.put(`/tournaments/${id}`, data),
  startTournament: (id: string) => api.post(`/tournaments/${id}/start`),
  getAllTournaments: () => api.get('/tournaments'),
  getMyTournaments: () => api.get('/tournaments/my'),
  joinTournament: (id: string) => api.post(`/tournaments/${id}/join`),
  requestJoinTournament: (id: string) => api.post(`/tournaments/${id}/request-join`),
  getTournamentRounds: (id: string) => api.get(`/tournaments/${id}/rounds`),
  getTournamentRanking: (id: string) => api.get(`/tournaments/${id}/ranking`),
  getTournamentMatches: (id: string) => api.get(`/tournaments/${id}/matches`),
  getTournamentRoundMatches: (id: string) => api.get(`/tournaments/${id}/round-matches`),
  getRoundMatches: (tournamentId: string, roundId: string) => 
    api.get(`/tournaments/${tournamentId}/rounds/${roundId}/matches`),
  recordMatchResult: (tournamentId: string, matchId: string, data: any) =>
    api.post(`/tournaments/${tournamentId}/matches/${matchId}/result`, data),
  determineMatchWinner: (tournamentId: string, matchId: string, data: any) =>
    api.post(`/tournaments/${tournamentId}/matches/${matchId}/determine-winner`, data),
  acceptParticipant: (tournamentId: string, participantId: string) => 
    api.post(`/tournaments/${tournamentId}/participants/${participantId}/accept`),
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
  makeAdmin: (id: string) => api.post(`/admin/users/${id}/make-admin`),
  removeAdmin: (id: string) => api.post(`/admin/users/${id}/remove-admin`),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  forceResetPassword: (id: string) => api.post(`/admin/users/${id}/force-reset-password`),
  recalculateAllStats: () => api.post('/admin/recalculate-all-stats'),
  
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
  getAllMatches: (page: number = 1, filters?: any) => {
    const params: any = { page };
    if (filters) {
      if (filters.winner) params.winner = filters.winner;
      if (filters.loser) params.loser = filters.loser;
      if (filters.map) params.map = filters.map;
      if (filters.status) params.status = filters.status;
      if (filters.confirmed) params.confirmed = filters.confirmed;
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
    }
    return api.get('/public/tournaments', { params });
  },
  getTournamentById: (id: string) => api.get(`/public/tournaments/${id}`),
  getTournamentParticipants: (id: string) => api.get(`/public/tournaments/${id}/participants`),
  getTournamentMatches: (id: string) => api.get(`/public/tournaments/${id}/matches`),
  getMatch: (id: string) => api.get(`/matches/${id}`),
};

export default api;
