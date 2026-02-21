import cron from 'node-cron';
import { query } from '../config/database.js';
import { calculatePlayerOfMonth } from './playerOfMonthJob.js';
import { SyncGamesFromForumJob } from './syncGamesFromForum.js';
import ParseNewReplaysRefactored from './parseNewReplaysRefactored.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Initialize all scheduled jobs
 * Runs at specific times in UTC:
 * - 00:30 UTC: Daily balance snapshot
 * - 01:00 UTC: Check and mark inactive players
 * - 01:30 UTC on 1st: Calculate player of the month
 * - Every 60s: Sync new games from forum database
 * - Every 30s: Parse unparsed replays and create matches
 */
export const initializeScheduledJobs = (): void => {
  try {
    console.log('⏰ Initializing scheduled jobs...');

    // Schedule daily balance snapshot at 00:30 UTC
    cron.schedule('30 0 * * *', async () => {
      try {
        console.log('⏰ [CRON] Running daily balance snapshot...');
        await query('SELECT daily_snapshot_faction_map_statistics()');
        console.log('✅ [CRON] Daily balance snapshot completed');
      } catch (error) {
        console.error('❌ [CRON] Failed to create daily snapshot:', error);
      }
    });
    
    // Schedule daily inactive player check at 01:00 UTC
    // Marks players as inactive if they have no matches in the last 30 days
    cron.schedule('0 1 * * *', async () => {
      try {
        console.log('👤 [CRON] Running inactive player check...');
        const result = await query(
          `UPDATE users_extension 
           SET is_active = false, updated_at = CURRENT_TIMESTAMP
           WHERE is_active = true 
             AND is_blocked = false
             AND id NOT IN (
               SELECT DISTINCT u.id
               FROM users_extension u
               INNER JOIN matches m ON (m.winner_id = u.id OR m.loser_id = u.id)
               WHERE m.status != 'cancelled' 
                 AND m.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
             )
           RETURNING id`
        );
        console.log(`✅ [CRON] Marked ${result.rows.length} players as inactive`);
      } catch (error) {
        console.error('❌ [CRON] Failed to check inactive players:', error);
      }
    });

    // Schedule forum database sync job every 60 seconds
    // Fetches new games from forum database and inserts them into replays table
    const forumSyncJob = new SyncGamesFromForumJob();
    
    const forumSyncIntervalSeconds = 60;
    const forumSyncIntervalMs = forumSyncIntervalSeconds * 1000;

    setInterval(async () => {
      try {
        await forumSyncJob.executeSync();
      } catch (error) {
        console.error('❌ [FORUM SYNC] Job execution failed:', error);
      }
    }, forumSyncIntervalMs);

    // Schedule replay parsing job every 30 seconds
    // Parses unparsed replays from forum database integration
    // Extracts victory conditions and creates/updates matches
    const parseNewReplaysRefactored = new ParseNewReplaysRefactored();
    
    const replayParseIntervalSeconds = 30;
    const replayParseIntervalMs = replayParseIntervalSeconds * 1000;

    setInterval(async () => {
      try {
        await parseNewReplaysRefactored.execute();
      } catch (error) {
        console.error('❌ [PARSE] Job execution failed:', error);
      }
    }, replayParseIntervalMs);
    
    // Schedule player of month calculation at 01:30 UTC on the 1st of every month
    cron.schedule('30 1 1 * *', async () => {
      try {
        console.log('🎯 [CRON] Calculating player of the month...');
        await calculatePlayerOfMonth();
        console.log('✅ [CRON] Player of month calculated');
      } catch (error) {
        console.error('❌ [CRON] Failed to calculate player of month:', error);
      }
    });
    
    console.log('✅ Scheduled jobs initialized:');
    console.log('   - Balance snapshot: Daily at 00:30 UTC');
    console.log('   - Inactive players check: Daily at 01:00 UTC');
    console.log('   - Forum database sync: Every 60 seconds');
    console.log('   - Replay parsing & match creation: Every 30 seconds');
    console.log('   - Player of month: 1st of month at 01:30 UTC');
  } catch (error) {
    console.error('❌ Failed to initialize scheduler:', error);
    process.exit(1);
  }
};
