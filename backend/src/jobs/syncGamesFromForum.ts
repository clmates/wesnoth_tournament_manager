/**
 * Background Job: Sync Games From Forum Database
 * File: backend/src/jobs/syncGamesFromForum.ts
 * 
 * Purpose: Background job that runs every 60 seconds to:
 * 1. Query forum database (wesnothd_game_info) for new games
 * 2. Filter by tournament addon presence
 * 3. Insert new games into replays table as pending parse
 * 4. Update last_check_timestamp in system_settings
 * 
 * Execution Model:
 * - Runs every 60 seconds (non-blocking)
 * - Fetches up to REPLAY_SYNC_BATCH_SIZE games per run (default 1000)
 * - Uses instance_uuid + game_id as unique constraint to prevent duplicates
 * - Logs all operations to console
 * - Resilient to errors (continues processing even if some games fail)
 */

import { query } from '../config/database.js';
import { 
  getNewGamesFromForum, 
  getGamePlayers, 
  getGameContent,
  hasGameTournamentAddon,
  getTournamentAddonVersion
} from '../config/forumDatabase.js';
import { v4 as uuidv4 } from 'uuid';

interface ForumGame {
  INSTANCE_UUID: string;
  GAME_ID: number;
  wesnoth_version: string;
  game_name: string;
  start_time: string;
  end_time: string;
  replay_filename: string;
  oos: number;
  is_reload: number;
}

export class SyncGamesFromForumJob {
  private isRunning: boolean = false;
  private lastRunAt: Date | null = null;
  private successCount: number = 0;
  private errorCount: number = 0;

  /**
   * Execute one cycle of the sync job
   * Fetches new games from forum database and inserts them into replays table
   */
  async executeSync(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  [FORUM SYNC] Job already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    this.successCount = 0;
    this.errorCount = 0;

    try {
      console.log('🌐 [FORUM SYNC] Starting forum database sync...');
      this.lastRunAt = new Date();

      // Get last check timestamp from system_settings
      const settingsResult = await query(
        `SELECT setting_value FROM system_settings 
         WHERE setting_key = 'replay_last_check_timestamp'`
      );

      let lastCheckTimestamp = new Date('2026-01-01T00:00:00Z');
      
      if (settingsResult && (settingsResult as any).rows && (settingsResult as any).rows.length > 0) {
        const storedValue = (settingsResult as any).rows[0].setting_value;
        if (storedValue) {
          try {
            lastCheckTimestamp = new Date(storedValue);
          } catch (e) {
            console.warn('⚠️  [FORUM SYNC] Invalid stored timestamp, using default');
          }
        }
      }

      console.log(`🌐 [FORUM SYNC] Last check timestamp: ${lastCheckTimestamp.toISOString()}`);

      // Get wesnoth version from environment
      const wesnothVersion = process.env.WESNOTH_VERSION || '1.18';
      const syncBatchSize = parseInt(process.env.REPLAY_SYNC_BATCH_SIZE || '1000', 10);

      console.log(`🌐 [FORUM SYNC] Querying forum for games since ${lastCheckTimestamp.toISOString()} (version: ${wesnothVersion})`);

      // Fetch new games from forum database
      const gamesResult = await getNewGamesFromForum(lastCheckTimestamp, syncBatchSize);
      
      if (!gamesResult || gamesResult.length === 0) {
        console.log('ℹ️  [FORUM SYNC] No new games found');
        this.updateLastCheckTimestamp();
        return;
      }

      console.log(`🌐 [FORUM SYNC] Found ${gamesResult.length} new games from forum`);

      // The "Ranked" addon is used to mark games for auto-reporting
      // This includes both ranked global matches and tournament-specific matches
      const rankedAddonName = 'Ranked';

      // Process each game
      for (const game of gamesResult) {
        try {
          const instanceUuid = game.INSTANCE_UUID;
          const gameId = game.GAME_ID;

          console.log(`🌐 [FORUM SYNC] Processing game: ${game.game_name} (${instanceUuid}:${gameId})`);

          // Check if game already exists in replays table
          const existsResult = await query(
            `SELECT id FROM replays 
             WHERE instance_uuid = ? AND game_id = ?`,
            [instanceUuid, gameId]
          );

          if (existsResult && (existsResult as any).rows && (existsResult as any).rows.length > 0) {
            console.log(`ℹ️  [FORUM SYNC] Game already in database: ${game.game_name}`);
            continue;
          }

          // Check if tournament addon is present in this game
          const hasRankedAddon = await hasGameTournamentAddon(instanceUuid, gameId, rankedAddonName);

          if (!hasRankedAddon) {
            console.log(`ℹ️  [FORUM SYNC] Ranked addon not found for: ${game.game_name}`);
            continue;
          }

          // Get Ranked addon version
          const addonVersion = await getTournamentAddonVersion(instanceUuid, gameId, rankedAddonName);

          // Create replay record
          const replayId = uuidv4();
          const replayUrl = `https://replays.wesnoth.org/${game.wesnoth_version}/${this.formatDate(new Date(game.end_time))}/${game.replay_filename}.wrz`;

          console.log(`✅ [FORUM SYNC] Creating replay record: ${replayId}`);

          await query(
            `INSERT INTO replays (
              id,
              instance_uuid,
              game_id,
              replay_filename,
              replay_path,
              wesnoth_version,
              game_name,
              start_time,
              end_time,
              oos,
              is_reload,
              detection_confidence,
              detected_from,
              replay_url,
              parse_status,
              parsed,
              need_integration,
              created_at,
              updated_at,
              last_checked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
            [
              replayId,
              instanceUuid,
              gameId,
              game.replay_filename,
              '', // Empty path - not using filesystem for this implementation
              game.wesnoth_version,
              game.game_name,
              game.start_time,
              game.end_time,
              (game.oos ? 1 : 0), // Ensure boolean/0 or 1
              (game.is_reload ? 1 : 0), // Ensure boolean/0 or 1
              2, // Default confidence from forum
              'forum',
              replayUrl,
              'new', // pending initial parse
              0, // Not yet parsed
              1, // Needs integration
            ]
          );

          this.successCount++;
          console.log(`✅ [FORUM SYNC] Replay created: ${game.game_name}`);

        } catch (error) {
          this.errorCount++;
          const errorMsg = (error as any)?.message || String(error);
          console.error(`❌ [FORUM SYNC] Failed to process game ${game.game_name}:`, errorMsg);
          
          // Continue with next game despite error
        }
      }

      console.log(`✅ [FORUM SYNC] Processed ${this.successCount} games successfully (${this.errorCount} errors)`);

      // Update last check timestamp
      await this.updateLastCheckTimestamp();

    } catch (error) {
      this.errorCount++;
      const errorMsg = (error as any)?.message || String(error);
      console.error('❌ [FORUM SYNC] Job failed:', errorMsg);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Update last_check_timestamp in system_settings
   */
  private async updateLastCheckTimestamp(): Promise<void> {
    try {
      const now = new Date().toISOString();
      await query(
        `UPDATE system_settings 
         SET setting_value = ?, updated_at = NOW()
         WHERE setting_key = 'replay_last_check_timestamp'`,
        [now]
      );
      console.log(`✅ [FORUM SYNC] Updated last check timestamp: ${now}`);
    } catch (error) {
      console.error('❌ [FORUM SYNC] Failed to update timestamp:', error);
    }
  }

  /**
   * Format date as YYYY/MM/DD for replay URL
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      successCount: this.successCount,
      errorCount: this.errorCount
    };
  }
}

export default SyncGamesFromForumJob;
