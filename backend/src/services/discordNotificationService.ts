/**
 * Discord Notification Helper for Tournament Scheduling
 * Sends notifications to Discord tournament threads via Bot Token
 * Database notifications are handled separately when users access the app
 */

import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import discordService from './discordService.js';

const DISCORD_ENABLED = process.env.DISCORD_ENABLED === 'true';

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

/**
 * Send a Discord notification to the tournament thread
 * Gets the thread ID from the tournaments table
 * Database notifications are stored separately and shown when users access the app
 */
export async function sendDiscordNotification(
  message: string,
  tournamentId: string,
  notificationType: 'schedule_proposal' | 'schedule_confirmed'
): Promise<boolean> {
  if (!DISCORD_ENABLED) {
    console.log('⏭️  Discord disabled, skipping Discord notification');
    return true;
  }

  try {
    // Get tournament thread ID from database
    const tournamentResult = await query(
      'SELECT discord_thread_id FROM tournaments WHERE id = ?',
      [tournamentId]
    );

    if (!tournamentResult.rows || tournamentResult.rows.length === 0) {
      console.log('⚠️  Tournament not found in database');
      return false;
    }

    const threadId = tournamentResult.rows[0].discord_thread_id;
    if (!threadId) {
      console.log('⚠️  No Discord thread ID for this tournament');
      return false;
    }

    // Format message as Discord embed
    const color = notificationType === 'schedule_proposal' ? 0xffa500 : 0x00ff00; // Orange for proposal, green for confirmed
    const title = notificationType === 'schedule_proposal' ? '🗓️ Schedule Proposal' : '✅ Schedule Confirmed';
    
    const discordMessage = {
      embeds: [{
        title: title,
        description: message,
        color,
        footer: {
          text: notificationType === 'schedule_proposal' ? 'Schedule Proposal' : 'Schedule Confirmed',
        },
        timestamp: new Date().toISOString(),
      }],
    };

    // Send to Discord thread
    const success = await discordService.publishTournamentMessage(threadId, discordMessage);
    
    if (success) {
      console.log(`✅ Discord notification sent to thread ${threadId} (${notificationType})`);
      return true;
    } else {
      console.log(`⚠️  Failed to send Discord notification to thread`);
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Error sending Discord notification:`, error.message);
    return false;
  }
}

/**
 * Store a notification in the database to be shown as a toast when users access the app
 */
export async function storeNotificationForUsers(
  userIds: string[],
  tournamentId: string,
  matchId: string,
  type: 'schedule_proposal' | 'schedule_confirmed',
  title: string,
  message: string
): Promise<boolean> {
  try {
    for (const userId of userIds) {
      const notificationId = uuidv4();
      await query(
        `INSERT INTO user_notifications (id, user_id, tournament_id, match_id, type, title, message, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?, false)`,
        [notificationId, userId, tournamentId, matchId, type, title, message]
      );
    }
    console.log(`✅ Stored ${userIds.length} notification(s) in database`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error storing notifications:`, error.message);
    return false;
  }
}
