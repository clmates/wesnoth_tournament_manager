import cron from 'node-cron';
import { query } from '../config/database.js';
import { calculatePlayerOfMonth } from './playerOfMonthJob.js';
import ReplayParser from '../services/replayParser.js';
import { v4 as uuidv4 } from 'uuid';

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
    // Marks players as inactive if they have no matches in the last 30 days
    cron.schedule('0 1 * * *', async () => {
      try {
        console.log('👤 [CRON] Running inactive player check...');
        const result = await query(
          `UPDATE users 
           SET is_active = false, updated_at = CURRENT_TIMESTAMP
           WHERE is_active = true 
             AND is_blocked = false
             AND id NOT IN (
               SELECT DISTINCT u.id
               FROM users u
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
    
    // Schedule replay parsing job every minute
    // Processes pending replays, extracts metadata, and prepares for match integration
    const replayParser = new ReplayParser();
    cron.schedule('* * * * *', async () => {
      try {
        console.log('🎬 [CRON] Starting replay parsing job...');
        
        // Get all pending replays (max 3 concurrent)
        // Process replays detected more than 30 seconds ago (sufficient time for write completion)
        const pendingReplaysResult = await query(
          `SELECT id, replay_filename, replay_path, file_write_closed_at
           FROM replays
           WHERE parse_status = 'pending' 
             AND parsed = 0 
             AND detected_at < NOW() - INTERVAL 30 SECOND
           ORDER BY detected_at ASC
           LIMIT 3`
        );
        
        const pendingReplays = (pendingReplaysResult as any).rows || (pendingReplaysResult as unknown as any[]);
        
        let parsedCount = 0;
        
        if (pendingReplays.length === 0) {
          console.log('ℹ️  [CRON] No pending replays to parse');
        } else {
          console.log(`🎬 [CRON] Found ${pendingReplays.length} replays to parse`);
          
          // Process each replay
          for (const replay of pendingReplays) {
            try {
              const replayId = replay.id;
              const replayPath = replay.replay_path;
              const replayFilename = replay.replay_filename;
              
              console.log(`🎬 [PARSING] Starting: ${replayFilename}`);
              
              // Log: parsing started
              await replayParser.addParsingLog(replayId, 'addon_check', 'started');
              
              // Stage 1: Quick addon check
              const quickCheck = await replayParser.quickAddonCheck(replayPath);
              
              // Log: addon check completed
              await replayParser.addParsingLog(replayId, 'addon_check', 'success', {
                has_tournament_addon: quickCheck.has_tournament_addon,
                tournament_addon_id: quickCheck.tournament_addon_id,
                version: quickCheck.version,
                era_id: quickCheck.era_id
              });
              
              // If not a tournament match, mark as parsed but don't integrate
              if (!quickCheck.has_tournament_addon) {
                console.log(`ℹ️  [PARSING] Not a tournament match: ${replayFilename}`);
                
                await query(
                  `UPDATE replays 
                   SET parse_status = 'success', 
                       parsed = 1, 
                       need_integration = 0,
                       parse_summary = 'Non-tournament replay (no tournament addon detected)',
                       parsing_completed_at = NOW()
                   WHERE id = ?`,
                  [replayId]
                );
                
                await replayParser.addParsingLog(replayId, 'integration_decision', 'success', {
                  decision: 'skip_no_tournament_addon'
                });
                
                parsedCount++;
                continue;
              }
              
              // Stage 2: Full parse for tournament matches
              console.log(`🎬 [PARSING] Full parse: ${replayFilename}`);
              await replayParser.addParsingLog(replayId, 'full_parse', 'started');
              
              const analysis = await replayParser.fullReplayParse(replayPath);
              
              // Log: full parse completed
              await replayParser.addParsingLog(replayId, 'full_parse', 'success', {
                players_count: analysis.players.length,
                map: analysis.metadata.scenario_name,
                era: analysis.metadata.era_id,
                winner: analysis.victory.winner_name
              });
              
              // Update replay record with parsed data
              await replayParser.updateReplayRecord(replayId, analysis, true);
              
              // Log: integration marked
              await replayParser.addParsingLog(replayId, 'mark_for_integration', 'success', {
                action: `need_integration = 1, confidence = ${analysis.victory.confidence_level} (0=discarded, 1=pending_confirm, 2=auto)`,
                summary: replayParser.generateSummary(analysis)
              });
              
              console.log(`✅ [PARSING] Completed: ${replayFilename}`);
              parsedCount++;
              
            } catch (error) {
              const errorMsg = (error as any)?.message || String(error);
              console.error(`❌ [PARSING] Failed for ${replay.replay_filename}:`, errorMsg);
              
              // Mark as failed
              await replayParser.markParsingError(replay.id, errorMsg);
              
              // Log the error
              await replayParser.addParsingLog(replay.id, 'parse_error', 'error', undefined, errorMsg);
            }
          }
        }
        
        // Update last integration timestamp if any replays were processed
        if (parsedCount > 0) {
          await query(
            `UPDATE system_settings 
             SET setting_value = ?, updated_at = NOW()
             WHERE setting_key = 'replay_last_integration_timestamp'`,
            [new Date().toISOString()]
          );
          console.log(`✅ Updated integration timestamp after parsing ${parsedCount} replay(s)`);
        }
        
        // Always update last check timestamp (whether or not replays were processed)
        await query(
          `UPDATE system_settings 
           SET setting_value = ?, updated_at = NOW()
           WHERE setting_key = 'replay_last_check_timestamp'`,
          [new Date().toISOString()]
        );
        
        console.log('✅ [CRON] Replay parsing job completed');
        
      } catch (error) {
        console.error('❌ [CRON] Replay parsing job failed:', error);
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
    console.log('   - Replay parsing: Every minute (max 3 concurrent)');
    console.log('   - Player of month: 1st of month at 01:30 UTC');
  } catch (error) {
    console.error('❌ Failed to initialize scheduler:', error);
    process.exit(1);
  }
};
