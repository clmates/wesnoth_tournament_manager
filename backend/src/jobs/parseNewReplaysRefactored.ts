/**
 * Background Job: Parse New Replays (Refactored for Forum Database)
 * File: backend/src/jobs/parseNewReplaysRefactored.ts
 * 
 * Purpose: Background job that runs every 30 seconds to:
 * 1. Find unparsed replays from forum database integration (parse_status = 'new')
 * 2. Parse replay file (minimal - victory conditions only)
 * 3. Extract confidence level from victory conditions
 * 4. Create or update match record
 * 5. Apply ELO ratings immediately if confidence=2
 * 
 * Execution Model:
 * - Runs every 30 seconds (non-blocking)
 * - Process multiple replays in batch (up to configured batch size)
 * - Logs all operations to console
 * - Resilient to errors (continues with next replay on failure)
 * 
 * Data Flow:
 * Forum DB (wesnothd_game_*) 
 *   ↓ (syncGamesFromForum job)
 * replays table (parse_status='new', parsed=0)
 *   ↓ (this job)
 * Parse victory conditions from replay URL
 *   ↓
 * matches table (status='confirmed' or 'pending_report')
 *   ↓ (if confidence=2)
 * Apply ELO ratings
 */

import { query } from '../config/database.js';
import ReplayParser from '../services/replayParser.js';
import { createOrUpdateMatch, ParsedReplay, ParsedVictory } from '../utils/createOrUpdateMatch.js';
import { parseRankedReplay, ParsedRankedReplay } from '../utils/replayRankedParser.js';
import { findTournamentByName, verifyPlayersInTournament, findTournamentMatchRecord } from '../utils/tournamentLookup.js';
import { validateRankedAssets } from '../utils/assetValidator.js';
import * as fs from 'fs';
import * as path from 'path';

interface UnparsedReplay {
  id: string;
  replay_filename: string;
  replay_url: string;
  wesnoth_version: string;
  game_name: string;
  start_time: string;
  end_time: string;
}

export class ParseNewReplaysRefactored {
  private readonly parser: ReplayParser;
  private isRunning: boolean = false;
  private lastRunAt: Date | null = null;
  private successCount: number = 0;
  private errorCount: number = 0;

  constructor() {
    this.parser = new ReplayParser();
  }

  /**
   * Execute one cycle of the parse job
   * Called every 30 seconds by the scheduler
   */
  async execute(): Promise<{
    parsed_count: number;
    match_count: number;
    errors: number;
    duration_ms: number;
  }> {
    if (this.isRunning) {
      console.log('⚠️  [PARSE] Job already running, skipping this cycle');
      return {
        parsed_count: 0,
        match_count: 0,
        errors: 0,
        duration_ms: 0
      };
    }

    const startTime = Date.now();
    this.isRunning = true;
    this.lastRunAt = new Date();

    let parsedCount = 0;
    let matchCount = 0;
    let errorCount = 0;

    try {
      console.log('🎬 [PARSE] Starting replay parsing job...');

      // Get unparsed replays from forum database integration
      const unparsedReplays = await this.getUnparsedReplays();

      if (unparsedReplays.length === 0) {
        console.log('ℹ️  [PARSE] No unparsed replays');
        return {
          parsed_count: 0,
          match_count: 0,
          errors: 0,
          duration_ms: Date.now() - startTime
        };
      }

      console.log(`🎬 [PARSE] Found ${unparsedReplays.length} unparsed replays`);

      // Process each replay
      for (const replay of unparsedReplays) {
        try {
          console.log(`🎬 [PARSE] Processing: ${replay.game_name} (${replay.replay_filename})`);

          // Parse replay file from URL using Ranked addon parser
          const parsed = await this.parseReplayFromUrl(replay);

          if (!parsed || !parsed.victory) {
            console.warn(`⚠️  [PARSE] No victory data found for: ${replay.game_name}`);
            errorCount++;
            continue;
          }

          // Extract winner and loser from parsed data
          const isWinner = (userId: string, players: any[]) => {
            const player = players.find(p => p.name === userId);
            return player && player.side === parsed.victory.winner_side;
          };

          // ============================================================================
          // LOGIC: Determine if this is ranked or tournament match
          // ============================================================================
          
          let matchType: 'ranked' | 'tournament_ranked' | 'tournament_unranked' | 'rejected' = 'rejected';
          let tournament: any = null;
          let teamInfo: any = null;
          let confidenceLevel: 1 | 2 = 2;

          // Validate assets if addon claims ranked_mode="yes"
          let assetsValidated = false;
          if (parsed.addon.ranked_mode) {
            const assetValidation = await validateRankedAssets(
              parsed.victory.winner_faction,
              parsed.victory.loser_faction,
              replay.game_name // Using game_name as map name
            );
            assetsValidated = assetValidation.isValid;

            if (assetsValidated) {
              // Assets valid for ranked
              console.log(`✅ [PARSE] Valid ranked match with correct assets`);
              matchType = 'ranked';
              confidenceLevel = 2;
            } else {
              // Assets invalid for ranked
              console.warn(`⚠️  [PARSE] Ranked addon marked but assets invalid:`);
              assetValidation.invalidReasons.forEach(r => console.warn(`   - ${r}`));
              
              // Check if there's a tournament we can fallback to
              if (parsed.addon.tournament && parsed.addon.tournament_name) {
                console.log(`   Checking tournament fallback...`);
                tournament = await findTournamentByName(parsed.addon.tournament_name);
                
                if (tournament && tournament.tournamentMode === 'unranked') {
                  console.log(`✅ [PARSE] Will report to unranked tournament: ${tournament.tournamentName}`);
                  matchType = 'tournament_unranked';
                  confidenceLevel = 1;
                } else if (tournament && tournament.tournamentMode === 'ranked') {
                  console.log(`❌ [PARSE] Ranked tournament but assets invalid → REJECT`);
                  matchType = 'rejected';
                } else {
                  console.log(`❌ [PARSE] No valid tournament → REJECT`);
                  matchType = 'rejected';
                }
              } else {
                console.log(`❌ [PARSE] No tournament to fallback → REJECT`);
                matchType = 'rejected';
              }
            }
          }
          // Case 2: Tournament match without ranked_mode claim
          else if (parsed.addon.tournament && parsed.addon.tournament_name) {
            console.log(`🎬 [PARSE] Tournament match (no ranked claim)`);
            tournament = await findTournamentByName(parsed.addon.tournament_name);
            
            if (tournament) {
              matchType = tournament.tournamentMode === 'ranked' ? 'tournament_ranked' : 'tournament_unranked';
              confidenceLevel = 1;
              console.log(`✅ [PARSE] Found tournament: ${tournament.tournamentName} (${tournament.tournamentMode})`);
            } else {
              console.log(`❌ [PARSE] Tournament not found → REJECT`);
              matchType = 'rejected';
            }
          }
          // Case 3: No tournament, no ranked addon
          else {
            console.log(`❌ [PARSE] No ranked addon and no tournament → REJECT`);
            matchType = 'rejected';
          }

          // Skip if rejected
          if (matchType === 'rejected') {
            console.log(`⏭️  [PARSE] Skipping rejected match`);
            
            await query(
              `UPDATE replays SET parse_status = 'rejected', parsed = 1 WHERE id = ?`,
              [replay.id]
            );
            
            errorCount++;
            continue;
          }

          // ============================================================================
          // VALIDATE PARTICIPANTS for tournament matches
          // ============================================================================
          if (matchType.includes('tournament') && tournament) {
            const playerCount = parsed.players.length;

            if (playerCount === 2) {
              // 1v1 match
              const verification = await verifyPlayersInTournament(
                tournament.tournamentId,
                parsed.victory.winner_name,
                parsed.victory.loser_name
              );

              if (!verification.valid) {
                console.warn(`❌ [PARSE] 1v1 Tournament match but players not both registered`);
                matchType = 'rejected';
              } else if (verification.player1Id && verification.player2Id) {
                const tournamentMatchId = await findTournamentMatchRecord(
                  tournament.tournamentId,
                  verification.player1Id,
                  verification.player2Id
                );

                if (tournamentMatchId) {
                  teamInfo = { tournamentMatchId, players: [verification.player1Id, verification.player2Id] };
                  console.log(`✅ [PARSE] Linked to 1v1 tournament match`);
                } else {
                  console.warn(`⚠️  [PARSE] No pending tournament match found for these players`);
                }
              }
            } else if (playerCount === 4) {
              // 2v2 team match
              console.log(`🎬 [PARSE] Detected 2v2 team match (4 players)`);

              const playerNames = parsed.players.map(p => p.name);
              const allInTournamentResult = await query(
                `SELECT COUNT(*) as count FROM tournament_participants tp
                 JOIN users_extension ue ON tp.user_id = ue.id
                 WHERE tp.tournament_id = ? AND ue.username IN (?, ?, ?, ?)`,
                [tournament.tournamentId, ...playerNames]
              );

              const allInCount = (allInTournamentResult as any).rows[0]?.count || 0;
              if (allInCount !== 4) {
                console.warn(`❌ [PARSE] Team match but not all 4 players in tournament (found ${allInCount}/4)`);
                matchType = 'rejected';
              } else {
                // Get team IDs for each side
                const side1Players = parsed.players.filter(p => p.side === 1);
                const side2Players = parsed.players.filter(p => p.side === 2);

                if (side1Players.length === 2 && side2Players.length === 2) {
                  const side1Name = side1Players[0].name;
                  const side2Name = side2Players[0].name;

                  const side1TeamResult = await query(
                    `SELECT DISTINCT tt.id FROM tournament_teams tt
                     JOIN tournament_participants tp ON tp.team_id = tt.id
                     JOIN users_extension ue ON tp.user_id = ue.id
                     WHERE tt.tournament_id = ? AND ue.username = ?
                     LIMIT 1`,
                    [tournament.tournamentId, side1Name]
                  );

                  const side2TeamResult = await query(
                    `SELECT DISTINCT tt.id FROM tournament_teams tt
                     JOIN tournament_participants tp ON tp.team_id = tt.id
                     JOIN users_extension ue ON tp.user_id = ue.id
                     WHERE tt.tournament_id = ? AND ue.username = ?
                     LIMIT 1`,
                    [tournament.tournamentId, side2Name]
                  );

                  if ((side1TeamResult as any).rows && (side2TeamResult as any).rows) {
                    teamInfo = {
                      side1TeamId: (side1TeamResult as any).rows[0].id,
                      side2TeamId: (side2TeamResult as any).rows[0].id,
                      players: parsed.players.map(p => ({ name: p.name, side: p.side })),
                      isTeamMatch: true
                    };
                    console.log(`✅ [PARSE] Validated 2v2 team match`);
                  } else {
                    console.warn(`⚠️  [PARSE] Could not find team IDs for match`);
                    matchType = 'rejected';
                  }
                } else {
                  console.warn(`❌ [PARSE] Invalid team distribution (not 2v2)`);
                  matchType = 'rejected';
                }
              }
            } else {
              console.warn(`❌ [PARSE] Unsupported player count: ${playerCount}`);
              matchType = 'rejected';
            }

            if (matchType === 'rejected') {
              console.log(`⏭️  [PARSE] Rejecting due to participant validation failure`);
              
              await query(
                `UPDATE replays SET parse_status = 'rejected', parsed = 1 WHERE id = ?`,
                [replay.id]
              );
              
              errorCount++;
              continue;
            }
          }

          // Convert parsed replay to ReplayData format for createOrUpdateMatch
          const replayData: ParsedReplay = {
            id: replay.id,
            scenario_name: replay.game_name,
            version: replay.wesnoth_version,
            era_id: 'unknown',
            victory: {
              confidence_level: confidenceLevel,
              result_type: teamInfo?.isTeamMatch ? 'team' : 'one_versus_one',
              winner_name: parsed.victory.winner_name,
              winner_faction: parsed.victory.winner_faction || 'unknown',
              loser_name: parsed.victory.loser_name,
              loser_faction: parsed.victory.loser_faction || 'unknown'
            },
            players: (parsed.players || []).map(p => ({
              name: p.name,
              faction_name: p.faction || 'unknown',
              side_number: p.side
            })),
            addons: []
          };

          // Add tournament info if available
          if (tournament) {
            replayData.tournamentId = tournament.tournamentId;
            replayData.tournamentMode = tournament.tournamentMode;
            if (teamInfo?.tournamentMatchId) {
              replayData.tournamentMatchId = teamInfo.tournamentMatchId;
            }
          }

          // Log what we're about to create
          console.log(`📝 [PARSE] Processing match:`);
          console.log(`   Type: ${matchType}`);
          console.log(`   Confidence: ${confidenceLevel}`);
          console.log(`   Result: ${replayData.victory.result_type} (${replayData.players?.length || 0} players)`);
          if (tournament) {
            console.log(`   Tournament: ${tournament.tournamentName} (${tournament.tournamentMode})`);
          }

          // Create or update match
          const matchResult = await createOrUpdateMatch(replayData);

          console.log(`✅ [PARSE] Match created/updated: ${matchResult.matchId} (status: ${matchResult.status})`);

          // Mark replay as parsed
          await query(
            `UPDATE replays 
             SET parsed = 1, 
                 parse_status = 'completed',
                 need_integration = 0
             WHERE id = ?`,
            [replay.id]
          );

          parsedCount++;
          matchCount++;

        } catch (error) {
          errorCount++;
          const errorMsg = (error as any)?.message || String(error);
          console.error(`❌ [PARSE] Failed to parse ${replay.game_name}:`, errorMsg);

          // Mark as errored
          try {
            await query(
              `UPDATE replays 
               SET parse_status = 'error'
               WHERE id = ?`,
              [replay.id]
            );
          } catch (e) {
            console.error('Failed to mark replay as errored:', e);
          }
        }
      }

      console.log(`✅ [PARSE] Completed: ${parsedCount} parsed, ${matchCount} matches`);

      this.successCount += parsedCount;
      this.errorCount += errorCount;

      return {
        parsed_count: parsedCount,
        match_count: matchCount,
        errors: errorCount,
        duration_ms: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ [PARSE] Job failed:', error);
      errorCount++;
      return {
        parsed_count: 0,
        match_count: 0,
        errors: errorCount,
        duration_ms: Date.now() - startTime
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get unparsed replays from database
   * Queries replays that were synced from forum but not yet parsed
   */
  private async getUnparsedReplays(): Promise<UnparsedReplay[]> {
    try {
      const maxConcurrentParses = parseInt(process.env.REPLAY_MAX_CONCURRENT_PARSES || '3', 10);

      const result = await query(
        `SELECT id, replay_filename, replay_url, wesnoth_version, game_name, start_time, end_time
         FROM replays
         WHERE parse_status = 'new' 
           AND parsed = 0
           AND need_integration = 1
         ORDER BY created_at ASC
         LIMIT ?`,
        [maxConcurrentParses]
      );

      return (result as any).rows || [];
    } catch (error) {
      console.error('❌ [PARSE] Failed to get unparsed replays:', error);
      return [];
    }
  }

  /**
   * Parse replay file from official Wesnoth replay server
   * Downloads replay from URL and parses using Ranked addon parser
   * URL format: https://replays.wesnoth.org/{version}/{year}/{month}/{day}/{replay_name}.wrz
   */
  private async parseReplayFromUrl(replay: UnparsedReplay): Promise<ParsedRankedReplay> {
    try {
      console.log(`🎬 [PARSE] Fetching replay from URL: ${replay.replay_url}`);

      // Download replay file from official server
      const replayPath = await this.downloadReplayFile(replay.replay_url, replay.wesnoth_version);

      // Parse using Ranked addon parser
      const parsed = await parseRankedReplay(replayPath);

      // Cleanup downloaded file
      try {
        fs.unlinkSync(replayPath);
      } catch (e) {
        console.warn('⚠️  [PARSE] Could not clean up temp file:', replayPath);
      }

      return parsed;

    } catch (error) {
      const errorMsg = (error as any)?.message || String(error);
      console.error(`❌ [PARSE] Failed to parse replay from URL:`, errorMsg);
      throw error;
    }
  }

  /**
   * Download replay file from local Wesnoth replay directory
   * The replays are stored at /scratch/wesnothd-public-replays/
   */
  private async downloadReplayFile(url: string, version: string): Promise<string> {
    try {
      const tmpDir = path.join(process.cwd(), '.tmp', 'replays');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      // Extract relative path from URL (version/year/month/day/filename)
      // URL format: https://replays.wesnoth.org/1.18/2026/02/21/filename.bz2
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1]; // filename.bz2
      const day = urlParts[urlParts.length - 2];
      const month = urlParts[urlParts.length - 3];
      const year = urlParts[urlParts.length - 4];
      const urlVersion = urlParts[urlParts.length - 5]; // version like 1.18

      // Build local path
      const localReplayPath = `/scratch/wesnothd-public-replays/${urlVersion}/${year}/${month}/${day}/${filename}`;

      console.log(`🎬 [PARSE] Looking for replay: ${localReplayPath}`);

      // Check if file exists locally
      if (!fs.existsSync(localReplayPath)) {
        throw new Error(`Replay file not found: ${localReplayPath}`);
      }

      // Copy to temporary directory
      const tmpLocalPath = path.join(tmpDir, `${Date.now()}_${filename}`);
      fs.copyFileSync(localReplayPath, tmpLocalPath);

      console.log(`✅ [PARSE] Copied replay to: ${tmpLocalPath}`);
      return tmpLocalPath;

    } catch (error) {
      const errorMsg = (error as any)?.message || String(error);
      console.error(`❌ [PARSE] Failed to get replay file:`, errorMsg);
      throw error;
    }
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

export default ParseNewReplaysRefactored;
