/**
 * Frontend Service for Notifications
 * Queries the backend for unread notifications stored in the database
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Notification {
  id: string;
  user_id: string;
  tournament_id: string;
  match_id: string;
  type: 'schedule_proposal' | 'schedule_confirmed';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Fetch unread notifications for the current user
 */
export async function getUnreadNotifications(): Promise<Notification[]> {
  try {
    const response = await fetch(`${API_BASE}/notifications/unread`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      console.error('❌ Failed to fetch unread notifications');
      return [];
    }

    const data = await response.json();
    return data.notifications || [];
  } catch (error) {
    console.error('❌ Error fetching unread notifications:', error);
    return [];
  }
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/notifications/${notificationId}/mark-read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      console.error('❌ Failed to mark notification as read');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all unread notifications as read
 */
export async function markAllAsRead(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/notifications/mark-all-read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      console.error('❌ Failed to mark all notifications as read');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    return false;
  }
}
