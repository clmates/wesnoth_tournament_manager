import React, { useEffect } from 'react';
import { useNotificationStore, Toast } from '../stores/notificationStore';
import '../styles/Toast.css';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useNotificationStore();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'schedule_proposal':
        return '🗓️';
      case 'schedule_confirmed':
        return '✅';
      case 'schedule_cancelled':
        return '❌';
      case 'success':
        return '✨';
      case 'error':
        return '⚠️';
      default:
        return '📬';
    }
  };

  const getToastClass = (type: Toast['type']) => {
    switch (type) {
      case 'schedule_proposal':
        return 'toast toast-proposal';
      case 'schedule_confirmed':
        return 'toast toast-confirmed';
      case 'schedule_cancelled':
        return 'toast toast-cancelled';
      case 'success':
        return 'toast toast-success';
      case 'error':
        return 'toast toast-error';
      default:
        return 'toast';
    }
  };

  return (
    <div className={getToastClass(toast.type)}>
      <div className="toast-icon">{getIcon(toast.type)}</div>
      <div className="toast-content">
        <div className="toast-title">{toast.title}</div>
        <div className="toast-message">{toast.message}</div>
      </div>
      <button className="toast-close" onClick={() => onRemove(toast.id)}>
        ✕
      </button>
    </div>
  );
};
