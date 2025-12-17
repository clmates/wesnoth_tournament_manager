import { query } from '../config/database.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Check if user account is locked due to failed login attempts
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT locked_until FROM public.users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const lockedUntil = result.rows[0].locked_until;
    if (!lockedUntil) {
      return false;
    }

    const now = new Date();
    if (new Date(lockedUntil) > now) {
      // Account still locked
      return true;
    }

    // Lockout period expired, unlock the account
    await unlockAccount(userId);
    return false;
  } catch (error) {
    console.error('Error checking account lock status:', error);
    return false;
  }
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLoginAttempt(userId: string, username: string): Promise<void> {
  try {
    // Increment failed attempts
    const result = await query(
      `UPDATE public.users SET failed_login_attempts = failed_login_attempts + 1, 
                        last_login_attempt = NOW()
       WHERE id = $1
       RETURNING failed_login_attempts`,
      [userId]
    );

    const failedAttempts = result.rows[0]?.failed_login_attempts || 0;

    // Lock account if max attempts reached
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      await query(
        `UPDATE public.users SET locked_until = $1 WHERE id = $2`,
        [lockUntil, userId]
      );

      console.warn(`Account lockout: ${username} (${userId}) locked until ${lockUntil}`);
    }
  } catch (error) {
    console.error('Error recording failed login attempt:', error);
  }
}

/**
 * Record a successful login - resets failed attempts
 */
export async function recordSuccessfulLogin(userId: string): Promise<void> {
  try {
    await query(
      `UPDATE public.users SET failed_login_attempts = 0, 
                        locked_until = NULL,
                        last_login_attempt = NOW()
       WHERE id = $1`,
      [userId]
    );
  } catch (error) {
    console.error('Error recording successful login:', error);
  }
}

/**
 * Manually unlock a user account (admin function)
 */
export async function unlockAccount(userId: string): Promise<void> {
  try {
    await query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [userId]
    );
  } catch (error) {
    console.error('Error unlocking account:', error);
  }
}

/**
 * Get remaining lockout time in seconds
 */
export async function getRemainingLockoutTime(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT locked_until FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].locked_until) {
      return 0;
    }

    const lockedUntil = new Date(result.rows[0].locked_until);
    const now = new Date();
    const remaining = Math.floor((lockedUntil.getTime() - now.getTime()) / 1000);

    return Math.max(0, remaining);
  } catch (error) {
    console.error('Error getting remaining lockout time:', error);
    return 0;
  }
}

export default {
  isAccountLocked,
  recordFailedLoginAttempt,
  recordSuccessfulLogin,
  unlockAccount,
  getRemainingLockoutTime,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES
};
