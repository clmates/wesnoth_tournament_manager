import cron from 'node-cron';
import { query } from '../config/database.js';
import { calculatePlayerOfMonth } from './playerOfMonthJob.js';

/**
 * Initialize all scheduled jobs
 * Runs at specific times in UTC:
 * - 00:30 UTC: Daily balance snapshot
 * - 01:00 UTC: Check and mark inactive players
 * - 01:30 UTC on 1st: Calculate player of the month
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
    // Reactivates players who have had any recent activity (last 30 days)
    // Marks as inactive only those with NO activity in last 30 days
    cron.schedule('0 1 * * *', async () => {
      try {
        console.log('👤 [CRON] Running inactive player check...');
        
        // Get all players with recent matches in the last 30 days (regardless of status)
        const recentActivePlayersResult = await query(
          `SELECT DISTINCT u.id
           FROM users u
           INNER JOIN matches m ON (m.winner_id = u.id OR m.loser_id = u.id)
           WHERE m.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
           AND u.is_blocked = false`
        );
        
        const recentActivePlayers = recentActivePlayersResult.rows.map((r: any) => r.id);
        console.log(`📊 [CRON] Found ${recentActivePlayers.length} players with recent matches`);
        
        // STEP 1: Reactivate all players with recent activity
        if (recentActivePlayers.length > 0) {
          const placeholders = recentActivePlayers.map((_, i) => `$${i + 1}`).join(',');
          const activeResult = await query(
            `UPDATE users 
             SET is_active = true, updated_at = CURRENT_TIMESTAMP
             WHERE id IN (${placeholders})
             AND is_blocked = false
             RETURNING id`,
            recentActivePlayers
          );
          console.log(`✅ [CRON] Reactivated ${activeResult.rows.length} players with recent activity`);
        }
        
        // STEP 2: Mark as inactive players with NO activity in last 30 days
        const inactiveResult = await query(
          `UPDATE users 
           SET is_active = false, updated_at = CURRENT_TIMESTAMP
           WHERE is_blocked = false
             AND id NOT IN (
               SELECT DISTINCT u.id
               FROM users u
               INNER JOIN matches m ON (m.winner_id = u.id OR m.loser_id = u.id)
               WHERE m.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
             )
           RETURNING id`
        );
        console.log(`✅ [CRON] Marked ${inactiveResult.rows.length} players as inactive (no recent matches)`);
      } catch (error) {
        console.error('❌ [CRON] Failed to check inactive players:', error);
      }
    });
    
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
    console.log('   - Player of month: 1st of month at 01:30 UTC');
  } catch (error) {
    console.error('❌ Failed to initialize scheduler:', error);
    process.exit(1);
  }
};
