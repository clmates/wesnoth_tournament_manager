import { create } from 'zustand';

interface User {
  id: string;
  nickname: string;
  email?: string;
  elo_rating?: number;
  level?: string;
}

interface AuthState {
  token: string | null;
  userId: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setToken: (token: string) => void;
  setUserId: (userId: string) => void;
  setUser: (user: User) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  userId: localStorage.getItem('userId'),
  user: null,
  isAuthenticated: !!localStorage.getItem('token'),
  isAdmin: localStorage.getItem('isAdmin') === 'true',

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
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('isAdmin');
    set({ token: null, userId: null, user: null, isAuthenticated: false, isAdmin: false });
  },
}));
