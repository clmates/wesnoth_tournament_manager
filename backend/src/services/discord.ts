import axios from 'axios';

const DISCORD_WEBHOOK_URL_ADMIN = process.env.DISCORD_WEBHOOK_URL_ADMIN || 'https://discord.com/api/webhooks/1451903758408614021/YZsof0mktnEB_C7GcpFcIyD7Tc6v2g63dR_bqFQJYqrZRrlzNw6LPYBFfCAOHOurHZRt';
const DISCORD_WEBHOOK_URL_USERS = process.env.DISCORD_WEBHOOK_URL_USERS || 'https://discord.com/api/webhooks/1451906911900274791/HLp96wiBX5AkZe4A86dSAz5rbJMddDDNM1SVzHGN0h8ekoWdZJ7_Sg0d4x_di54gaMyw';

// Check if Discord is explicitly enabled via environment variable AND at least one webhook URL is configured
export const DISCORD_ENABLED = 
  process.env.DISCORD_ENABLED === 'true' && 
  !!(process.env.DISCORD_WEBHOOK_URL_ADMIN || process.env.DISCORD_WEBHOOK_URL_USERS);

/**
 * Resolve Discord username (username#discriminator) to numeric Discord ID
 * Searches in the guild to find the user by username
 */
export async function resolveDiscordIdFromUsername(usernameInput: string): Promise<string | null> {
  console.log('[DISCORD-RESOLVE] Attempting to resolve username to ID:', usernameInput);

  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) {
    console.warn('[DISCORD-RESOLVE] Bot token or guild ID not configured');
    return null;
  }

  // If input looks like numeric ID already, return it
  if (/^\d+$/.test(usernameInput)) {
    console.log('[DISCORD-RESOLVE] Input is already numeric ID:', usernameInput);
    return usernameInput;
  }

  try {
    const DISCORD_API_URL = 'https://discord.com/api/v10';
    const guildId = process.env.DISCORD_GUILD_ID;
    const headers = {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    };

    // Extract username from "username#discriminator" or just "username"
    const username = usernameInput.split('#')[0];

    console.log('[DISCORD-RESOLVE] Searching for username in guild:', {
      guildId,
      searchQuery: username,
      originalInput: usernameInput
    });

    // Search for members in guild by username
    const response = await axios.get(
      `${DISCORD_API_URL}/guilds/${guildId}/members/search`,
      {
        headers,
        params: { query: username, limit: 10 }
      }
    );

    const members = response.data;

    if (!members || members.length === 0) {
      console.warn('[DISCORD-RESOLVE] No members found with username:', username);
      return null;
    }

    console.log('[DISCORD-RESOLVE] Members found:', members.map((m: any) => ({
      id: m.user.id,
      username: m.user.username,
      discriminator: m.user.discriminator,
      fullTag: `${m.user.username}#${m.user.discriminator}`
    })));

    // Find exact match (considering both username and discriminator)
    let targetMember = null;

    if (usernameInput.includes('#')) {
      // Search for exact username#discriminator match
      const [searchUsername, searchDiscriminator] = usernameInput.split('#');
      console.log('[DISCORD-RESOLVE] Looking for exact match:', {
        searchUsername: searchUsername.toLowerCase(),
        searchDiscriminator
      });
      
      targetMember = members.find((m: any) => {
        const match = m.user.username.toLowerCase() === searchUsername.toLowerCase() &&
                      m.user.discriminator === searchDiscriminator;
        if (!match) {
          console.log('[DISCORD-RESOLVE] Checked member:', {
            username: m.user.username,
            discriminator: m.user.discriminator,
            matched: match
          });
        }
        return match;
      });
      
      if (!targetMember) {
        console.warn('[DISCORD-RESOLVE] Exact username#discriminator not found, trying username-only match');
        // Fall back to username-only match if discriminator doesn't match
        targetMember = members.find((m: any) =>
          m.user.username.toLowerCase() === usernameInput.split('#')[0].toLowerCase()
        );
      }
    } else {
      // Just username, take first match
      console.log('[DISCORD-RESOLVE] Accepting first match for username (no discriminator specified)');
      targetMember = members[0];
    }

    if (!targetMember) {
      console.warn('[DISCORD-RESOLVE] No suitable member found for:', usernameInput);
      console.warn('[DISCORD-RESOLVE] Available members:', members.map((m: any) => `${m.user.username}#${m.user.discriminator}`));
      return null;
    }

    const discordId = targetMember.user.id;
    console.log('[DISCORD-RESOLVE] Successfully resolved username to ID:', {
      input: usernameInput,
      resolvedId: discordId,
      username: targetMember.user.username,
      discriminator: targetMember.user.discriminator
    });

    return discordId;
  } catch (error: any) {
    console.error('[DISCORD-RESOLVE] Error resolving username:', {
      input: usernameInput,
      httpStatus: error.response?.status,
      errorData: error.response?.data,
      errorMessage: error.message
    });
    return null;
  }
}

export async function notifyUserUnlocked(user: {
  nickname: string;
  discord_id?: string;
}) {
  console.log('🔔 notifyUserUnlocked called for:', user.nickname);
  console.log('📍 DISCORD_ENABLED:', DISCORD_ENABLED);
  console.log('📍 DISCORD_WEBHOOK_URL_USERS configured:', !!DISCORD_WEBHOOK_URL_USERS);
  if (!DISCORD_ENABLED || !DISCORD_WEBHOOK_URL_USERS) {
    console.warn('[DISCORD] Discord not enabled or webhook not configured - skipping user unlock notification');
    return;
  }

  const hasDiscordId = !!user.discord_id;
  const userMention = hasDiscordId ? `<@${user.discord_id}>` : `**${user.nickname}**`;

  const message = {
    content: `${userMention}`,
    embeds: [{
      title: '🔓 Account Unlocked!',
      description: `**${user.nickname}** unlocked! You can now login to the site.`,
      color: 0x2ecc71, // Green
      timestamp: new Date().toISOString(),
      footer: { text: 'Wesnoth Tournament Manager' }
    }]
  };

  try {
    console.log('📤 Sending Discord UNLOCK to users channel', {
      webhook: DISCORD_WEBHOOK_URL_USERS?.slice(0, 60) + '...',
      discord_id: user.discord_id,
      nickname: user.nickname,
    });
    const response = await axios.post(DISCORD_WEBHOOK_URL_USERS, message);
    console.log('✅ Discord unlock notification sent successfully. Status:', response.status);
  } catch (error: any) {
    console.error('❌ Error sending Discord unlock notification:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
  }
}
