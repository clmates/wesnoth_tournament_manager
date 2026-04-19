import { Router, Response } from 'express';
import { query } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Check if in-app notifications are enabled
const NOTIFICATIONS_ENABLED = process.env.NOTIFICATIONS_ENABLED !== 'false';

console.log(`🔧 Registering notifications routes (Enabled: ${NOTIFICATIONS_ENABLED})`);

/**
 * GET /unread
 * Get all unread notifications for the current user
 */
router.get('/unread', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Return empty array if notifications are disabled
    if (!NOTIFICATIONS_ENABLED) {
      return res.json({
        success: true,
        notifications: [],
      });
    }

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await query(
      `SELECT id, user_id, tournament_id, match_id, type, title, message, is_read, created_at
       FROM user_notifications
       WHERE user_id = ? AND is_read = false
       ORDER BY created_at DESC`,
      [userId]
    );

    const notifications = result.rows || [];
    console.log(`✅ Retrieved ${notifications.length} unread notifications for user ${userId}`);

    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error('❌ Error fetching unread notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /:notificationId/mark-read
 * Mark a specific notification as read
 */
router.post('/:notificationId/mark-read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    if (!userId || !notificationId) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    // Verify ownership of notification
    const notificationResult = await query(
      'SELECT user_id FROM user_notifications WHERE id = ?',
      [notificationId]
    );

    if (!notificationResult.rows || notificationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    if (notificationResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Mark as read
    await query(
      'UPDATE user_notifications SET is_read = true WHERE id = ?',
      [notificationId]
    );

    console.log(`✅ Marked notification ${notificationId} as read`);

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /mark-all-read
 * Mark all unread notifications as read for the current user
 */
router.post('/mark-all-read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await query(
      'UPDATE user_notifications SET is_read = true WHERE user_id = ? AND is_read = false',
      [userId]
    );

    const affectedRows = (result as any).affectedRows || 0;
    console.log(`✅ Marked ${affectedRows} notifications as read for user ${userId}`);

    res.json({
      success: true,
      message: `Marked ${affectedRows} notifications as read`,
    });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
