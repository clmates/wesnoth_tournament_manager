import { Router } from 'express';
import { query } from '../config/database.js';
import { generateToken, generateTokenWithUsername } from '../utils/auth.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { logAuditEvent, getUserIP, getUserAgent } from '../middleware/audit.js';
import { isAccountLocked, recordFailedLoginAttempt, recordSuccessfulLogin, getRemainingLockoutTime } from '../services/accountLockout.js';
import { validateWesnothPassword, getWesnothUserProfile, ensureUserExtensionExists } from '../services/wesnothAuth.js';

const router = Router();

// Login - RATE LIMITED with account lockout against Wesnoth database
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = getUserIP(req);
    const userAgent = getUserAgent(req);

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Normalize username to lowercase for case-insensitive comparison
    const normalizedUsername = username.toLowerCase();

    // Get user profile from Wesnoth
    const wesnothUser = await getWesnothUserProfile(normalizedUsername);
    if (!wesnothUser) {
      // Log failed login attempt (user not found in Wesnoth)
      await logAuditEvent({
        event_type: 'LOGIN_FAILED',
        username: normalizedUsername,
        ip_address: ip,
        user_agent: userAgent,
        details: { reason: 'user_not_found_in_wesnoth' }
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Validate password against Wesnoth
    const passwordValidation = await validateWesnothPassword(password, normalizedUsername);
    if (!passwordValidation.valid) {
      // Log failed login attempt
      await logAuditEvent({
        event_type: 'LOGIN_FAILED',
        username: normalizedUsername,
        ip_address: ip,
        user_agent: userAgent,
        details: { reason: 'invalid_password', error: passwordValidation.error }
      });

      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Ensure user exists in users_extension (auto-create if first login)
    const userId = await ensureUserExtensionExists(normalizedUsername, {
      user_email: wesnothUser.user_email,
      user_lang: wesnothUser.user_lang
    });

    // Check if account is blocked (case-insensitive username lookup)
    const blockedCheck = await query(
      'SELECT is_blocked FROM users_extension WHERE LOWER(username) = LOWER($1)',
      [normalizedUsername]
    );

    if (blockedCheck.rows.length > 0 && blockedCheck.rows[0].is_blocked) {
      await logAuditEvent({
        event_type: 'LOGIN_FAILED',
        username: normalizedUsername,
        ip_address: ip,
        user_agent: userAgent,
        details: { reason: 'account_blocked' }
      });

      return res.status(403).json({ error: 'Account is blocked by administrator' });
    }

    // Check if maintenance mode is enabled
    const maintenanceResult = await query(
      'SELECT setting_value FROM system_settings WHERE setting_key = $1',
      ['maintenance_mode']
    );
    const isMaintenanceMode = maintenanceResult.rows.length > 0 && maintenanceResult.rows[0].setting_value === 'true';

    if (isMaintenanceMode) {
      // Check if user is admin (admins can login during maintenance)
      const adminCheck = await query(
        'SELECT is_admin FROM users_extension WHERE id = $1',
        [userId]
      );

      if (!adminCheck.rows.length || !adminCheck.rows[0].is_admin) {
        await logAuditEvent({
          event_type: 'LOGIN_FAILED',
          username: username,
          ip_address: ip,
          user_agent: userAgent,
          details: { reason: 'maintenance_mode_active' }
        });

        return res.status(503).json({
          error: 'Site under maintenance',
          message: 'The site is currently under maintenance. Please try again later.'
        });
      }
    }

    // Generate JWT token using normalized username and user ID
    // Token will contain both for backwards compatibility
    const token = generateTokenWithUsername(normalizedUsername, userId);

    // Update last login and reset failed attempts (case-insensitive)
    await query(
      `UPDATE users_extension 
       SET last_login_attempt = NOW(), failed_login_attempts = 0, updated_at = NOW()
       WHERE LOWER(username) = LOWER($1)`,
      [normalizedUsername]
    );

    // Log successful login
    await logAuditEvent({
      event_type: 'LOGIN_SUCCESS',
      username: normalizedUsername,
      ip_address: ip,
      user_agent: userAgent,
      details: { success: true }
    });

    res.json({ 
      token, 
      username: normalizedUsername,
      userId: userId
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});
// Validate token endpoint - used by frontend on app load
router.get('/validate-token', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // If we reach here, token is valid (authMiddleware verified it)
    // req.userId now contains the numeric user ID
    const userResult = await query(
      'SELECT id, username, email, is_admin, is_blocked FROM users_extension WHERE id = $1',
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check if user is blocked
    if (user.is_blocked) {
      return res.status(403).json({ error: 'User account is blocked' });
    }

    // Return user info
    res.json({
      valid: true,
      userId: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({ error: 'Token validation failed' });
  }
});

export default router;
