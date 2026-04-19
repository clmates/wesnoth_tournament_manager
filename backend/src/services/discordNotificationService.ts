/**
 * Discord Notification Helper for Tournament Scheduling
 * Sends notifications to Discord webhook (public channel)
 * Database notifications are handled separately when users access the app
 */

import axios from 'axios';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const DISCORD_API_URL = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const TOURNAMENT_NOTIFICATIONS_WEBHOOK = process.env.DISCORD_NOTIFICATIONS_WEBHOOK;
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
 * Send a Discord notification to the tournament channel webhook
 * Database notifications are stored separately and shown when users access the app
 */
export async function sendDiscordNotification(
  message: string,
  tournamentId: string,
  notificationType: 'schedule_proposal' | 'schedule_confirmed'
): Promise<boolean> {
  if (!DISCORD_ENABLED) {
    console.log('⏭️  Discord disabled, skipping Discord webhook notification');
    return true;
  }

  try {
    // Send to Discord webhook (public tournament channel)
    if (TOURNAMENT_NOTIFICATIONS_WEBHOOK) {
      const color = notificationType === 'schedule_proposal' ? 0xffa500 : 0x00ff00; // Orange for proposal, green for confirmed

      const embed = {
        description: message,
        color,
        footer: {
          text: notificationType === 'schedule_proposal' ? 'Schedule Proposal' : 'Schedule Confirmed',
        },
        timestamp: new Date().toISOString(),
      };

      const payload = {
        embeds: [embed],
      };

      const response = await axios.post(TOURNAMENT_NOTIFICATIONS_WEBHOOK, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      console.log(`✅ Discord notification sent (${notificationType})`);
      return true;
    }

    console.log(`📝 [Notification] ${notificationType}: ${message}`);
    return false;
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
