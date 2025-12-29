import { Router } from 'express';
import { query } from '../config/database.js';
import { hashPassword, comparePasswords, generateToken, validatePassword } from '../utils/auth.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { registerLimiter, loginLimiter } from '../middleware/rateLimiter.js';
import { logAuditEvent, getUserIP, getUserAgent } from '../middleware/audit.js';
import { isAccountLocked, recordFailedLoginAttempt, recordSuccessfulLogin, getRemainingLockoutTime } from '../services/accountLockout.js';
import { notifyAdminNewRegistration, notifyUserWelcome, sendDirectMessage, DISCORD_ENABLED } from '../services/discord.js';

const router = Router();

// Register request - RATE LIMITED
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { nickname, email, language, discord_id, password } = req.body;
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
      `INSERT INTO users (nickname, email, password_hash, language, discord_id, is_active, is_admin, is_blocked, is_rated, matches_played, elo_provisional, total_wins, total_losses, trend)
       VALUES ($1, $2, $3, $4, $5, true, false, true, false, 0, false, 0, 0, '-')
       RETURNING id`,
      [nickname, email, passwordHash, language || 'en', discord_id || null]
    );

    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('User created successfully:', result.rows[0].id);

    // Log successful registration
    await logAuditEvent({
      event_type: 'REGISTRATION',
      user_id: result.rows[0].id,
      username: nickname,
      ip_address: ip,
      user_agent: userAgent,
      details: { email, language: language || 'en' }
    });

    // Send Discord notifications
    await notifyAdminNewRegistration({
      nickname,
      email,
      discord_id
    });

    await notifyUserWelcome({
      nickname,
      discord_id
    });

    res.status(201).json({ id: result.rows[0].id, message: 'Registration successful' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: (error as any).message });
  }
});

// Login - RATE LIMITED with account lockout
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { nickname, password } = req.body;
    const ip = getUserIP(req);
    const userAgent = getUserAgent(req);

    // Get user by nickname
    // COALESCE handles case where columns don't exist yet (before migration)
    const result = await query(
      `SELECT id, password_hash, is_blocked, 
              COALESCE(failed_login_attempts, 0) as failed_login_attempts,
              locked_until
       FROM public.users WHERE nickname = $1`,
      [nickname]
    );

    // Check if user exists
    if (result.rows.length === 0) {
      // Log failed login attempt (user not found)
      await logAuditEvent({
        event_type: 'LOGIN_FAILED',
        username: nickname,
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
        username: nickname,
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
        username: nickname,
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
      await recordFailedLoginAttempt(user.id, nickname);

      const updatedUser = await query(
        `SELECT failed_login_attempts FROM public.users WHERE id = $1`,
        [user.id]
      );

      const failedAttempts = updatedUser.rows[0].failed_login_attempts;
      const attemptsRemaining = Math.max(0, 5 - failedAttempts);

      await logAuditEvent({
        event_type: 'LOGIN_FAILED',
        user_id: user.id,
        username: nickname,
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
      username: nickname,
      ip_address: ip,
      user_agent: userAgent,
      details: { success: true }
    });

    res.json({ token, userId: user.id });
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

// Request Password Reset via Discord - User provides nickname and Discord ID for validation
router.post('/request-password-reset', registerLimiter, async (req, res) => {
  try {
    const { nickname, discord_id } = req.body;
    const ip = getUserIP(req);

    if (!nickname || !discord_id) {
      return res.status(400).json({ error: 'Nickname and Discord ID are required' });
    }

    // Discord is required for this feature
    if (!DISCORD_ENABLED) {
      return res.status(403).json({ error: 'Password reset via Discord is not enabled on this server' });
    }

    // Find user
    const userResult = await query(
      'SELECT id, discord_id, email FROM public.users WHERE LOWER(nickname) = LOWER($1)',
      [nickname]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if user exists (security)
      return res.status(200).json({ message: 'If user exists and Discord ID matches, a temporary password will be sent via Discord DM' });
    }

    const user = userResult.rows[0];

    // Verify Discord ID matches
    if (user.discord_id !== discord_id) {
      // Don't reveal the mismatch for security
      return res.status(200).json({ message: 'If user exists and Discord ID matches, a temporary password will be sent via Discord DM' });
    }

    // Generate temporary password (8 characters)
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await hashPassword(tempPassword);

    // Update user password and set password_must_change flag
    await query(
      'UPDATE users SET password_hash = $1, password_must_change = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, user.id]
    );

    // Send Discord DM with temporary password
    try {
      await sendDirectMessage(
        user.discord_id,
        `🔐 **Password Reset Request**\n\n` +
        `Your temporary password is: \`${tempPassword}\`\n\n` +
        `Use this password to log in. You will be required to change it on your next login.\n\n` +
        `If you didn't request this, contact an administrator.`
      );
    } catch (dmError) {
      console.error('Failed to send Discord DM:', dmError);
      // Still return success since password was reset, DM failure will be logged
    }

    // Log the request
    await logAuditEvent({
      event_type: 'PASSWORD_RESET_REQUESTED',
      user_id: user.id,
      username: nickname,
      ip_address: ip,
      details: { method: 'user_request_via_discord' }
    });

    res.status(200).json({ message: 'If user exists and Discord ID matches, a temporary password will be sent via Discord DM' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Request failed' });
  }
});

export default router;
