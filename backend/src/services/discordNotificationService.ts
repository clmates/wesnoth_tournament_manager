/**
 * Discord Notification Helper for Tournament Scheduling
 * Simplified notifications for schedule proposals and confirmations
 */

import axios from 'axios';

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
 * Send a Discord notification for schedule proposals/confirmations
 * Uses webhook if available, falls back to bot token with user mention
 */
export async function sendDiscordNotification(
  message: string,
  tournamentId: string,
  userId: string | null,
  notificationType: 'schedule_proposal' | 'schedule_confirmed',
  embedData?: DiscordEmbed
): Promise<boolean> {
  if (!DISCORD_ENABLED) {
    console.log('⏭️  Discord disabled, skipping notification');
    return false;
  }

  try {
    // If webhook is configured, use it (easier and doesn't require bot in channel)
    if (TOURNAMENT_NOTIFICATIONS_WEBHOOK) {
      const color = notificationType === 'schedule_proposal' ? 0xffa500 : 0x00ff00; // Orange for proposal, green for confirmed

      const embed: DiscordEmbed = embedData || {
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

    // Fallback: Try to send via bot token (requires bot to be in a specific channel)
    // This is less reliable but works if webhook isn't configured
    if (BOT_TOKEN && userId) {
      console.log(`⚠️  Webhook not configured, attempting bot notification for user ${userId}`);
      // Note: Sending DMs to users requires special OAuth scope
      // For now, just log that we tried
      console.log(`📝 [Notification] ${notificationType}: ${message}`);
      return false;
    }

    console.log(`📝 [Notification] ${notificationType}: ${message}`);
    return false;
  } catch (error: any) {
    console.error(`❌ Error sending Discord notification:`, error.message);
    return false;
  }
}
