import { create } from 'zustand';

export interface Toast {
  id: string;
  type: 'schedule_proposal' | 'schedule_confirmed' | 'schedule_cancelled' | 'error' | 'success';
  title: string;
  message: string;
  matchId?: string;
  action?: 'confirm' | 'view' | 'cancel';
  timestamp: string;
}

interface NotificationStore {
  toasts: Toast[];
  addToast: (notification: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  toasts: [],

  addToast: (notification: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          ...notification,
          id,
        },
      ],
    }));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 5000);

    return id;
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: () => {
    set({ toasts: [] });
  },
}));
