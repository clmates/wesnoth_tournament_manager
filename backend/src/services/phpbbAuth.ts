import bcrypt from 'bcrypt';
import { queryPhpbb } from '../config/phpbbDatabase.js';

/**
 * phpBB Authentication Service
 * Validates users against the phpBB forum database
 */

export interface PhpbbUser {
  user_id: number;
  username: string;
  user_email: string;
  user_password: string;
  user_inactive_reason: number;
  user_type: number;
}

/**
 * Get user from phpBB by username (case-insensitive)
 */
export async function getPhpbbUser(username: string): Promise<PhpbbUser | null> {
  try {
    console.log(`🔐 [phpBB] Searching for user: ${username}`);
    const results = await queryPhpbb(
      `SELECT user_id, username, user_email, user_password, user_inactive_reason, user_type 
       FROM phpbb3_users 
       WHERE LOWER(username_clean) = LOWER(?)`,
      [username]
    );

    if (Array.isArray(results) && results.length > 0) {
      const user = results[0] as any;
      console.log(`✅ [phpBB] User found: ${user.username} (ID: ${user.user_id})`);
      return user as PhpbbUser;
    }

    console.warn(`❌ [phpBB] User not found: ${username}`);
    return null;
  } catch (error) {
    console.error('❌ [phpBB] Error fetching user:', error);
    throw error;
  }
}

/**
 * Apply phpBB's htmlspecialchars() transformation to a password string.
 * phpBB calls htmlspecialchars() on passwords before hashing, so characters
 * like & < > " ' are encoded as HTML entities in the stored hash.
 */
function phpbbHtmlspecialchars(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate password against phpBB hash.
 * phpBB uses bcrypt with $2y$ prefix — we convert to $2b$ for Node.js compatibility.
 *
 * phpBB applies htmlspecialchars() to passwords before hashing, so we try both
 * the raw password and the HTML-encoded version.
 *
 * ENCODING NOTE: This phpBB installation has latin1 as its database/connection charset,
 * which means passwords with non-ASCII chars were hashed using Latin-1 bytes.
 * Our frontend is UTF-8, so e.g. ñ arrives as 2 bytes (0xC3 0xB1) vs Latin-1's 1 byte (0xF1).
 * Fix: if all other attempts fail and the password has non-ASCII chars, retry with Latin-1 bytes.
 */
export async function validatePhpbbPassword(
  password: string,
  phpbbUser: PhpbbUser
): Promise<boolean> {
  try {
    console.log(`🔐 [phpBB] Validating password for user: ${phpbbUser.username}`);
    console.log(`🔐 [phpBB] Hash starts with: ${phpbbUser.user_password.substring(0, 10)}...`);

    // phpBB uses $2y$ prefix, but Node.js bcrypt works with $2a$ and $2b$
    let hashToCompare = phpbbUser.user_password;
    if (hashToCompare.startsWith('$2y$')) {
      console.log(`🔐 [phpBB] Converting $2y$ hash to $2b$ for bcrypt compatibility`);
      hashToCompare = '$2b$' + hashToCompare.substring(4);
    }

    // Attempt 1: raw password as sent by the user (UTF-8)
    let isValid = await bcrypt.compare(password, hashToCompare);

    // Attempt 2: phpBB encodes HTML special chars before hashing (& < > " ')
    if (!isValid) {
      const htmlEncoded = phpbbHtmlspecialchars(password);
      if (htmlEncoded !== password) {
        console.log(`🔐 [phpBB] Raw compare failed, retrying with htmlspecialchars encoding`);
        isValid = await bcrypt.compare(htmlEncoded, hashToCompare);
      }
    }

    // Attempt 3: htmlspecialchars + Latin-1 encoding (non-ASCII chars in latin1 DB)
    const hasNonAscii = /[^\x00-\x7F]/.test(password);
    if (!isValid && hasNonAscii) {
      console.log(`🔐 [phpBB] Retrying with Latin-1 byte encoding (latin1 DB charset)`);
      const passwordLatin1 = Buffer.from(password, 'latin1');
      isValid = await bcrypt.compare(passwordLatin1, hashToCompare);

      if (!isValid) {
        const htmlEncodedLatin1 = Buffer.from(phpbbHtmlspecialchars(password), 'latin1');
        isValid = await bcrypt.compare(htmlEncodedLatin1, hashToCompare);
      }
    }

    if (isValid) {
      console.log(`✅ [phpBB] Password valid for user: ${phpbbUser.username}`);
    } else {
      console.warn(`❌ [phpBB] Password invalid for user: ${phpbbUser.username}`);
    }

    return isValid;
  } catch (error) {
    console.error('❌ [phpBB] Error validating password:', error);
    return false;
  }
}

/**
 * Check if a user has an active ban in phpbb3_banlist (by user_id and dates).
 * ban_end = 0 means permanent ban.
 */
export async function checkForumBanlist(
  userId: number
): Promise<{ banned: boolean; reason?: string; until?: Date | null }> {
  try {
    const results = await queryPhpbb(
      `SELECT ban_reason, ban_give_reason, ban_end
       FROM phpbb3_banlist
       WHERE ban_userid = ?
         AND ban_exclude = 0
         AND ban_start <= UNIX_TIMESTAMP()
         AND (ban_end = 0 OR ban_end >= UNIX_TIMESTAMP())
       LIMIT 1`,
      [userId]
    );

    if (Array.isArray(results) && results.length > 0) {
      const ban = results[0] as any;
      return {
        banned: true,
        reason: ban.ban_give_reason || ban.ban_reason || 'banned',
        until: ban.ban_end === 0 ? null : new Date(ban.ban_end * 1000),
      };
    }

    return { banned: false };
  } catch (error) {
    console.error('❌ [phpBB] Error checking banlist:', error);
    return { banned: false };
  }
}

/**
 * Check if a user belongs to the forum moderator group defined by FORUM_MODERATOR_GROUP_ID.
 */
export async function checkUserIsForumModerator(username: string): Promise<boolean> {
  try {
    const groupId = process.env.FORUM_MODERATOR_GROUP_ID;
    if (!groupId) return false;

    const userResults = await queryPhpbb(
      `SELECT user_id FROM phpbb3_users WHERE LOWER(username_clean) = LOWER(?) LIMIT 1`,
      [username]
    );

    if (!Array.isArray(userResults) || userResults.length === 0) return false;

    const userId = (userResults[0] as any).user_id;

    const groupResults = await queryPhpbb(
      `SELECT user_id FROM phpbb3_user_group WHERE user_id = ? AND group_id = ? LIMIT 1`,
      [userId, parseInt(groupId, 10)]
    );

    return Array.isArray(groupResults) && groupResults.length > 0;
  } catch (error) {
    console.error('❌ [phpBB] Error checking moderator group:', error);
    return false;
  }
}

/**
 * Check if user is banned or inactive
 * user_type: 0 = normal, 1 = inactive, 2 = ignore, 3 = founder
 * user_inactive_reason: 0 = active, 1 = new user not activated, etc.
 */
export function isUserBannedOrInactive(phpbbUser: PhpbbUser): { banned: boolean; reason?: string } {
  // Check if user_type indicates inactive state (not 0, 3, or founder types)
  if (phpbbUser.user_type === 1) {
    if (phpbbUser.user_inactive_reason === 0) {
      return { banned: true, reason: 'inactive_user' };
    } else if (phpbbUser.user_inactive_reason === 2) {
      return { banned: true, reason: 'user_banned' };
    } else if (phpbbUser.user_inactive_reason === 3) {
      return { banned: true, reason: 'user_banned_by_user' };
    }
  }

  return { banned: false };
}

/**
 * Authenticate user against phpBB database
 * Returns user info if valid, null if invalid credentials or banned
 */
export async function authenticatePhpbbUser(
  username: string,
  password: string,
  skipPasswordCheck: boolean = false
): Promise<
  | {
      valid: true;
      user_id: number;
      username: string;
      email: string;
    }
  | { valid: false; error: string }
> {
  try {
    console.log(`\n🔐 [AUTH] Starting authentication for username: ${username}`);
    
    // Get user from phpBB
    const phpbbUser = await getPhpbbUser(username);
    if (!phpbbUser) {
      console.warn(`❌ [AUTH] User not found in phpBB`);
      return { valid: false, error: 'user_not_found' };
    }

    // Check if user is banned or inactive
    const banCheck = isUserBannedOrInactive(phpbbUser);
    if (banCheck.banned) {
      console.warn(`❌ [AUTH] User is banned/inactive: ${banCheck.reason}`);
      return { valid: false, error: banCheck.reason || 'user_banned' };
    }

    // Skip password validation if instructed (TEST_MODE logic handled by caller)
    if (skipPasswordCheck) {
      console.warn(`⚠️ [AUTH] Password check skipped for user: ${username}`);
      return {
        valid: true,
        user_id: phpbbUser.user_id,
        username: phpbbUser.username.toLowerCase(),
        email: phpbbUser.user_email,
      };
    }

    // Validate password
    console.log(`🔐 [AUTH] Validating password...`);
    const isPasswordValid = await validatePhpbbPassword(password, phpbbUser);
    if (!isPasswordValid) {
      console.warn(`❌ [AUTH] Password validation failed`);
      return { valid: false, error: 'invalid_password' };
    }

    // Password is valid
    console.log(`✅ [AUTH] Authentication successful for user: ${username}`);
    return {
      valid: true,
      user_id: phpbbUser.user_id,
      username: phpbbUser.username.toLowerCase(),
      email: phpbbUser.user_email,
    };
  } catch (error) {
    console.error('❌ [AUTH] Error authenticating user:', error);
    return { valid: false, error: 'authentication_error' };
  }
}
