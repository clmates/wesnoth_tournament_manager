import { create } from 'zustand';
import type { User } from '../types/index.js';
import api from '../services/api.js';

interface AuthState {
  token: string | null;
  userId: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isValidating: boolean;
  setToken: (token: string) => void;
  setUserId: (userId: string) => void;
  setUser: (user: User) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  logout: () => void;
  validateToken: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  userId: localStorage.getItem('userId'),
  user: null,
  isAuthenticated: !!localStorage.getItem('token'),
  isAdmin: localStorage.getItem('isAdmin') === 'true',
  isValidating: false,

  setToken: (token: string) => {
    localStorage.setItem('token', token);
    set({ token, isAuthenticated: true });
  },

  setUserId: (userId: string) => {
    localStorage.setItem('userId', userId);
    set({ userId });
  },

  setUser: (user: User) => {
    set({ user });
  },

  setIsAdmin: (isAdmin: boolean) => {
    localStorage.setItem('isAdmin', isAdmin.toString());
    set({ isAdmin });
  },

  logout: () => {
    // Clear all auth-related localStorage items
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('user');
    // Also clear sessionStorage just in case
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('isAdmin');
    set({ token: null, userId: null, user: null, isAuthenticated: false, isAdmin: false });
  },

  validateToken: async () => {
    const state = get();
    
    // If no token, nothing to validate
    if (!state.token) {
      return false;
    }

    set({ isValidating: true });

    try {
      const response = await api.get('/auth/validate-token');
      
      if (response.data && response.data.valid) {
        // Token is valid, update user info if needed
        if (response.data.nickname && !state.user) {
          set({ 
            user: { 
              id: response.data.userId,
              nickname: response.data.nickname,
              email: response.data.email,
            } as User 
          });
        }
        set({ isValidating: false });
        return true;
      }
      
      // Invalid response
      state.logout();
      set({ isValidating: false });
      return false;
    } catch (error: any) {
      // Token validation failed (401 or error)
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Token is invalid or user is blocked
        state.logout();
      }
      set({ isValidating: false });
      return false;
    }
  },
}));
