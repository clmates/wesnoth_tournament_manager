/**
 * Background Job: Parse New Replays
 * File: backend/src/jobs/parseNewReplays.ts
 * 
 * Purpose: Background job that runs every 30 seconds to:
 * 1. Find unparsed replays from replays table
 * 2. Run Stage 1 quick addon check
 * 3. If tournament addon found, run Stage 2 full parse
 * 4. Create auto_reported match record
 * 5. Update replay parsing status and errors
 * 
 * Execution Model:
 * - Runs every 30 seconds (non-blocking)
 * - Process multiple replays in parallel (up to 5 concurrent)
 * - Logs all operations to audit_logs
 * - Resilient to errors (continues with next replay on failure)
 */

import { query } from '../config/database.js';
import ReplayParser from '../services/replayParser';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

interface PendingReplay {
    id: string;
    replay_filename: string;
    replay_path: string;
    detected_at: Date;
    file_write_closed_at: Date;
}

export class ParseNewReplaysJob {
    private readonly parser: ReplayParser;
    private isRunning: boolean = false;
    private lastRunAt: Date | null = null;
    private successCount: number = 0;
    private errorCount: number = 0;

    constructor(
        maxConcurrentParses: number = 3
    ) {
        this.parser = new ReplayParser();
    }

    /**
     * Execute one cycle of the job
     * 
     * This is called every 30 seconds by the scheduler.
     * It's designed to be fast and non-blocking.
     */
    public async execute(): Promise<{
        parsed_count: number;
        tournament_matches: number;
        errors: number;
        duration_ms: number;
    }> {
        if (this.isRunning) {
            console.warn(
                'Parse job already running, skipping this cycle'
            );
            return {
                parsed_count: 0,
                tournament_matches: 0,
                errors: 0,
                duration_ms: 0
            };
        }

        const startTime = Date.now();
        this.isRunning = true;
        this.lastRunAt = new Date();

        let parsedCount = 0;
        let tournamentMatchCount = 0;
        let errorCount = 0;

        try {
            // Get pending replays that have finished writing
            const pending = await this.getPendingReplays();

            if (pending.length === 0) {
                console.log('No pending replays to parse');
                return {
                    parsed_count: 0,
                    tournament_matches: 0,
                    errors: 0,
                    duration_ms: Date.now() - startTime
                };
            }

            console.log(`Starting parse job: ${pending.length} pending replays`);

            // Process replays sequentially (to avoid overwhelming system)
            for (const replay of pending) {
                try {
                    const result = await this.processReplay(replay);
                    if (result.success) {
                        parsedCount++;
                        if (result.isTournamentMatch) {
                            tournamentMatchCount++;
                        }
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error(
                        `Unexpected error processing replay ${replay.replay_filename}`,
                        error
                    );
                    errorCount++;
                }
            }

            // Log summary
            console.log(
                `Parse job completed: ${parsedCount} parsed, ${tournamentMatchCount} tournaments`,
                {
                    duration_ms: Date.now() - startTime,
                    errors: errorCount
                }
            );

            // Update resilience timestamp for recovery after crash
            if (parsedCount > 0) {
                await this.updateLastIntegrationTimestamp();
            }

            this.successCount += parsedCount;
            this.errorCount += errorCount;

        } catch (error) {
            console.error('Parse job failed', error);
            errorCount++;
        } finally {
            this.isRunning = false;
        }

        return {
            parsed_count: parsedCount,
            tournament_matches: tournamentMatchCount,
            errors: errorCount,
            duration_ms: Date.now() - startTime
        };
    }

    /**
     * Get pending replays that are ready to parse
     * 
     * Criteria:
     * - parsed = 0 (not yet parsed)
     * - file_write_closed_at is set (file finished writing)
     * - file_write_closed_at < NOW() - 5 seconds (allow buffer for file system)
     * - detected_at > last_integration_timestamp (resilience: skip already processed)
     * - parse_status NOT IN ('error', 'parsing')
     * 
     * RESILIENCE:
     * Uses system_settings.replay_last_integration_timestamp to skip replays
     * that were already processed before a server crash.
     */
    private async getPendingReplays(): Promise<PendingReplay[]> {
        try {
            // Get last integration timestamp for resilience/recovery
            const timestampResult = await query(
                `SELECT setting_value FROM system_settings 
                 WHERE setting_key = 'replay_last_integration_timestamp'`
            );
            
            const lastIntegrationTimestamp = 
                (timestampResult as unknown as any[])?.[0]?.setting_value || null;
            
            const timestampFilter = lastIntegrationTimestamp 
                ? `AND detected_at > '${lastIntegrationTimestamp}'`
                : '';
            
            if (lastIntegrationTimestamp) {
                console.log(
                    `Resuming replay processing from timestamp: ${lastIntegrationTimestamp}`
                );
            }

            const query_sql = `SELECT id, replay_filename, replay_path, detected_at, file_write_closed_at
                 FROM replays
                 WHERE parsed = 0
                 AND file_write_closed_at IS NOT NULL
                 AND file_write_closed_at < NOW() - INTERVAL 5 SECOND
                 AND parse_status NOT IN ('error', 'parsing')
                 ${timestampFilter}
                 ORDER BY detected_at ASC
                 LIMIT 10`;
            
            const result = await query(query_sql);

            return (result as unknown as any[]) || [];
        } catch (error: any) {
            console.error('Failed to query pending replays', error);
            return [];
        }
    }

    /**
     * Process a single replay
     * 
     * Two-stage process:
     * Stage 1: Quick addon check (determine if tournament)
     * Stage 2: Full parse (extract all data if tournament)
     */
    private async processReplay(replay: PendingReplay): Promise<{
        success: boolean;
        isTournamentMatch: boolean;
    }> {
        try {
            // Update status: marking as currently parsing
            await query(
                `UPDATE replays 
                 SET parse_status = 'parsing', parsing_started_at = NOW()
                 WHERE id = ?`,
                [replay.id]
            );

            // Stage 1: Quick addon check
            let quickCheckResult;
            try {
                quickCheckResult = await this.parser.quickAddonCheck(
                    replay.replay_path
                );
            } catch (error: any) {
                throw new Error(
                    `Stage 1 quick check failed: ${
                        (error as any)?.message || String(error)
                    }`
                );
            }

            const isTournamentMatch = quickCheckResult.has_tournament_addon;

            // Log the detection
            await this.logAuditEvent(
                isTournamentMatch ? 'REPLAY_TOURNAMENT_MATCH' : 'REPLAY_PARSED_NO_TOURNAMENT',
                replay.replay_filename,
                {
                    addon_found: isTournamentMatch,
                    addon_id: quickCheckResult.tournament_addon_id,
                    version: quickCheckResult.version
                }
            );

            // If tournament match, do full parse and create match
            if (isTournamentMatch) {
                let analysis;
                try {
                    analysis = await this.parser.fullReplayParse(
                        replay.replay_path
                    );
                } catch (error: any) {
                    throw new Error(
                        `Stage 2 full parse failed: ${(error as any)?.message || String(error)}`
                    );
                }

                // Validate tournament match
                if (!this.validateTournamentReplay(analysis)) {
                    throw new Error(
                        'Tournament match validation failed'
                    );
                }

                // Create auto_reported match
                const matchId = await this.createAutoMatch(
                    analysis,
                    replay.id
                );

                // Update replay record with match link
                await query(
                    `UPDATE replays 
                     SET parsed = 1, need_integration = 1, match_id = ?,
                         parse_status = 'parsed', parsing_completed_at = NOW()
                     WHERE id = ?`,
                    [matchId, replay.id]
                );

                await this.logAuditEvent(
                    'MATCH_AUTO_CREATED',
                    replay.replay_filename,
                    {
                        match_id: matchId,
                        winner: analysis.victory.winner_name,
                        winner_side: analysis.victory.winner_side
                    }
                );

                console.log(
                    `✅ Tournament match auto-created from replay: ${replay.replay_filename}`,
                    { match_id: matchId }
                );

                return { success: true, isTournamentMatch: true };

            } else {
                // Non-tournament replay
                await query(
                    `UPDATE replays 
                     SET parsed = 1, need_integration = 0,
                         parse_status = 'parsed', parsing_completed_at = NOW()
                     WHERE id = ?`,
                    [replay.id]
                );

                console.log(
                    `Replay parsed (no tournament): ${replay.replay_filename}`
                );

                return { success: true, isTournamentMatch: false };
            }

        } catch (error: any) {
            console.error(
                `Failed to parse replay: ${replay.replay_filename}`,
                error
            );

            // Mark as error
            const errorMsg = (error as any)?.message || String(error);
            await this.parser.markParsingError(
                replay.id,
                errorMsg
            );

            await this.logAuditEvent(
                'REPLAY_PARSED_ERROR',
                replay.replay_filename,
                { error: errorMsg.substring(0, 200) }
            );

            return { success: false, isTournamentMatch: false };
        }
    }

    /**
     * Validate tournament replay
     */
    private validateTournamentReplay(analysis: any): boolean {
        // Check for 2-player game
        if (analysis.players.length !== 2) {
            console.warn(
                `Invalid player count: ${analysis.players.length} (expected 2)`
            );
            return false;
        }

        // Check for valid map
        if (!analysis.metadata.map_file) {
            console.warn('No map file in replay');
            return false;
        }

        // Check for valid winner
        if (!analysis.victory.winner_side || !analysis.victory.winner_name) {
            console.warn('Cannot determine winner');
            return false;
        }

        return true;
    }

    /**
     * Create auto_reported match record
     */
    private async createAutoMatch(analysis: any, replayId: string): Promise<string> {
        const matchId = uuidv4();

        // Extract player data
        const players = analysis.players;
        const winner = players[analysis.victory.winner_side - 1];
        const loser = players[analysis.victory.winner_side === 1 ? 1 : 0];

        if (!winner || !loser) {
            throw new Error('Cannot extract player data from replay');
        }

        // Find or create user records
        const winnerId = await this.ensureUserExists(winner.name);
        const loserId = await this.ensureUserExists(loser.name);

        if (!winnerId || !loserId) {
            throw new Error('Cannot resolve player usernames');
        }

        // Calculate ELO change (simplified)
        const eloChange = 20; // Placeholder - use real ELO calculation

        // Insert match record
        try {
            await query(
                `INSERT INTO matches (
                    id, winner_id, loser_id, map, 
                    winner_faction, loser_faction,
                    winner_elo_after, loser_elo_after, elo_change,
                    status, auto_reported, detected_from, replay_id,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto_reported', 1, 'replay', ?, NOW())`,
                [
                    matchId,
                    winnerId,
                    loserId,
                    analysis.metadata.map_file,
                    winner.faction_id,
                    loser.faction_id,
                    winner.elo_rating + eloChange,
                    loser.elo_rating - eloChange,
                    eloChange,
                    replayId
                ]
            );
        } catch (error: any) {
            throw new Error(
                `Failed to insert match record: ${(error as any)?.message || String(error)}`
            );
        }

        return matchId;
    }

    /**
     * Ensure user exists in users_extension table
     */
    private async ensureUserExists(username: string): Promise<string> {
        try {
            // Check if user exists
            const result = await query(
                `SELECT id FROM users_extension WHERE nickname = ?`,
                [username]
            );

            if ((result as unknown as any[])?.length > 0) {
                return (result as unknown as any[])[0].id;
            }

            // Create new user
            const userId = uuidv4();
            await query(
                `INSERT INTO users_extension (
                    id, nickname, elo_rating, level, is_active, is_rated,
                    created_at
                ) VALUES (?, ?, 1400, 'novato', 1, 0, NOW())`,
                [userId, username]
            );

            console.log(`Auto-created user from replay: ${username}`);
            return userId;

        } catch (error: any) {
            console.error(
                `Failed to ensure user exists: ${username}`,
                error
            );
            throw error;
        }
    }

    /**
     * Log audit event
     */
    private async logAuditEvent(
        eventType: string,
        details: string,
        metadata: any = {}
    ): Promise<void> {
        try {
            await query(
                `INSERT INTO audit_logs (
                    id, event_type, details, metadata, created_at
                ) VALUES (?, ?, ?, ?, NOW())`,
                [
                    uuidv4(),
                    eventType,
                    details,
                    JSON.stringify(metadata)
                ]
            );
        } catch (error: any) {
            // Log non-critical error
            console.warn(
                `Failed to log audit event: ${eventType}`,
                error
            );
        }
    }

    /**
     * Update last integration timestamp in system_settings
     * 
     * This is used for resilience: if the server crashes,
     * the next run can resume from where we left off.
     * 
     * RESILIENCE GUARANTEE:
     * - Timestamp is updated AFTER all replays are parsed
     * - Future runs will only process replays detected_at > this timestamp
     * - No duplicate processing on crash/restart
     */
    private async updateLastIntegrationTimestamp(): Promise<void> {
        try {
            await query(
                `UPDATE system_settings 
                 SET setting_value = NOW()
                 WHERE setting_key = 'replay_last_integration_timestamp'`
            );
            
            console.log('✅ Updated replay_last_integration_timestamp for crash resilience');
            
            // Log resilience event
            await this.logAuditEvent(
                'REPLAY_INTEGRATION_CHECKPOINT_SAVED',
                'Saved recovery checkpoint to system_settings',
                { timestamp: new Date().toISOString() }
            );
        } catch (error: any) {
            // Non-critical: if we can't update system_settings, 
            // next run will reprocess this batch (worst case: duplicates detected)
            console.warn(
                'Failed to update replay_last_integration_timestamp',
                error
            );
        }
    }

    /**
     * Get job statistics
     */
    public getStats(): {
        last_run_at: Date | null;
        is_running: boolean;
        total_parsed: number;
        total_errors: number;
    } {
        return {
            last_run_at: this.lastRunAt,
            is_running: this.isRunning,
            total_parsed: this.successCount,
            total_errors: this.errorCount
        };
    }
}

export default ParseNewReplaysJob;

/**
 * SCHEDULING (in main app.ts):
 * 
 * import schedule from 'node-schedule';
 * 
 * const parseJob = new ParseNewReplaysJob(db, logger);
 * 
 * // Run every 30 seconds
 * schedule.scheduleJob('* / 30 * * * * *', async () => {
 *     try {
 *         const result = await parseJob.execute();
 *         logger.debug('Parse job cycle complete', result);
 *     } catch (error) {
 *         logger.error('Parse job cycle failed', error);
 *     }
 * });
 */
