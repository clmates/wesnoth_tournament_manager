/**
 * Forum Database Connection
 * File: backend/src/config/forumDatabase.ts
 * 
 * Purpose: Connection to Wesnoth forum database containing wesnothd_game_* tables
 * These tables track all game plays on the Wesnoth server
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
const envPath = path.resolve(__dirname, '../../', envFile);

dotenv.config({ path: envPath });

/**
 * Connection pool to forum database
 * Contains tables:
 * - wesnothd_game_info: Basic game information
 * - wesnothd_game_player_info: Player participation data
 * - wesnothd_game_content_info: Content (maps, addons) used in games
 */
const forumPool = mysql.createPool({
  host: process.env.FORUM_DB_HOST || process.env.DB_HOST || 'localhost',
  user: process.env.FORUM_DB_USER || process.env.DB_USER,
  password: process.env.FORUM_DB_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.FORUM_DB_NAME || 'forum',
  port: parseInt(process.env.FORUM_DB_PORT || process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

/**
 * Execute query on forum database
 * 
 * @param sql - SQL query with ? placeholders
 * @param values - Query parameters
 * @returns Raw query result
 */
export async function queryForum(sql: string, values?: any[]): Promise<any[]> {
  const connection = await forumPool.getConnection();
  try {
    const [results] = await connection.execute(sql, values || []);
    return results as any[];
  } finally {
    connection.release();
  }
}

/**
 * Get new games from forum database since a specific timestamp
 * 
 * @param lastCheckTimestamp - Only fetch games with END_TIME > this timestamp
 * @param limit - Maximum games to fetch (default 1000)
 * @returns Array of game records
 */
export async function getNewGamesFromForum(
  lastCheckTimestamp: Date,
  limit: number = 1000,
  wesnothVersion?: string
): Promise<any[]> {
  try {
    let query_str = `SELECT 
      INSTANCE_UUID,
      GAME_ID,
      INSTANCE_VERSION as wesnoth_version,
      GAME_NAME as game_name,
      START_TIME as start_time,
      END_TIME as end_time,
      REPLAY_NAME as replay_filename,
      OOS as oos,
      RELOAD as is_reload,
      PASSWORD,
      PUBLIC
    FROM wesnothd_game_info
    WHERE END_TIME > ?`;

    const params: any[] = [lastCheckTimestamp];

    // Filter by version if provided
    if (wesnothVersion) {
      query_str += ` AND INSTANCE_VERSION = ?`;
      params.push(wesnothVersion);
    }

    query_str += ` ORDER BY END_TIME DESC LIMIT ?`;
    params.push(limit);

    const results = await queryForum(query_str, params);

    return results;
  } catch (error) {
    console.error('Error fetching games from forum database:', error);
    throw error;
  }
}

/**
 * Get player information for a specific game
 * 
 * @param instanceUuid - Game instance UUID
 * @param gameId - Game ID
 * @returns Array of player records
 */
export async function getGamePlayers(
  instanceUuid: string,
  gameId: number
): Promise<any[]> {
  try {
    const results = await queryForum(
      `SELECT 
        INSTANCE_UUID,
        GAME_ID,
        USER_ID as user_id,
        SIDE_NUMBER as side_number,
        IS_HOST as is_host,
        FACTION,
        CLIENT_VERSION as client_version,
        USER_NAME as username,
        LEADERS
      FROM wesnothd_game_player_info
      WHERE INSTANCE_UUID = ? AND GAME_ID = ?
      ORDER BY SIDE_NUMBER`,
      [instanceUuid, gameId]
    );

    return results;
  } catch (error) {
    console.error('Error fetching game players from forum database:', error);
    throw error;
  }
}

/**
 * Get content (addons, maps) used in a specific game
 * 
 * @param instanceUuid - Game instance UUID
 * @param gameId - Game ID
 * @returns Array of content records
 */
export async function getGameContent(
  instanceUuid: string,
  gameId: number
): Promise<any[]> {
  try {
    const results = await queryForum(
      `SELECT 
        INSTANCE_UUID,
        GAME_ID,
        TYPE,
        ID,
        ADDON_ID,
        ADDON_VERSION as addon_version,
        NAME
      FROM wesnothd_game_content_info
      WHERE INSTANCE_UUID = ? AND GAME_ID = ?`,
      [instanceUuid, gameId]
    );

    return results;
  } catch (error) {
    console.error('Error fetching game content from forum database:', error);
    throw error;
  }
}

/**
 * Check if a game has tournament addon
 * 
 * @param instanceUuid - Game instance UUID
 * @param gameId - Game ID
 * @param tournamentAddonId - ID of tournament addon to check (e.g., "wesnoth_tournament")
 * @returns true if tournament addon is present
 */
export async function hasGameTournamentAddon(
  instanceUuid: string,
  gameId: number,
  tournamentAddonId: string
): Promise<boolean> {
  try {
    const results = await queryForum(
      `SELECT COUNT(*) as count FROM wesnothd_game_content_info
       WHERE INSTANCE_UUID = ? AND GAME_ID = ? AND ADDON_ID = ?`,
      [instanceUuid, gameId, tournamentAddonId]
    );

    return results.length > 0 && results[0].count > 0;
  } catch (error) {
    console.error('Error checking tournament addon:', error);
    return false;
  }
}

/**
 * Get tournament addon version used in a game
 * 
 * @param instanceUuid - Game instance UUID
 * @param gameId - Game ID
 * @param tournamentAddonId - ID of tournament addon
 * @returns Addon version or null if not found
 */
export async function getTournamentAddonVersion(
  instanceUuid: string,
  gameId: number,
  tournamentAddonId: string
): Promise<string | null> {
  try {
    const results = await queryForum(
      `SELECT ADDON_VERSION FROM wesnothd_game_content_info
       WHERE INSTANCE_UUID = ? AND GAME_ID = ? AND ADDON_ID = ?`,
      [instanceUuid, gameId, tournamentAddonId]
    );

    return results.length > 0 ? results[0].ADDON_VERSION : null;
  } catch (error) {
    console.error('Error getting tournament addon version:', error);
    return null;
  }
}

/**
 * Close forum database connection pool
 * Should be called on application shutdown
 */
export async function closeForumPool(): Promise<void> {
  try {
    await forumPool.end();
    console.log('Forum database connection pool closed');
  } catch (error) {
    console.error('Error closing forum database pool:', error);
  }
}

export default {
  queryForum,
  getNewGamesFromForum,
  getGamePlayers,
  getGameContent,
  hasGameTournamentAddon,
  getTournamentAddonVersion,
  closeForumPool
};
