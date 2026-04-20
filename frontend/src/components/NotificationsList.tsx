import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface Notification {
  id: string;
  user_id: string;
  tournament_id: string;
  match_id: string;
  type: 'schedule_proposal' | 'schedule_confirmed' | 'schedule_cancelled';
  title: string;
  message: string;
  message_extra?: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsListProps {
  filter?: 'all' | 'pending' | 'accepted';
  onNotificationDeleted?: () => void;
  onNotificationRead?: () => void;
}

const NotificationsList: React.FC<NotificationsListProps> = ({
  filter = 'all',
  onNotificationDeleted,
  onNotificationRead,
}) => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageOffset, setPageOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadNotifications();
  }, [filter, pageOffset]);

  const getEndpoint = () => {
    switch (filter) {
      case 'pending':
        return '/api/notifications/pending';
      case 'accepted':
        return '/api/notifications/accepted';
      default:
        return '/api/notifications';
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const endpoint = getEndpoint();
      const url = filter === 'all'
        ? `${endpoint}?limit=${ITEMS_PER_PAGE}&offset=${pageOffset}`
        : `${endpoint}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load notifications');
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
      if (data.pagination) {
        setTotal(data.pagination.total);
      }
      setError('');
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notifications/${notificationId}/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(
          notifications.map(n =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        if (onNotificationRead) {
          onNotificationRead();
        }
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notifications/${notificationId}/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== notificationId));
        if (onNotificationDeleted) {
          onNotificationDeleted();
        }
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'schedule_proposal':
        return '📅';
      case 'schedule_confirmed':
        return '✅';
      case 'schedule_cancelled':
        return '❌';
      default:
        return '📬';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading notifications...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">❌ {error}</div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
        <div className="text-gray-600">
          {filter === 'pending' && 'No pending notifications'}
          {filter === 'accepted' && 'No accepted notifications'}
          {filter === 'all' && 'No notifications'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`border rounded-lg p-4 transition-colors ${
            notification.is_read
              ? 'bg-white border-gray-200'
              : 'bg-blue-50 border-blue-200'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                <h3 className="font-semibold text-gray-900">{notification.title}</h3>
                {!notification.is_read && (
                  <span className="inline-block w-2 h-2 bg-blue-600 rounded-full ml-auto" />
                )}
              </div>

              <p className="text-gray-700 mb-2">{notification.message}</p>

              {notification.message_extra && (
                <div className="bg-gray-100 rounded p-3 mb-2 border-l-4 border-blue-500">
                  <p className="text-sm text-gray-700 italic">
                    <strong>Message:</strong> {notification.message_extra}
                  </p>
                </div>
              )}

              <div className="text-xs text-gray-500">
                {formatDate(notification.created_at)}
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              {!notification.is_read && (
                <button
                  onClick={() => handleMarkAsRead(notification.id)}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  title="Mark as read"
                >
                  ✓
                </button>
              )}
              <button
                onClick={() => handleDelete(notification.id)}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                title="Delete"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      ))}

      {filter === 'all' && total > ITEMS_PER_PAGE && (
        <div className="flex gap-2 justify-center mt-6">
          <button
            onClick={() => setPageOffset(Math.max(0, pageOffset - ITEMS_PER_PAGE))}
            disabled={pageOffset === 0}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {pageOffset + 1} - {Math.min(pageOffset + ITEMS_PER_PAGE, total)} of {total}
            </span>
          </div>
          <button
            onClick={() => setPageOffset(pageOffset + ITEMS_PER_PAGE)}
            disabled={pageOffset + ITEMS_PER_PAGE >= total}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsList;
