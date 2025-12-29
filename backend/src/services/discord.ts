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
      searchQuery: username
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

    // Find exact match (considering both username and discriminator)
    let targetMember = null;

    if (usernameInput.includes('#')) {
      // Search for exact username#discriminator match
      const [searchUsername, searchDiscriminator] = usernameInput.split('#');
      targetMember = members.find((m: any) =>
        m.user.username.toLowerCase() === searchUsername.toLowerCase() &&
        m.user.discriminator === searchDiscriminator
      );
    } else {
      // Just username, take first match
      targetMember = members[0];
    }

    if (!targetMember) {
      console.warn('[DISCORD-RESOLVE] Exact username match not found:', usernameInput);
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

export async function notifyAdminNewRegistration(user: {
  nickname: string;
  email: string;
  discord_id?: string;
}) {
  if (!DISCORD_ENABLED || !DISCORD_WEBHOOK_URL_ADMIN) {
    console.warn('[DISCORD] Discord webhook URL not configured, skipping admin notification');
    return;
  }

  const message = {
    embeds: [{
      title: '🆕 Nueva Solicitud de Registro',
      description: 'Un nuevo usuario se ha registrado y está pendiente de aprobación.',
      color: 0x3498db, // Blue
      fields: [
        { 
          name: '👤 Nickname', 
          value: `\`${user.nickname}\``, 
          inline: true 
        },
        { 
          name: '📧 Email', 
          value: user.email, 
          inline: true 
        },
        { 
          name: '💬 Discord ID', 
          value: user.discord_id || '*No proporcionado*', 
          inline: true 
        },
      ],
      timestamp: new Date().toISOString(),
      footer: { 
        text: 'Wesnoth Tournament Manager - Aprueba este usuario en el panel de administración' 
      }
    }]
  };

  try {
    await axios.post(DISCORD_WEBHOOK_URL_ADMIN, message);
    console.log(`✅ Discord notification sent for new user: ${user.nickname}`);
  } catch (error: any) {
    console.error('❌ Error sending Discord notification:', error.response?.data || error.message);
  }
}

export async function notifyAdminUserApproved(user: {
  nickname: string;
  approvedBy: string;
}) {
  if (!DISCORD_ENABLED || !DISCORD_WEBHOOK_URL_ADMIN) return;

  const message = {
    embeds: [{
      title: '✅ Usuario Aprobado',
      description: `El usuario **${user.nickname}** ha sido aprobado por un administrador.`,
      color: 0x2ecc71, // Green
      fields: [
        { name: '👤 Usuario', value: `\`${user.nickname}\``, inline: true },
        { name: '👨‍💼 Aprobado por', value: user.approvedBy, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Wesnoth Tournament Manager' }
    }]
  };

  try {
    await axios.post(DISCORD_WEBHOOK_URL_ADMIN, message);
  } catch (error) {
    console.error('Error sending Discord notification:', error);
  }
}

export async function notifyAdminUserRejected(user: {
  nickname: string;
  rejectedBy: string;
}) {
  if (!DISCORD_ENABLED || !DISCORD_WEBHOOK_URL_ADMIN) return;

  const message = {
    embeds: [{
      title: '❌ Usuario Rechazado',
      description: `El usuario **${user.nickname}** ha sido rechazado.`,
      color: 0xe74c3c, // Red
      fields: [
        { name: '👤 Usuario', value: `\`${user.nickname}\``, inline: true },
        { name: '👨‍💼 Rechazado por', value: user.rejectedBy, inline: true },
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Wesnoth Tournament Manager' }
    }]
  };

  try {
    await axios.post(DISCORD_WEBHOOK_URL_ADMIN, message);
  } catch (error) {
    console.error('Error sending Discord notification:', error);
  }
}

// User-facing notifications (sent to users channel)
export async function notifyUserWelcome(user: {
  nickname: string;
  discord_id?: string;
}) {
  console.log('🔔 notifyUserWelcome called for:', user.nickname);
  console.log('📍 DISCORD_ENABLED:', DISCORD_ENABLED);
  console.log('📍 DISCORD_WEBHOOK_URL_USERS configured:', !!DISCORD_WEBHOOK_URL_USERS);
  if (!DISCORD_ENABLED || !DISCORD_WEBHOOK_URL_USERS) {
    console.warn('[DISCORD] Discord not enabled or webhook not configured - skipping user welcome notification');
    return;
  }

  const hasDiscordId = !!user.discord_id;
  const userMention = hasDiscordId ? `<@${user.discord_id}>` : `**${user.nickname}**`;

  const message = {
    content: `${userMention}`,
    embeds: [{
      title: '👋 Welcome to Wesnoth Tournament Manager!',
      description: `Welcome **${user.nickname}**, your account is temporarily locked. An admin will unlock it and you will receive a notification in this channel.`,
      color: 0x3498db, // Blue
      timestamp: new Date().toISOString(),
      footer: { text: 'Please wait for admin approval' }
    }]
  };

  try {
    console.log('📤 Sending Discord WELCOME to users channel', {
      webhook: DISCORD_WEBHOOK_URL_USERS?.slice(0, 60) + '...',
      discord_id: user.discord_id,
      nickname: user.nickname,
    });
    const response = await axios.post(DISCORD_WEBHOOK_URL_USERS, message);
    console.log('✅ Discord welcome notification sent successfully. Status:', response.status);
  } catch (error: any) {
    console.error('❌ Error sending Discord welcome notification:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
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

/**
 * Send password reset via private thread in a dedicated channel
 * Creates a private thread visible only to the user and admins
 */
export async function sendPasswordResetViaThread(
  discordId: string,
  nickname: string,
  tempPassword: string
): Promise<void> {
  console.log('[PASSWORD-RESET-THREAD] Starting sendPasswordResetViaThread', {
    discordId,
    nickname,
    discordEnabled: DISCORD_ENABLED,
    botTokenConfigured: !!process.env.DISCORD_BOT_TOKEN,
    channelIdConfigured: !!process.env.DISCORD_PASSWORD_RESET_CHANNEL_ID
  });

  if (!DISCORD_ENABLED) {
    console.warn('[PASSWORD-RESET-THREAD] Discord not enabled, skipping thread creation');
    return;
  }

  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('[PASSWORD-RESET-THREAD] Bot token not configured in environment');
    return;
  }

  if (!process.env.DISCORD_PASSWORD_RESET_CHANNEL_ID) {
    console.error('[PASSWORD-RESET-THREAD] Password reset channel ID not configured');
    return;
  }

  if (!discordId || !nickname) {
    console.warn('[PASSWORD-RESET-THREAD] Missing required parameters', { discordId, nickname });
    return;
  }

  try {
    const DISCORD_API_URL = 'https://discord.com/api/v10';
    const channelId = process.env.DISCORD_PASSWORD_RESET_CHANNEL_ID;
    const headers = {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    };

    const threadName = `${nickname} - Password Reset`;

    console.log('[PASSWORD-RESET-THREAD] Creating private thread', {
      channelId,
      threadName
    });

    // Create private thread (type 12 = private thread)
    const threadResponse = await axios.post(
      `${DISCORD_API_URL}/channels/${channelId}/threads`,
      {
        name: threadName,
        type: 12, // PRIVATE_THREAD
        auto_archive_duration: 1440, // 24 hours
        invitable: false
      },
      { headers }
    );

    const threadId = threadResponse.data.id;
    console.log('[PASSWORD-RESET-THREAD] Private thread created successfully', {
      threadId,
      threadName
    });

    // Set thread permissions: only the user and admins can see it
    // Remove permissions for @everyone (ID "0" is @everyone)
    console.log('[PASSWORD-RESET-THREAD] Setting thread permissions');

    try {
      // Remove @everyone access
      await axios.put(
        `${DISCORD_API_URL}/channels/${threadId}/permissions/0`,
        {
          allow: '0',
          deny: '1024', // VIEW_CHANNEL permission
          type: 'role'
        },
        { headers }
      );
      console.log('[PASSWORD-RESET-THREAD] @everyone permission removed');
    } catch (permError) {
      console.warn('[PASSWORD-RESET-THREAD] Could not modify @everyone permissions:', permError instanceof Error ? permError.message : String(permError));
      // Continue anyway, thread is still private
    }

    // Allow the user to see the thread
    try {
      await axios.put(
        `${DISCORD_API_URL}/channels/${threadId}/permissions/${discordId}`,
        {
          allow: '1024', // VIEW_CHANNEL permission
          deny: '0',
          type: 'member'
        },
        { headers }
      );
      console.log('[PASSWORD-RESET-THREAD] User permission granted for thread');
    } catch (permError) {
      console.warn('[PASSWORD-RESET-THREAD] Could not grant user permissions:', permError instanceof Error ? permError.message : String(permError));
      // Continue anyway
    }

    // Send the password reset message
    console.log('[PASSWORD-RESET-THREAD] Sending password reset message to thread');

    const message = {
      content: `<@${discordId}>`,
      embeds: [{
        title: '🔐 Password Reset',
        description: `Your temporary password has been generated.`,
        color: 0x3498db,
        fields: [
          {
            name: 'Temporary Password',
            value: `\`${tempPassword}\``,
            inline: false
          },
          {
            name: 'Instructions',
            value: 'Use this password to log in. You will be required to change it on your next login.',
            inline: false
          },
          {
            name: 'Security',
            value: 'If you didn\'t request this, contact an administrator immediately.',
            inline: false
          }
        ],
        footer: {
          text: 'Wesnoth Tournament Manager'
        },
        timestamp: new Date().toISOString()
      }]
    };

    const messageResponse = await axios.post(
      `${DISCORD_API_URL}/channels/${threadId}/messages`,
      message,
      { headers }
    );

    console.log('[PASSWORD-RESET-THREAD] Password reset message sent successfully', {
      discordId,
      nickname,
      threadId,
      messageId: messageResponse.data.id,
      status: messageResponse.status
    });
  } catch (error: any) {
    console.error('[PASSWORD-RESET-THREAD] ❌ Error sending password reset via thread:', {
      discordId,
      nickname,
      httpStatus: error.response?.status,
      statusText: error.response?.statusText,
      errorData: error.response?.data,
      errorMessage: error.message,
      errorCode: error.code
    });

    if (error.response?.data?.code) {
      console.error('[PASSWORD-RESET-THREAD] Discord API Error Code:', error.response.data.code);
    }

    throw error;
  }
}
