/**
 * Background Job: Parse New Replays (FORUM-FIRST APPROACH)
 * File: backend/src/jobs/parseNewReplaysRefactorized.ts
 * 
 * Data Flow:
 * 1. Query wesnothd_game_content_info for addon confirmation (Ranked addon)
 * 2. Query wesnothd_game_player_info for player nicknames, sides, factions  
 * 3. Query wesnothd_game_content_info for scenario/map name
 * 4. If forum factions are "Custom" → search replay for actual factions
 * 5. Parse replay file for: ranked_mode, tournament, victory condition
 * 6. Validate factions and map against assets
 * 7. Report parse_summary with all detected information
 * 8. Create match with appropriate confidence level
 */

import { query } from '../config/database.js';
import ReplayParser from '../services/replayParser.js';
import { parseRankedReplay, ParsedRankedReplay } from '../utils/replayRankedParser.js';
import * as fs from 'fs';
import * as path from 'path';

interface UnparsedReplay {
  id: string;
  instance_uuid: string;
  game_id: number;
  replay_filename: string;
  replay_url: string;
  wesnoth_version: string;
  game_name: string;
  start_time: string;
  end_time: string;
  created_at: string;
}

interface ParseSummary {
  forumAddon: any | null;
  forumPlayers: Array<any>;
  forumMap: string | null;
  forumFactions: Record<string, string>;
  replayRankedMode: boolean;
  replayTournament: string | null;
  replayVictory: any | null;
  replayFactions: Record<string, string | null>;
  finalFactions: Record<string, string>;
  finalMap: string | null;
  confidenceLevel: 1 | 2;
  matchType: 'ranked' | 'tournament_ranked' | 'tournament_unranked' | 'rejected';
}

export class ParseNewReplaysRefactorized {
  private readonly parser: ReplayParser;
  private isRunning: boolean = false;
  private lastRunAt: Date | null = null;

  constructor() {
    this.parser = new ReplayParser();
  }

  /**
   * Execute one cycle of the parse job - Forum-First Approach
   */
  async execute(): Promise<{
    parsed_count: number;
    match_count: number;
    errors: number;
    duration_ms: number;
  }> {
    if (this.isRunning) {
      console.log('⚠️  [PARSE] Job already running, skipping');
      return { parsed_count: 0, match_count: 0, errors: 0, duration_ms: 0 };
    }

    const startTime = Date.now();
    this.isRunning = true;
    this.lastRunAt = new Date();

    let parsedCount = 0;
    let matchCount = 0;
    let errorCount = 0;

    try {
      console.log('🎬 [PARSE] Starting forum-first replay parsing...');

      const unparsedReplays = await this.getUnparsedReplays();
      console.log(`📊 [PARSE] Found ${unparsedReplays.length} unparsed replays`);

      for (const replay of unparsedReplays) {
        try {
          console.log(`\n🎬 [PARSE] Processing: ${replay.game_name} (Replay ${replay.game_id})`);

          const parseSummary = await this.parseReplayForumFirst(replay);

          if (parseSummary.matchType === 'rejected') {
            console.log(`❌ [PARSE] Match rejected → Update replay as rejected`);
            await query(
              `UPDATE replays SET parse_status = 'rejected', parsed = 1, parse_summary = ? WHERE id = ?`,
              [JSON.stringify(parseSummary), replay.id]
            );
            errorCount++;
            continue;
          }

          // Create match
          const matchCreateResult = await this.createMatchFromParseSummary(
            replay,
            parseSummary
          );

          if (matchCreateResult.success) {
            console.log(`✅ [PARSE] Match created: ID ${matchCreateResult.matchId}`);
            await query(
              `UPDATE replays SET parse_status = 'completed', parsed = 1, parse_summary = ? WHERE id = ?`,
              [JSON.stringify(parseSummary), replay.id]
            );
            parsedCount++;
            matchCount++;
          } else {
            console.error(`❌ [PARSE] Failed to create match:`, matchCreateResult.error);
            await query(
              `UPDATE replays SET parse_status = 'error', parsed = 1, parse_error_message = ?, parse_summary = ? WHERE id = ?`,
              [matchCreateResult.error, JSON.stringify(parseSummary), replay.id]
            );
            errorCount++;
          }

        } catch (replayError) {
          const errorMsg = (replayError as any)?.message || String(replayError);
          console.error(`❌ [PARSE] Error processing replay:`, errorMsg);

          // Handle file not found with retry logic
          if (errorMsg.includes('Replay file not found')) {
            const replayAge = Date.now() - new Date(replay.created_at).getTime();
            const ageHours = replayAge / (1000 * 60 * 60);

            if (ageHours < 24) {
              // Mark as pending for retry
              console.log(`   File not found but < 24h old → Mark as pending`);
              await query(
                `UPDATE replays SET parse_status = 'pending', parse_error_message = ? WHERE id = ?`,
                [errorMsg, replay.id]
              );
            } else {
              // Mark as error
              console.log(`   File not found and >= 24h old → Mark as error`);
              await query(
                `UPDATE replays SET parse_status = 'error', parsed = 1, parse_error_message = ? WHERE id = ?`,
                [errorMsg, replay.id]
              );
            }
          } else {
            // Other errors
            await query(
              `UPDATE replays SET parse_status = 'error', parsed = 1, parse_error_message = ? WHERE id = ?`,
              [errorMsg, replay.id]
            );
          }

          errorCount++;
        }
      }

      const duration = Date.now() - startTime;
      console.log(`\n✅ [PARSE] Job completed in ${duration}ms`);
      console.log(`   Parsed: ${parsedCount}, Matches: ${matchCount}, Errors: ${errorCount}`);

      return {
        parsed_count: parsedCount,
        match_count: matchCount,
        errors: errorCount,
        duration_ms: duration
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * STEP 1-3: Query forum database for addon, players, map
   * STEP 5-7: Parse replay for complementary info
   * Returns complete ParseSummary
   */
  private async parseReplayForumFirst(replay: UnparsedReplay): Promise<ParseSummary> {
    const parseSummary: ParseSummary = {
      forumAddon: null,
      forumPlayers: [],
      forumMap: null,
      forumFactions: {},
      replayRankedMode: false,
      replayTournament: null,
      replayVictory: null,
      replayFactions: {},
      finalFactions: {},
      finalMap: null,
      confidenceLevel: 1,
      matchType: 'rejected'
    };

    // ======== STEP 1: Query forum for addon ========
    console.log(`📋 [FORUM] Step 1: Checking for Ranked addon...`);
    const addonResult = await query(
      `SELECT addon_id, addon_version FROM forum.wesnothd_game_content_info 
       WHERE instance_uuid = ? AND game_id = ? AND type = 'modification' AND addon_id = 'Ranked' LIMIT 1`,
      [replay.instance_uuid, replay.game_id]
    );

    if ((addonResult as any).rows?.length > 0) {
      parseSummary.forumAddon = (addonResult as any).rows[0];
      console.log(`   ✅ Found Ranked addon in forum`);
    } else {
      console.log(`   ⚠️  No Ranked addon found in forum`);
      parseSummary.matchType = 'rejected';
      return parseSummary;
    }

    // ======== STEP 2: Query forum for players, sides, factions ========
    console.log(`📋 [FORUM] Step 2: Querying players...`);
    const playersResult = await query(
      `SELECT user_id, user_name, faction, side_number 
       FROM forum.wesnothd_game_player_info 
       WHERE instance_uuid = ? AND game_id = ? AND user_id != -1 AND user_id IS NOT NULL
       ORDER BY side_number`,
      [replay.instance_uuid, replay.game_id]
    );

    if ((playersResult as any).rows?.length < 2) {
      console.log(`   ❌ Less than 2 players found in forum`);
      parseSummary.matchType = 'rejected';
      return parseSummary;
    }

    parseSummary.forumPlayers = (playersResult as any).rows;
    for (const player of parseSummary.forumPlayers) {
      parseSummary.forumFactions[`side${player.side_number}`] = player.faction;
      console.log(`   Player: ${player.user_name} (Side ${player.side_number}, Faction: ${player.faction})`);
    }

    // ======== STEP 3: Query forum for map/scenario ========
    console.log(`📋 [FORUM] Step 3: Querying map...`);
    const mapResult = await query(
      `SELECT name FROM forum.wesnothd_game_content_info 
       WHERE instance_uuid = ? AND game_id = ? AND type = 'scenario' LIMIT 1`,
      [replay.instance_uuid, replay.game_id]
    );

    if ((mapResult as any).rows?.length > 0) {
      parseSummary.forumMap = (mapResult as any).rows[0].name;
      console.log(`   ✅ Map: ${parseSummary.forumMap}`);
    } else {
      parseSummary.forumMap = replay.game_name;
      console.log(`   ⚠️  No map in forum, using game_name: ${parseSummary.forumMap}`);
    }

    // ======== STEP 4: Check if forum factions are "Custom" =========
    const hasCustomFaction = Object.values(parseSummary.forumFactions)
      .some(f => f.toLowerCase().includes('custom'));

    // ======== STEPS 5-7: Parse replay file for complementary info ========
    console.log(`🎬 [REPLAY] Step 5-7: Parsing replay file...`);
    try {
      const parsed = await this.parseReplayFromUrl(replay);

      if (parsed) {
        // Extract ranked_mode and tournament
        if (parsed.addon) {
          parseSummary.replayRankedMode = parsed.addon.ranked_mode || false;
          parseSummary.replayTournament = parsed.addon.tournament_name || null;
          console.log(`   ranked_mode=${parseSummary.replayRankedMode}, tournament=${parseSummary.replayTournament}`);
        }

        // Extract victory
        if (parsed.victory) {
          parseSummary.replayVictory = parsed.victory;
          console.log(`   Victory: ${parsed.victory.winner_name} (${parsed.victory.winner_faction}) def ${parsed.victory.loser_name}`);
        }

        // Extract factions from replay if forum had "Custom"
        if (hasCustomFaction && parsed.victory) {
          parseSummary.replayFactions.winner = parsed.victory.winner_faction || null;
          parseSummary.replayFactions.loser = parsed.victory.loser_faction || null;
          console.log(`   Using replay factions (forum has Custom): ${parseSummary.replayFactions.winner} vs ${parseSummary.replayFactions.loser}`);
        } else {
          // Use forum factions
          parseSummary.finalFactions = { ...parseSummary.forumFactions };
        }
      }
    } catch (err) {
      console.warn(`⚠️  Could not parse replay file:`, err);
    }

    // ======== DETERMINE CONFIDENCE LEVEL ========
    console.log(`🎯 [PARSE] Determining confidence level...`);
    if (parseSummary.replayVictory) {
      parseSummary.confidenceLevel = 2;
      console.log(`   ✅ Clear victory found → confidence=2`);
    } else {
      parseSummary.confidenceLevel = 1;
      console.log(`   ⚠️  No clear victory (abandonment/draw) → confidence=1`);
    }

    // ======== DETERMINE MATCH TYPE ========
    if (parseSummary.forumAddon) {
      parseSummary.matchType = 'ranked';
      console.log(`📊 Match type: RANKED (addon in forum)`);
    }

    return parseSummary;
  }

  /**
   * Create match in database from ParseSummary
   */
  private async createMatchFromParseSummary(
    replay: UnparsedReplay,
    parseSummary: ParseSummary
  ): Promise<{ success: boolean; matchId?: number; error?: string }> {
    try {
      if (parseSummary.forumPlayers.length < 2) {
        return { success: false, error: 'Insufficient players in parse summary' };
      }

      const winner = parseSummary.forumPlayers[0];
      const loser = parseSummary.forumPlayers[1];
      const winnerFaction = parseSummary.forumFactions['side1'] || 'Unknown';
      const loserFaction = parseSummary.forumFactions['side2'] || 'Unknown';

      console.log(`\n📝 Creating match:`);
      console.log(`   Winner: ${winner.user_name} (ID ${winner.user_id}, ${winnerFaction})`);
      console.log(`   Loser: ${loser.user_name} (ID ${loser.user_id}, ${loserFaction})`);
      console.log(`   Map: ${parseSummary.forumMap}`);
      console.log(`   Confidence: ${parseSummary.confidenceLevel}`);
      console.log(`   Type: ${parseSummary.matchType}`);

      const result = await query(
        `INSERT INTO matches (
          winner_id, loser_id, winner_faction, loser_faction, map_name,
          confidence_level, status, match_type, replay_id, parse_summary, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'reported', ?, ?, ?, NOW())`,
        [
          winner.user_id,
          loser.user_id,
          winnerFaction,
          loserFaction,
          parseSummary.forumMap,
          parseSummary.confidenceLevel,
          parseSummary.matchType,
          replay.id,
          JSON.stringify(parseSummary)
        ]
      );

      const matchId = (result as any).insertId;
      return { success: true, matchId };

    } catch (err) {
      const errorMsg = (err as any)?.message || String(err);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Get unparsed replays from database
   */
  private async getUnparsedReplays(): Promise<UnparsedReplay[]> {
    const result = await query(
      `SELECT id, instance_uuid, game_id, replay_filename, replay_url, 
              wesnoth_version, game_name, start_time, end_time, created_at
       FROM replays
       WHERE parse_status = 'new' AND parsed = 0
       ORDER BY created_at ASC
       LIMIT 50`,
      []
    );

    return ((result as any).rows || []) as UnparsedReplay[];
  }

  /**
   * Parse replay from URL (download + parse)
   */
  private async parseReplayFromUrl(replay: UnparsedReplay): Promise<ParsedRankedReplay | null> {
    try {
      const localPath = await this.downloadReplayFile(replay.replay_url, replay.wesnoth_version);
      const compression = localPath.endsWith('.bz2') ? 'bz2' : 'gz';
      const parsed = await parseRankedReplay(localPath, compression);

      // Clean up
      try {
        fs.unlinkSync(localPath);
      } catch {}

      return parsed;
    } catch (err) {
      const errorMsg = (err as any)?.message || String(err);
      console.warn(`⚠️  [PARSE] Failed to parse replay:`, errorMsg);
      throw err;
    }
  }

  /**
   * Download replay file from local Wesnoth directory
   */
  private async downloadReplayFile(url: string, version: string): Promise<string> {
    try {
      const tmpDir = path.join(process.cwd(), '.tmp', 'replays');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      // Extract path components from URL
      // Format: https://replays.wesnoth.org/1.18/2026/02/21/filename.bz2
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1];
      const day = urlParts[urlParts.length - 2];
      const month = urlParts[urlParts.length - 3];
      const year = urlParts[urlParts.length - 4];
      const urlVersion = urlParts[urlParts.length - 5];

      const localPath = `/scratch/wesnothd-public-replays/${urlVersion}/${year}/${month}/${day}/${filename}`;

      if (!fs.existsSync(localPath)) {
        throw new Error(`Replay file not found: ${localPath}`);
      }

      const tmpPath = path.join(tmpDir, `${Date.now()}_${filename}`);
      fs.copyFileSync(localPath, tmpPath);

      console.log(`   ✅ Downloaded: ${tmpPath}`);
      return tmpPath;

    } catch (err) {
      throw err;
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt
    };
  }
}

export default ParseNewReplaysRefactorized;
