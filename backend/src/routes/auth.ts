import { Router } from 'express';
import { randomBytes } from 'crypto';
import { query } from '../config/database.js';
import { hashPassword, comparePasswords, generateToken, validatePassword } from '../utils/auth.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { registerLimiter, loginLimiter } from '../middleware/rateLimiter.js';
import { logAuditEvent, getUserIP, getUserAgent } from '../middleware/audit.js';
import { isAccountLocked, recordFailedLoginAttempt, recordSuccessfulLogin, getRemainingLockoutTime } from '../services/accountLockout.js';
import { notifyAdminNewRegistration, notifyUserWelcome, sendPasswordResetViaThread, DISCORD_ENABLED, resolveDiscordIdFromUsername } from '../services/discord.js';
import { maskEmail } from '../utils/email.js';
import { sendMailerSendEmail } from '../services/mailersend.js';
import { getEmailTexts } from '../utils/emailTexts.js';

const router = Router();

// Register request - RATE LIMITED
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { nickname, email, language, discord_id, password, country, avatar } = req.body;
    const ip = getUserIP(req);
    const userAgent = getUserAgent(req);

    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Register request:', { nickname, email, language, password: '***', discord_id });

    // Validate required fields
    if (!nickname || !email || !password) {
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Missing required fields:', { nickname: !!nickname, email: !!email, password: !!password });
      return res.status(400).json({ error: 'Nickname, email, and password are required' });
    }

    // Validate password
    const validation = await validatePassword(password);
    if (!validation.valid) {
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Password validation failed:', validation.errors);
      return res.status(400).json({ errors: validation.errors });
    }

    // Check if user already exists
    const existing = await query('SELECT id FROM public.users WHERE nickname = $1 OR email = $2', [nickname, email]);
    if (existing.rows.length > 0) {
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('User already exists');
      
      // Log failed registration attempt
      await logAuditEvent({
        event_type: 'REGISTRATION',
        username: nickname,
        ip_address: ip,
        user_agent: userAgent,
        details: { reason: 'duplicate_account', email }
      });

      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user directly (blocked by default - admin must activate)
    const result = await query(
      `INSERT INTO users (nickname, email, password_hash, language, discord_id, country, avatar, is_active, is_admin, is_blocked, is_rated, matches_played, elo_provisional, total_wins, total_losses, trend)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, false, true, false, 0, false, 0, 0, '-')
       RETURNING id`,
      [nickname, email, passwordHash, language || 'en', discord_id || null, country || null, avatar || null]
    );

    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('User created successfully:', result.rows[0].id);


    // Generar token y expiración para verificación de email
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await query(
      'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
      [verificationToken, verificationExpires, result.rows[0].id]
    );

    // Construir URL de verificación
    const verificationUrl = `${process.env.FRONTEND_URL || 'https://app.example.com'}/verify-email?token=${verificationToken}`;

    // Obtener textos internacionalizados
    const emailTexts = getEmailTexts(language || 'en');
    // Enviar email usando MailerSend
    try {
      await sendMailerSendEmail({
        to: email,
        subject: emailTexts.verify_subject,
        variables: {
          message: emailTexts.verify_message,
          greetings: `${emailTexts.greetings} ${nickname}`,
          action_url: verificationUrl,
          action_label: emailTexts.verify_action,
        },
      });
    } catch (mailError) {
      console.error('MailerSend error (registro):', mailError);
    }

    // Log successful registration
    await logAuditEvent({
      event_type: 'REGISTRATION',
      user_id: result.rows[0].id,
      username: nickname,
      ip_address: ip,
      user_agent: userAgent,
      details: { email, language: language || 'en', verification_sent: true }
    });

    // No notificar por Discord hasta que el email esté verificado

    res.status(201).json({ id: result.rows[0].id, message: 'Registration successful. Please verify your email.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: (error as any).message });
  }
});

// Endpoint para confirmar verificación de email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const ip = getUserIP(req);
    const userAgent = getUserAgent(req);

    // Buscar usuario con ese token y verificar expiración
    const userResult = await query(
      'SELECT id, email_verification_expires, language FROM users WHERE email_verification_token = $1',
      [token]
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    const user = userResult.rows[0];
    if (new Date() > user.email_verification_expires) {
      return res.status(400).json({ error: 'Token expired' });
    }

    // Marcar email como verificado y limpiar token
    await query(
      'UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1',
      [user.id]
    );

    // Obtener datos del usuario para notificaciones Discord
    const userInfoResult = await query(
      'SELECT nickname, email, discord_id FROM users WHERE id = $1',
      [user.id]
    );
    const userInfo = userInfoResult.rows[0];

    // Notificar al admin y dar la bienvenida en Discord
    try {
      await notifyAdminNewRegistration({
        nickname: userInfo.nickname,
        email: userInfo.email,
        discord_id: userInfo.discord_id
      });
      await notifyUserWelcome({
        nickname: userInfo.nickname,
        discord_id: userInfo.discord_id
      });
    } catch (discordError) {
      console.error('Discord notification error after email verification:', discordError);
    }

    // Enviar email informativo de confirmación de registro
    try {
      const lang = user.language || 'en';
      const emailTexts = getEmailTexts(lang);
      await sendMailerSendEmail({
        to: userInfo.email,
        subject: emailTexts.registration_confirmation_subject,
        variables: {
          greetings: `${emailTexts.greetings} ${userInfo.nickname}`,
          message: emailTexts.registration_confirmation_message,
          action_url: process.env.FRONTEND_URL || 'https://app.example.com',
          action_label: 'Go to Site',
        },
      });
    } catch (mailError) {
      console.error('MailerSend error (registration confirmation):', mailError);
    }

    // Registrar en audit log
    await logAuditEvent({
      event_type: 'EMAIL_VERIFIED',
      user_id: user.id,
      username: userInfo.nickname,
      ip_address: ip,
      user_agent: userAgent,
      details: { method: 'email_link' }
    });

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Login - RATE LIMITED with account lockout
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { nickname, email, password } = req.body;
    const ip = getUserIP(req);
    const userAgent = getUserAgent(req);

    // Validate that either nickname or email is provided
    if (!nickname && !email) {
      return res.status(400).json({ error: 'Nickname or email and password are required' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Get user by nickname or email
    // COALESCE handles case where columns don't exist yet (before migration)
    const result = await query(
      `SELECT id, nickname, password_hash, is_blocked, 
              COALESCE(failed_login_attempts, 0) as failed_login_attempts,
              locked_until,
              COALESCE(password_must_change, false) as password_must_change
       FROM public.users WHERE nickname = $1 OR email = $2`,
      [nickname || '', email || '']
    );

    // Check if user exists
    if (result.rows.length === 0) {
      // Log failed login attempt (user not found)
      const loginAttempt = nickname || email;
      await logAuditEvent({
        event_type: 'LOGIN_FAILED',
        username: loginAttempt,
        ip_address: ip,
        user_agent: userAgent,
        details: { reason: 'user_not_found' }
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Check if account is locked
    if (await isAccountLocked(user.id)) {
      const remainingTime = await getRemainingLockoutTime(user.id);
      const minutes = Math.ceil(remainingTime / 60);

      await logAuditEvent({
        event_type: 'LOGIN_FAILED',
        user_id: user.id,
        username: user.nickname,
        ip_address: ip,
        user_agent: userAgent,
        details: { reason: 'account_locked', remaining_minutes: minutes }
      });

      return res.status(423).json({
        error: 'Account locked due to multiple failed login attempts',
        message: `Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}`
      });
    }

    // Check if account is blocked by admin
    if (user.is_blocked) {
      await logAuditEvent({
        event_type: 'LOGIN_FAILED',
        user_id: user.id,
        username: user.nickname,
        ip_address: ip,
        user_agent: userAgent,
        details: { reason: 'account_blocked' }
      });

      return res.status(403).json({ error: 'Account is blocked by administrator' });
    }

    // Verify password
    const isValid = await comparePasswords(password, user.password_hash);
    if (!isValid) {
      // Record failed attempt and check for lockout
      await recordFailedLoginAttempt(user.id, user.nickname);

      const updatedUser = await query(
        `SELECT failed_login_attempts FROM public.users WHERE id = $1`,
        [user.id]
      );

      const failedAttempts = updatedUser.rows[0].failed_login_attempts;
      const attemptsRemaining = Math.max(0, 5 - failedAttempts);

      await logAuditEvent({
        event_type: 'LOGIN_FAILED',
        user_id: user.id,
        username: user.nickname,
        ip_address: ip,
        user_agent: userAgent,
        details: { reason: 'invalid_password', failed_attempts: failedAttempts }
      });

      if (attemptsRemaining === 0) {
        return res.status(429).json({
          error: 'Too many failed login attempts',
          message: 'Account locked for 15 minutes'
        });
      }

      return res.status(401).json({
        error: 'Invalid credentials',
        attemptsRemaining
      });
    }

    // Login successful - reset failed attempts and generate token
    await recordSuccessfulLogin(user.id);

    const token = generateToken(user.id);

    // Log successful login
    await logAuditEvent({
      event_type: 'LOGIN_SUCCESS',
      user_id: user.id,
      username: user.nickname,
      ip_address: ip,
      user_agent: userAgent,
      details: { success: true }
    });

    res.json({ 
      token, 
      userId: user.id,
      password_must_change: user.password_must_change
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Change password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const userResult = await query('SELECT password_hash FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await comparePasswords(oldPassword, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid current password' });
    }

    const validation = await validatePassword(newPassword, req.userId);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const newHash = await hashPassword(newPassword);

    // Save old password to history
    await query(
      'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
      [req.userId, userResult.rows[0].password_hash]
    );

    // Update password and clear the password_must_change flag
    await query('UPDATE users SET password_hash = $1, password_must_change = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, req.userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

// Force change password (no old password required, used after admin reset)
router.post('/force-change-password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const userResult = await query('SELECT password_hash FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate new password
    const validation = await validatePassword(newPassword, req.userId);
    if (!validation.valid) {
      return res.status(400).json({ errors: validation.errors });
    }

    const newHash = await hashPassword(newPassword);

    // Save old password to history
    await query(
      'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
      [req.userId, userResult.rows[0].password_hash]
    );

    // Update password and clear the password_must_change flag
    await query('UPDATE users SET password_hash = $1, password_must_change = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, req.userId]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

// Check if password reset via Discord is available
router.get('/discord-password-reset-available', async (req, res) => {
  try {
    res.json({ available: DISCORD_ENABLED });
  } catch (error) {
    res.status(500).json({ error: 'Check failed' });
  }
});

// Password reset via email: Step 1 (show masked email) and Step 2 (confirm and generate token)
router.post('/request-password-reset', registerLimiter, async (req, res) => {
  try {
    const { nickname, email, confirm } = req.body;
    const ip = getUserIP(req);

    // Buscar usuario por nickname o email
    let userResult;
    if (nickname) {
      userResult = await query(
        'SELECT id, email, nickname FROM public.users WHERE LOWER(nickname) = LOWER($1)',
        [nickname]
      );
    } else if (email) {
      userResult = await query(
        'SELECT id, email, nickname FROM public.users WHERE LOWER(email) = LOWER($1)',
        [email]
      );
    } else {
      return res.status(400).json({ error: 'Nickname or email is required' });
    }

    let maskedEmail = '';
    let userId = null;
    if (userResult.rows.length > 0) {
      maskedEmail = maskEmail(userResult.rows[0].email);
      userId = userResult.rows[0].id;
    } else {
      // Email ficticio para no filtrar usuarios
      maskedEmail = maskEmail(email || 'usuario@email.com');
    }

    if (!confirm) {
      // Primer paso: mostrar email enmascarado y pedir confirmación
      return res.status(200).json({
        maskedEmail,
        requiresConfirmation: true
      });
    }

    // Segundo paso: generar token y guardar en DB y enviar email
    if (userId) {
      // Generar token seguro y expiración (ejemplo: 1 hora)
      const token = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      await query(
        'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
        [token, expires, userId]
      );

      // Obtener datos del usuario
      const userData = userResult.rows[0];
      // Obtener textos internacionalizados
      const userLang = 'es'; // o userData.language si está disponible
      const emailTexts = getEmailTexts(userLang);
      const resetUrl = `${process.env.FRONTEND_URL || 'https://app.example.com'}/reset-password?token=${token}`;

      try {
        await sendMailerSendEmail({
          to: userData.email,
          subject: emailTexts.reset_subject,
          variables: {
            message: emailTexts.reset_message,
            greetings: `${emailTexts.greetings} ${userData.nickname}`,
            action_url: resetUrl,
            action_label: emailTexts.reset_action,
          },
        });
      } catch (mailError) {
        console.error('MailerSend error (reset):', mailError);
      }

      // Registrar en el audit log
      await logAuditEvent({
        event_type: 'PASSWORD_RESET_REQUEST',
        user_id: userId,
        username: nickname || email,
        ip_address: ip,
        details: { method: 'email', action: 'password_reset_requested' }
      });
    }

    // Respuesta genérica
    return res.status(200).json({
      success: true,
      message: 'Si el usuario existe, se ha enviado un email de reseteo.'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Request failed' });
  }
});

// Helper function to send account unlocked email
const sendAccountUnlockedEmail = async (user: { email: string; nickname: string; language?: string }) => {
  try {
    const lang = user.language || 'en';
    const emailTexts = getEmailTexts(lang);
    await sendMailerSendEmail({
      to: user.email,
      subject: emailTexts.account_unlocked_subject,
      variables: {
        greetings: `${emailTexts.greetings} ${user.nickname}`,
        message: emailTexts.account_unlocked_message,
        action_url: process.env.FRONTEND_URL || 'https://app.example.com',
        action_label: 'Go to Site',
      },
    });
  } catch (mailError) {
    console.error('MailerSend error (account unlocked):', mailError);
  }
};

// Admin endpoint to unlock user account and send notification email
router.post('/admin/unlock-user', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const adminResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (!adminResult.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Unlock user
    await query('UPDATE public.users SET is_blocked = false WHERE id = $1', [userId]);

    // Get user data
    const userResult = await query('SELECT email, nickname, language FROM public.users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // Send account unlocked email
    await sendAccountUnlockedEmail(userResult.rows[0]);

    // Log audit event
    const ip = getUserIP(req);
    const userAgent = getUserAgent(req);
    await logAuditEvent({
      event_type: 'ACCOUNT_UNLOCKED',
      user_id: userId,
      username: userResult.rows[0].nickname,
      ip_address: ip,
      user_agent: userAgent,
      details: { method: 'admin_unlock' }
    });

    res.json({ success: true, message: 'User unlocked and notified' });
  } catch (error) {
    console.error('Admin unlock error:', error);
    res.status(500).json({ error: 'Unlock failed' });
  }
});

export default router;
