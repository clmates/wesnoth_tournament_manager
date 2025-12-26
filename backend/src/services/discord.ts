import axios from 'axios';

const DISCORD_WEBHOOK_URL_ADMIN = process.env.DISCORD_WEBHOOK_URL_ADMIN || 'https://discord.com/api/webhooks/1451903758408614021/YZsof0mktnEB_C7GcpFcIyD7Tc6v2g63dR_bqFQJYqrZRrlzNw6LPYBFfCAOHOurHZRt';
const DISCORD_WEBHOOK_URL_USERS = process.env.DISCORD_WEBHOOK_URL_USERS || 'https://discord.com/api/webhooks/1451906911900274791/HLp96wiBX5AkZe4A86dSAz5rbJMddDDNM1SVzHGN0h8ekoWdZJ7_Sg0d4x_di54gaMyw';

// Check if Discord is enabled (at least one webhook URL is properly configured)
export const DISCORD_ENABLED = !!(process.env.DISCORD_WEBHOOK_URL_ADMIN || process.env.DISCORD_WEBHOOK_URL_USERS);

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
