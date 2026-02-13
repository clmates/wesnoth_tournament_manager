import { validateWesnothCredentials } from './wesnothMultiplayerClient.js';

/**
 * Wesnoth Authentication Service
 * Validates passwords against Wesnoth multiplayer server
 * Uses the official Wesnoth WML protocol (server.wesnoth.org:15000)
 */

/**
 * Validate username and password against Wesnoth multiplayer server
 * Uses the official WML protocol (server.wesnoth.org:15000)
 */
export async function validateWesnothPassword(
  password: string,
  username: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Use the multiplayer server for authentication
    const result = await validateWesnothCredentials(username, password);
    return result;
  } catch (error) {
    console.error('Password validation error:', error);
    return { valid: false, error: (error as Error).message };
  }
}

/**
 * Get user profile from Wesnoth server
 * For now, returns basic profile with email from environment or default values
 * In production, this would query the Wesnoth forums API
 */
export async function getWesnothUserProfile(username: string): Promise<{
  user_id: number;
  username: string;
  user_email: string;
  user_lang: string;
} | null> {
  try {
    // Note: This is a placeholder implementation
    // In production, you would query the Wesnoth forums API:
    // https://forums.wesnoth.org/ or the official Wesnoth API
    
    // For now, we return a basic profile structure
    // The actual email and language would need to be fetched from the forums API
    return {
      user_id: 0, // Will be set by server
      username: username,
      user_email: `${username}@wesnoth.org`, // Placeholder
      user_lang: 'en',
    };
  } catch (error) {
    console.error(`Failed to get Wesnoth user profile for ${username}:`, error);
    return null;
  }
}

/**
 * Auto-create user in users_extension table (on first login)
 * Returns the created user ID
 * Username is stored in lowercase for case-insensitive lookups
 */
export async function ensureUserExtensionExists(
  username: string,
  wesnothProfile: { user_email: string; user_lang: string }
): Promise<number> {
  try {
    // Using dynamic import for database query to avoid circular dependencies
    const { query } = await import('../config/database.js');

    // Normalize username to lowercase
    const normalizedUsername = username.toLowerCase();

    // Check if user already exists (case-insensitive)
    const existingUser = await query(
      'SELECT id FROM users_extension WHERE LOWER(username) = LOWER($1)',
      [normalizedUsername]
    );

    if (existingUser.rows.length > 0) {
      return existingUser.rows[0].id;
    }

    // Create new user record with Wesnoth profile data (store normalized username)
    await query(
      `INSERT INTO users_extension (
        username, email, language,
        elo_rating, level, is_active, is_blocked, is_admin, is_rated,
        matches_played, elo_provisional, total_wins, total_losses, trend,
        failed_login_attempts, locked_until, last_login_attempt, password_must_change,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3,
        1200, 'Beginner', true, false, false, false,
        0, false, 0, 0, '-',
        0, NULL, NULL, false,
        NOW(), NOW()
      )`,
      [normalizedUsername, wesnothProfile.user_email, wesnothProfile.user_lang || 'en']
    );

    // Get the created user ID
    const newUser = await query(
      'SELECT id FROM users_extension WHERE LOWER(username) = LOWER($1)',
      [normalizedUsername]
    );

    return newUser.rows[0].id;
  } catch (error) {
    console.error(`Failed to ensure user extension exists for ${username}:`, error);
    throw error;
  }
}

