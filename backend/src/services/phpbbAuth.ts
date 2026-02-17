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
 * Validate password against phpBB hash
 * phpBB uses bcrypt for password hashing with $2y$ prefix
 * Node.js bcrypt may not support $2y$, so we convert to $2b$
 */
export async function validatePhpbbPassword(
  password: string,
  phpbbUser: PhpbbUser
): Promise<boolean> {
  try {
    console.log(`🔐 [phpBB] Validating password for user: ${phpbbUser.username}`);
    console.log(`🔐 [phpBB] Hash starts with: ${phpbbUser.user_password.substring(0, 10)}...`);
    
    // phpBB uses $2y$ prefix, but Node.js bcrypt works with $2a$ and $2b$
    // Convert $2y$ to $2b$ for compatibility
    let hashToCompare = phpbbUser.user_password;
    if (hashToCompare.startsWith('$2y$')) {
      console.log(`🔐 [phpBB] Converting $2y$ hash to $2b$ for bcrypt compatibility`);
      hashToCompare = '$2b$' + hashToCompare.substring(4);
    }
    
    // Compare password with the hash
    const isValid = await bcrypt.compare(password, hashToCompare);
    
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
  password: string
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
