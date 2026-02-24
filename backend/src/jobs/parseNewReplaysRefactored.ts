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
import { calculateNewRating, calculateTrend } from '../utils/elo.js';
import { getUserLevel } from '../utils/auth.js';
import { v4 as uuidv4 } from 'uuid';
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
  
  // Resolved (validated against assets)
  resolvedFactions: Record<string, string | null>; // Canonical names from factions table
  resolvedMap: string | null; // Canonical name from game_maps table
  
  // Asset validation
  factionsAreRanked: boolean;
  mapIsRanked: boolean;
  
  // Final factions (for UI/reporting)
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
              `UPDATE replays SET parse_status = 'rejected', parsed = 1, integration_confidence = ?, parse_summary = ? WHERE id = ?`,
              [parseSummary.confidenceLevel, JSON.stringify(parseSummary), replay.id]
            );
            errorCount++;
            continue;
          }

          // Check confidence level - only create match if confidence=2
          if (parseSummary.confidenceLevel === 1) {
            console.log(`⏳ [PARSE] Confidence=1 → Parsed but no match created (awaiting player confirmation)`);
            await query(
              `UPDATE replays SET parse_status = 'parsed', parsed = 1, integration_confidence = ?, parse_summary = ? WHERE id = ?`,
              [parseSummary.confidenceLevel, JSON.stringify(parseSummary), replay.id]
            );
            parsedCount++;
            continue;
          }

          // Create match (only if confidence=2)
          const matchCreateResult = await this.createMatchFromParseSummary(
            replay,
            parseSummary
          );

          if (matchCreateResult.success) {
            console.log(`✅ [PARSE] Match created: ID ${matchCreateResult.matchId}`);
            await query(
              `UPDATE replays SET parse_status = 'completed', parsed = 1, integration_confidence = ?, match_id = ?, parse_summary = ? WHERE id = ?`,
              [parseSummary.confidenceLevel, matchCreateResult.matchId, JSON.stringify(parseSummary), replay.id]
            );
            
            // Update last integration timestamp
            await query(
              `UPDATE system_settings SET setting_value = ?, updated_at = NOW() 
               WHERE setting_key = 'replay_last_integration_timestamp'`,
              [new Date().toISOString()]
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
      resolvedFactions: {},
      resolvedMap: null,
      factionsAreRanked: false,
      mapIsRanked: false,
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

    // ======== STEPS 5-7: ALWAYS parse replay (selectively) ========
    console.log(`🎬 [REPLAY] Step 5-7: Parsing replay file (selective)...`);
    try {
      const parsed = await this.parseReplayFromUrl(replay, parseSummary.forumPlayers, hasCustomFaction);

      if (parsed) {
        // 5.1 Extract ranked_mode and tournament
        if (parsed.addon) {
          parseSummary.replayRankedMode = parsed.addon.ranked_mode || false;
          parseSummary.replayTournament = parsed.addon.tournament_name || null;
          console.log(`   ✅ 5.1 ranked_mode=${parseSummary.replayRankedMode}, tournament=${parseSummary.replayTournament}`);
        }

        // 5.2 Victory (from parsed replay)
        if (parsed.victory) {
          parseSummary.replayVictory = parsed.victory;
          if (parsed.victory.reason === 'surrender') {
            console.log(`   ✅ 5.2 Victory: ${parsed.victory.winner_name} def ${parsed.victory.loser_name} (surrender, confidence: 2)`);
          } else {
            console.log(`   ⚠️  5.2 No clear victory: ${parsed.victory.reason} (confidence: 1)`);
          }
        }

        // 5.3 (Optional) Extract factions from replay ONLY if forum had "Custom"
        if (hasCustomFaction && parsed.victory) {
          parseSummary.replayFactions.winner = parsed.victory.winner_faction || null;
          parseSummary.replayFactions.loser = parsed.victory.loser_faction || null;
          console.log(`   ✅ 5.3 Resolved Custom factions from replay: ${parseSummary.replayFactions.winner} vs ${parseSummary.replayFactions.loser}`);
          
          // Use resolved replay factions
          parseSummary.finalFactions['side1'] = parseSummary.replayFactions.winner || 'Unknown';
          parseSummary.finalFactions['side2'] = parseSummary.replayFactions.loser || 'Unknown';
        } else {
          // Use forum factions (not Custom)
          parseSummary.finalFactions = { ...parseSummary.forumFactions };
          console.log(`   ✅ Using forum factions (not Custom): ${Object.values(parseSummary.forumFactions).join(' vs ')}`);
        }
      }
    } catch (err) {
      console.warn(`⚠️  Could not parse replay file:`, err);
      // Fallback to forum factions
      parseSummary.finalFactions = { ...parseSummary.forumFactions };
    }

    // ======== VALIDATE AND RESOLVE FACTIONS ========
    console.log(`🔍 [PARSE] Validating factions against factions table...`);
    const winner = parseSummary.forumPlayers[0];
    const loser = parseSummary.forumPlayers[1];
    
    if (winner && loser) {
      const winnerFactionRaw = parseSummary.finalFactions['side1'] || 'Unknown';
      const loserFactionRaw = parseSummary.finalFactions['side2'] || 'Unknown';
      
      const winnerResolved = await this.resolveFaction(winnerFactionRaw);
      const loserResolved = await this.resolveFaction(loserFactionRaw);
      
      parseSummary.resolvedFactions['side1'] = winnerResolved.name;
      parseSummary.resolvedFactions['side2'] = loserResolved.name;
      parseSummary.factionsAreRanked = winnerResolved.isRanked && loserResolved.isRanked;
      
      if (winnerResolved.name !== winnerFactionRaw) {
        console.log(`   ✅ Side 1: "${winnerFactionRaw}" → "${winnerResolved.name}" (ranked: ${winnerResolved.isRanked})`);
      } else {
        console.log(`   ✅ Side 1: "${winnerResolved.name}" (ranked: ${winnerResolved.isRanked})`);
      }
      
      if (loserResolved.name !== loserFactionRaw) {
        console.log(`   ✅ Side 2: "${loserFactionRaw}" → "${loserResolved.name}" (ranked: ${loserResolved.isRanked})`);
      } else {
        console.log(`   ✅ Side 2: "${loserResolved.name}" (ranked: ${loserResolved.isRanked})`);
      }
    }

    // ======== VALIDATE AND RESOLVE MAP ========
    console.log(`🔍 [PARSE] Validating map against game_maps table...`);
    const mapRaw = parseSummary.forumMap || 'Unknown';
    const mapResolved = await this.resolveMap(mapRaw);
    parseSummary.resolvedMap = mapResolved.name;
    parseSummary.mapIsRanked = mapResolved.isRanked;
    
    if (mapResolved.name !== mapRaw) {
      console.log(`   ✅ Map: "${mapRaw}" → "${mapResolved.name}" (ranked: ${mapResolved.isRanked})`);
    } else {
      console.log(`   ✅ Map: "${mapResolved.name}" (ranked: ${mapResolved.isRanked})`);
    }

    // ======== CONFIDENCE LEVEL (from replayVictory) ========
    console.log(`🎯 [PARSE] Determining confidence level...`);
    // Use the confidence_level from parsed victory
    parseSummary.confidenceLevel = parseSummary.replayVictory?.confidence_level || 1;
    
    if (parseSummary.confidenceLevel === 2) {
      console.log(`   ✅ Clear victory (${parseSummary.replayVictory?.reason}) → confidence=2`);
    } else {
      console.log(`   ⚠️  No clear victory (${parseSummary.replayVictory?.reason}) → confidence=1`);
    }

    // ======== DETERMINE MATCH TYPE ========
    console.log(`📊 [PARSE] Determining match type...`);
    if (!parseSummary.forumAddon) {
      parseSummary.matchType = 'rejected';
      console.log(`   ❌ No Ranked addon in forum → REJECTED`);
    } else if (parseSummary.replayRankedMode && parseSummary.factionsAreRanked && parseSummary.mapIsRanked) {
      // Ranked assets
      parseSummary.matchType = 'ranked';
      console.log(`   ✅ ranked_mode=true, factions ranked, map ranked → RANKED`);
    } else if (parseSummary.replayRankedMode && !parseSummary.factionsAreRanked && !parseSummary.mapIsRanked) {
      // Non-ranked assets with ranked addon
      parseSummary.matchType = 'rejected';
      console.log(`   ❌ Assets not ranked (factions or map) → REJECTED`);
    } else if (parseSummary.replayTournament) {
      // Tournament match
      if (parseSummary.factionsAreRanked && parseSummary.mapIsRanked) {
        parseSummary.matchType = 'tournament_ranked';
        console.log(`   ✅ Tournament with ranked assets → TOURNAMENT_RANKED`);
      } else {
        parseSummary.matchType = 'tournament_unranked';
        console.log(`   ⚠️  Tournament with non-ranked assets → TOURNAMENT_UNRANKED`);
      }
    } else {
      parseSummary.matchType = 'rejected';
      console.log(`   ❌ Cannot determine match type → REJECTED`);
    }

    return parseSummary;
  }

  /**
   * Fetch user data from users_extension by nickname (case-insensitive)
   */
  private async getUserDataByNickname(nickname: string): Promise<any | null> {
    if (!nickname) return null;
    
    try {
      const result = await query(
        `SELECT id, elo_rating, level FROM users_extension 
         WHERE LOWER(nickname) = LOWER(?)`,
        [nickname]
      );
      
      return (result as any).rows?.[0] || null;
    } catch (err) {
      console.warn(`⚠️  Failed to lookup user ${nickname}:`, (err as any)?.message);
      return null;
    }
  }

  /**
   * Create match in database from ParseSummary
   */
  private async createMatchFromParseSummary(
    replay: UnparsedReplay,
    parseSummary: ParseSummary
  ): Promise<{ success: boolean; matchId?: string; error?: string }> {
    try {
      if (parseSummary.forumPlayers.length < 2 || !parseSummary.replayVictory) {
        return { success: false, error: 'Insufficient data: missing forum players or replay victory' };
      }

      // Use replay victory to find winner/loser names
      const winnerName = parseSummary.replayVictory.winner_name;
      const loserName = parseSummary.replayVictory.loser_name;

      // Find winner and loser in forumPlayers (forum is source of truth for side ↔ nickname mapping)
      const winnerForumData = parseSummary.forumPlayers.find(p => p.user_name === winnerName);
      const loserForumData = parseSummary.forumPlayers.find(p => p.user_name === loserName);

      if (!winnerForumData || !loserForumData) {
        return { 
          success: false, 
          error: `Players not found in forum data: winner=${winnerName} (found=${!!winnerForumData}), loser=${loserName} (found=${!!loserForumData})`
        };
      }

      // Get factions based on forum side mapping
      const winnerSide = `side${winnerForumData.side_number}`;
      const loserSide = `side${loserForumData.side_number}`;
      const winnerFaction = parseSummary.resolvedFactions[winnerSide] || 'Unknown';
      const loserFaction = parseSummary.resolvedFactions[loserSide] || 'Unknown';
      const map = parseSummary.resolvedMap || 'Unknown';

      // Fetch user data by nickname (case-insensitive)
      const winnerUserData = await this.getUserDataByNickname(winnerName);
      const loserUserData = await this.getUserDataByNickname(loserName);

      if (!winnerUserData || !loserUserData) {
        return { 
          success: false, 
          error: `User not found in users_extension: winner=${winnerName} (found=${!!winnerUserData}), loser=${loserName} (found=${!!loserUserData})`
        };
      }

      console.log(`\n📝 Creating match:`);
      console.log(`   Winner: ${winnerName} (Side ${winnerForumData.side_number}, ID ${winnerUserData.id}, ELO ${winnerUserData.elo_rating}, ${winnerFaction})`);
      console.log(`   Loser: ${loserName} (Side ${loserForumData.side_number}, ID ${loserUserData.id}, ELO ${loserUserData.elo_rating}, ${loserFaction})`);
      console.log(`   Map: ${map}`);
      console.log(`   Confidence: ${parseSummary.confidenceLevel}`);
      console.log(`   Type: ${parseSummary.matchType}`);

      // Fetch full user data including matches_played, is_rated, trend
      const winnerFullData = await query(
        `SELECT id, elo_rating, level, matches_played, is_rated, trend FROM users_extension WHERE id = ?`,
        [winnerUserData.id]
      );
      const loserFullData = await query(
        `SELECT id, elo_rating, level, matches_played, is_rated, trend FROM users_extension WHERE id = ?`,
        [loserUserData.id]
      );

      if ((winnerFullData as any).rows?.length === 0 || (loserFullData as any).rows?.length === 0) {
        return { success: false, error: 'Failed to fetch full user data' };
      }

      const winner = (winnerFullData as any).rows[0];
      const loser = (loserFullData as any).rows[0];

      // Calculate new ELO ratings using FIDE formula
      const winnerNewRating = calculateNewRating(winner.elo_rating, loser.elo_rating, 'win', winner.matches_played);
      const loserNewRating = calculateNewRating(loser.elo_rating, winner.elo_rating, 'loss', loser.matches_played);

      // Calculate trends
      const currentWinnerTrend = winner.trend || '-';
      const currentLoserTrend = loser.trend || '-';
      const winnerTrend = calculateTrend(currentWinnerTrend, true);
      const loserTrend = calculateTrend(currentLoserTrend, false);

      // Build replay file path: https://replays.wesnoth.org/{version}/{yyyy}/{mm}/{dd}/{filename}
      const gameDate = new Date(replay.end_time);
      const yyyy = gameDate.getFullYear();
      const mm = String(gameDate.getMonth() + 1).padStart(2, '0');
      const dd = String(gameDate.getDate()).padStart(2, '0');
      // Remove .bz2 extension if present, then add it back
      const replayFilenameCleaned = replay.replay_filename.replace(/\.bz2$/, '');
      const replayFilePath = `https://replays.wesnoth.org/${replay.wesnoth_version}/${yyyy}/${mm}/${dd}/${replayFilenameCleaned}.bz2`;

      console.log(`\n🎮 Match Details:`);
      console.log(`   Winner: ${winnerName} (${winner.elo_rating} → ${winnerNewRating}, L${winner.level})`);
      console.log(`   Loser: ${loserName} (${loser.elo_rating} → ${loserNewRating}, L${loser.level})`);
      console.log(`   Replay: ${replayFilePath}`);

      const matchId = uuidv4();
      
      // Insert match with before and after ELO/level values
      await query(
        `INSERT INTO matches (
          id, winner_id, loser_id, winner_faction, loser_faction, map,
          replay_id, replay_file_path, auto_reported, status, tournament_type, tournament_mode, 
          winner_elo_before, loser_elo_before, winner_level_before, loser_level_before,
          winner_elo_after, loser_elo_after, winner_level_after, loser_level_after,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'reported', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          matchId,
          winner.id,
          loser.id,
          winnerFaction,
          loserFaction,
          map,
          replay.id,
          replayFilePath,
          this.getTournamentType(parseSummary.matchType),
          this.getTournamentMode(parseSummary.matchType),
          winner.elo_rating,        // winner_elo_before
          loser.elo_rating,         // loser_elo_before
          winner.level || 'novato', // winner_level_before
          loser.level || 'novato',  // loser_level_before
          winnerNewRating,          // winner_elo_after
          loserNewRating,           // loser_elo_after
          getUserLevel(winnerNewRating), // winner_level_after
          getUserLevel(loserNewRating)   // loser_level_after
        ]
      );

      // Update winner in users_extension
      const newWinnerMatches = winner.matches_played + 1;
      let winnerIsNowRated = winner.is_rated;
      
      if (winner.is_rated && winnerNewRating < 1400) {
        winnerIsNowRated = false;
      } else if (!winner.is_rated && newWinnerMatches >= 10 && winnerNewRating >= 1400) {
        winnerIsNowRated = true;
      }

      await query(
        `UPDATE users_extension 
         SET elo_rating = ?, 
             is_rated = ?, 
             matches_played = ?,
             total_wins = total_wins + 1,
             trend = ?,
             level = ?,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [winnerNewRating, winnerIsNowRated, newWinnerMatches, winnerTrend, getUserLevel(winnerNewRating), winner.id]
      );

      // Update loser in users_extension
      const newLoserMatches = loser.matches_played + 1;
      let loserIsNowRated = loser.is_rated;
      
      if (loser.is_rated && loserNewRating < 1400) {
        loserIsNowRated = false;
      } else if (!loser.is_rated && newLoserMatches >= 10 && loserNewRating >= 1400) {
        loserIsNowRated = true;
      }

      await query(
        `UPDATE users_extension 
         SET elo_rating = ?, 
             is_rated = ?, 
             matches_played = ?,
             total_losses = total_losses + 1,
             trend = ?,
             level = ?,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [loserNewRating, loserIsNowRated, newLoserMatches, loserTrend, getUserLevel(loserNewRating), loser.id]
      );

      console.log(`✅ [PARSE] Match created: ID ${matchId}`);
      console.log(`   ELO Change - Winner: +${winnerNewRating - winner.elo_rating}, Loser: ${loserNewRating - loser.elo_rating}`);
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
  private getTournamentType(matchType: string): string | null {
    // Map matchType to tournament_type field
    // 'ranked' -> null (no tournament)
    // 'tournament_ranked' -> 'ranked'
    // 'tournament_unranked' -> 'unranked'
    // 'rejected' -> null
    if (matchType === 'tournament_ranked') return 'ranked';
    if (matchType === 'tournament_unranked') return 'unranked';
    return null;
  }

  private getTournamentMode(matchType: string): string | null {
    // Map matchType to tournament_mode field
    // 'ranked' -> 'ladder'
    // 'tournament_ranked' -> 'ranked'
    // 'tournament_unranked' -> 'unranked'
    // 'rejected' -> null
    if (matchType === 'ranked') return 'ladder';
    if (matchType === 'tournament_ranked') return 'ranked';
    if (matchType === 'tournament_unranked') return 'unranked';
    return null;
  }

  private async parseReplayFromUrl(
    replay: UnparsedReplay,
    forumPlayers?: any[],
    hasCustomFaction?: boolean
  ): Promise<ParsedRankedReplay | null> {
    try {
      const localPath = await this.downloadReplayFile(replay.replay_url, replay.wesnoth_version);
      // If forum has Custom factions, MUST extract from replay (don't skip)
      // Otherwise, can skip if we have valid forum players
      const skipPlayers = !hasCustomFaction && !!forumPlayers;
      
      const parsed = await parseRankedReplay(localPath, {
        skipExtractPlayers: skipPlayers,
        forumPlayers: forumPlayers || []
      });

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
   * Resolve faction name against factions table
   * Searches with: exact match → without prefix → canonical match
   */
  private async resolveFaction(factionName: string | null): Promise<{ name: string | null; isRanked: boolean }> {
    if (!factionName) {
      return { name: null, isRanked: false };
    }

    try {
      // Try exact match first
      let result = await query(
        `SELECT name, is_ranked FROM factions WHERE LOWER(name) = LOWER(?) LIMIT 1`,
        [factionName]
      );

      if ((result as any).rows?.length > 0) {
        const faction = (result as any).rows[0];
        return { name: faction.name, isRanked: faction.is_ranked === 1 };
      }

      // Try without prefix (e.g., "Ladder Rebels" -> "Rebels")
      const parts = factionName.split(' ').slice(1);
      if (parts.length > 0) {
        const searchName = parts.join(' ');
        result = await query(
          `SELECT name, is_ranked FROM factions WHERE LOWER(name) = LOWER(?) LIMIT 1`,
          [searchName]
        );

        if ((result as any).rows?.length > 0) {
          const faction = (result as any).rows[0];
          return { name: faction.name, isRanked: faction.is_ranked === 1 };
        }
      }

      // Try LIKE match (partial)
      result = await query(
        `SELECT name, is_ranked FROM factions WHERE LOWER(name) LIKE LOWER(?) LIMIT 1`,
        [`%${factionName}%`]
      );

      if ((result as any).rows?.length > 0) {
        const faction = (result as any).rows[0];
        return { name: faction.name, isRanked: faction.is_ranked === 1 };
      }

      return { name: factionName, isRanked: false };
    } catch (err) {
      console.warn(`⚠️  Could not resolve faction "${factionName}":`, err);
      return { name: factionName, isRanked: false };
    }
  }

  /**
   * Resolve map name against game_maps table
   * Searches with: exact match → without prefix → canonical match
   */
  private async resolveMap(mapName: string | null): Promise<{ name: string | null; isRanked: boolean }> {
    if (!mapName) {
      return { name: null, isRanked: false };
    }

    try {
      // Try exact match first
      let result = await query(
        `SELECT name, is_ranked FROM game_maps WHERE LOWER(name) = LOWER(?) LIMIT 1`,
        [mapName]
      );

      if ((result as any).rows?.length > 0) {
        const map = (result as any).rows[0];
        return { name: map.name, isRanked: map.is_ranked === 1 };
      }

      // Try without prefix (e.g., "2p — Tombs of Kesorak" -> "Tombs of Kesorak")
      // Strip patterns like "2p —", "3p —", "4p —", etc. and whitespace
      const cleaned = mapName.replace(/^\d+[a-z]?\s*[—\-–]\s*/i, '').trim();
      if (cleaned !== mapName) {
        result = await query(
          `SELECT name, is_ranked FROM game_maps WHERE LOWER(name) = LOWER(?) LIMIT 1`,
          [cleaned]
        );

        if ((result as any).rows?.length > 0) {
          const map = (result as any).rows[0];
          return { name: map.name, isRanked: map.is_ranked === 1 };
        }
      }

      // Try LIKE match (partial)
      result = await query(
        `SELECT name, is_ranked FROM game_maps WHERE LOWER(name) LIKE LOWER(?) LIMIT 1`,
        [`%${mapName}%`]
      );

      if ((result as any).rows?.length > 0) {
        const map = (result as any).rows[0];
        return { name: map.name, isRanked: map.is_ranked === 1 };
      }

      return { name: mapName, isRanked: false };
    } catch (err) {
      console.warn(`⚠️  Could not resolve map "${mapName}":`, err);
      return { name: mapName, isRanked: false };
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
