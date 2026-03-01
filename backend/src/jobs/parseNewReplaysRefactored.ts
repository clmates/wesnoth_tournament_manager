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
import { createMatch, updateTournamentRoundMatch } from '../services/matchCreationService.js';
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
  // Set when matchType is tournament_* and a matching tournament_round_match is found
  linkedTournamentId: string | null;
  linkedTournamentRoundMatchId: string | null;
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
            // Turn_1 replays that are rejected have no value — delete them entirely
            if (replay.replay_filename.includes('Turn_1_')) {
              console.log(`🗑️  [PARSE] Turn_1 replay rejected → Deleting from replays table`);
              await query(`DELETE FROM replays WHERE id = ?`, [replay.id]);
            } else {
              console.log(`❌ [PARSE] Match rejected → Update replay as rejected`);
              await query(
                `UPDATE replays SET parse_status = 'rejected', need_integration = 0, parsed = 1, integration_confidence = ?, parse_summary = ? WHERE id = ?`,
                [parseSummary.confidenceLevel, JSON.stringify(parseSummary), replay.id]
              );
            }
            errorCount++;
            continue;
          }

          // For tournament matches, link to the specific tournament_round_match
          if (parseSummary.matchType === 'tournament_ranked' || parseSummary.matchType === 'tournament_unranked') {
            const linked = await this.linkToTournament(replay, parseSummary);
            if (!linked) {
              console.log(`❌ [PARSE] Tournament link failed → REJECTED`);
              await query(
                `UPDATE replays SET parse_status = 'rejected', need_integration = 0, parsed = 1, integration_confidence = ?, parse_summary = ? WHERE id = ?`,
                [parseSummary.confidenceLevel, JSON.stringify(parseSummary), replay.id]
              );
              errorCount++;
              continue;
            }
          }

          // Ensure both players exist in users_extension (auto-register if needed)
          await this.ensurePlayersExist(parseSummary.forumPlayers);

          // Check confidence level - only create match if confidence=2
          if (parseSummary.confidenceLevel === 1) {
            console.log(`⏳ [PARSE] Confidence=1 → Parsed but no match created (awaiting player confirmation)`);
            await query(
              `UPDATE replays SET parse_status = 'parsed', parsed = 1, integration_confidence = ?,
               tournament_round_match_id = ?, parse_summary = ? WHERE id = ?`,
              [parseSummary.confidenceLevel, parseSummary.linkedTournamentRoundMatchId, JSON.stringify(parseSummary), replay.id]
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

            if (ageHours < 12) {
              // Leave as 'new' so the next parse cycle will retry automatically
              console.log(`   ⏳ File not found but < 12h old → Leave as 'new' for retry (age: ${ageHours.toFixed(1)}h)`);
              await query(
                `UPDATE replays SET parse_error_message = ? WHERE id = ?`,
                [`File not found, waiting (${ageHours.toFixed(1)}h elapsed)`, replay.id]
              );
            } else {
              // 12h elapsed, discard
              console.log(`   🗑️  File not found and >= 12h old → Discarding (age: ${ageHours.toFixed(1)}h)`);
              await query(
                `UPDATE replays SET parse_status = 'rejected', parsed = 1, parse_error_message = ? WHERE id = ?`,
                [`File never appeared after ${ageHours.toFixed(1)}h — discarded`, replay.id]
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
      matchType: 'rejected',
      linkedTournamentId: null,
      linkedTournamentRoundMatchId: null
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
        } else {
          console.log(`   ✅ Using forum factions (not Custom): ${Object.values(parseSummary.forumFactions).join(' vs ')}`);
        }
      }
    } catch (err) {
      const errMsg = (err as any)?.message || String(err);
      // Re-throw file-not-found so the outer catch can handle retry logic
      if (errMsg.includes('Replay file not found')) {
        throw err;
      }
      console.warn(`⚠️  Could not parse replay file:`, err);
    }

    // ======== VALIDATE AND RESOLVE FACTIONS ========
    console.log(`🔍 [PARSE] Validating factions against factions table...`);
    const winner = parseSummary.forumPlayers[0];
    const loser = parseSummary.forumPlayers[1];
    
    if (winner && loser) {
      // Determine which factions to use: replay factions (Custom) or forum factions (not Custom)
      const winnerFactionRaw = (hasCustomFaction && parseSummary.replayFactions.winner) || parseSummary.forumFactions['side1'] || 'Unknown';
      const loserFactionRaw = (hasCustomFaction && parseSummary.replayFactions.loser) || parseSummary.forumFactions['side2'] || 'Unknown';
      
      const winnerResolved = await this.resolveFaction(winnerFactionRaw);
      const loserResolved = await this.resolveFaction(loserFactionRaw);
      
      // Set finalFactions to the RESOLVED values (clean, without prefixes)
      parseSummary.finalFactions['side1'] = winnerResolved.name || 'Unknown';
      parseSummary.finalFactions['side2'] = loserResolved.name || 'Unknown';
      
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
    parseSummary.finalMap = mapResolved.name;
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

    // ======== TOURNAMENT DETECTION VIA GAME_NAME ========
    // If WML has no tournament field, check if game_name matches an in-progress tournament
    let gameNameMatchesTournament = false;
    if (!parseSummary.replayTournament && replay.game_name) {
      const tournResult = await query(
        `SELECT id FROM tournaments WHERE status = 'in_progress' AND LOCATE(LOWER(name), LOWER(?)) > 0 LIMIT 1`,
        [replay.game_name]
      );
      gameNameMatchesTournament = ((tournResult as any).rows || []).length > 0;
      if (gameNameMatchesTournament) {
        console.log(`   ✅ Game name "${replay.game_name}" matches an in-progress tournament`);
      }
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
    } else if (parseSummary.replayTournament || gameNameMatchesTournament) {
      // Tournament match (detected via WML tournament field OR game_name matching)
      if (parseSummary.factionsAreRanked && parseSummary.mapIsRanked) {
        parseSummary.matchType = 'tournament_ranked';
        console.log(`   ✅ Tournament with ranked assets → TOURNAMENT_RANKED`);
      } else {
        parseSummary.matchType = 'tournament_unranked';
        console.log(`   ⚠️  Tournament with non-ranked assets → TOURNAMENT_UNRANKED`);
      }
    } else if (parseSummary.replayRankedMode && !parseSummary.factionsAreRanked && !parseSummary.mapIsRanked) {
      // Non-ranked assets with ranked addon and no tournament
      parseSummary.matchType = 'rejected';
      console.log(`   ❌ Assets not ranked (factions or map) and no tournament → REJECTED`);
    } else {
      parseSummary.matchType = 'rejected';
      console.log(`   ❌ Cannot determine match type → REJECTED`);
    }

    return parseSummary;
  }

  /**
   * Ensure all forum players exist in users_extension.
   * If a player is missing, auto-register them with default ELO 1400.
   * Uses forum user_id as the source of truth for identity lookup (by nickname).
   */
  private async ensurePlayersExist(forumPlayers: Array<{ user_name: string; user_id?: number }>): Promise<void> {
    for (const player of forumPlayers) {
      if (!player.user_name) continue;
      try {
        const existing = await query(
          `SELECT id FROM users_extension WHERE LOWER(nickname) = LOWER(?) LIMIT 1`,
          [player.user_name]
        );
        if (((existing as any).rows || []).length > 0) continue;

        const { v4: uuidv4 } = await import('uuid');
        const newId = uuidv4();
        await query(
          `INSERT INTO users_extension
             (id, nickname, is_active, is_rated, elo_rating, matches_played, total_wins, total_losses, created_at, updated_at)
           VALUES (?, ?, 1, 0, 1400, 0, 0, 0, NOW(), NOW())`,
          [newId, player.user_name]
        );
        console.log(`👤 [PARSE] Auto-registered player: ${player.user_name} (id=${newId})`);
      } catch (err) {
        console.warn(`⚠️  [PARSE] Failed to ensure player ${player.user_name}:`, (err as any)?.message);
      }
    }
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
   * Create match in database from ParseSummary.
   * Resolves player identities then delegates to the shared matchCreationService.
   */
  private async createMatchFromParseSummary(
    replay: UnparsedReplay,
    parseSummary: ParseSummary
  ): Promise<{ success: boolean; matchId?: string; error?: string }> {
    if (parseSummary.forumPlayers.length < 2 || !parseSummary.replayVictory) {
      return { success: false, error: 'Insufficient data: missing forum players or replay victory' };
    }

    const winnerName = parseSummary.replayVictory.winner_name;
    const loserName  = parseSummary.replayVictory.loser_name;

    const winnerForumData = parseSummary.forumPlayers.find(p => p.user_name === winnerName);
    const loserForumData  = parseSummary.forumPlayers.find(p => p.user_name === loserName);

    if (!winnerForumData || !loserForumData) {
      return {
        success: false,
        error: `Players not found in forum data: winner=${winnerName} (found=${!!winnerForumData}), loser=${loserName} (found=${!!loserForumData})`
      };
    }

    const winnerUserData = await this.getUserDataByNickname(winnerName);
    const loserUserData  = await this.getUserDataByNickname(loserName);

    if (!winnerUserData || !loserUserData) {
      return {
        success: false,
        error: `User not found in users_extension: winner=${winnerName} (found=${!!winnerUserData}), loser=${loserName} (found=${!!loserUserData})`
      };
    }

    const winnerFaction = parseSummary.resolvedFactions[`side${winnerForumData.side_number}`] || 'Unknown';
    const loserFaction  = parseSummary.resolvedFactions[`side${loserForumData.side_number}`]  || 'Unknown';
    const map = parseSummary.resolvedMap || 'Unknown';

    // Build replay file URL
    const gameDate = new Date(replay.end_time);
    const yyyy = gameDate.getFullYear();
    const mm = String(gameDate.getMonth() + 1).padStart(2, '0');
    const dd = String(gameDate.getDate()).padStart(2, '0');
    const cleanFilename = replay.replay_filename.replace(/\.bz2$/, '');
    const replayFilePath = `https://replays.wesnoth.org/${replay.wesnoth_version}/${yyyy}/${mm}/${dd}/${cleanFilename}.bz2`;

    console.log(`\n📝 Creating match: ${winnerName} beat ${loserName} | Map: ${map} | Confidence: ${parseSummary.confidenceLevel}`);

    return createMatch({
      winnerId:                       winnerUserData.id,
      loserId:                        loserUserData.id,
      winnerFaction,
      loserFaction,
      map,
      winnerSide:                     winnerForumData.side_number,
      replayRowId:                    replay.id,
      replayFilePath,
      matchType:                      parseSummary.matchType,
      linkedTournamentId:             parseSummary.linkedTournamentId,
      linkedTournamentRoundMatchId:   parseSummary.linkedTournamentRoundMatchId,
      gameId:                         replay.game_id,
      wesnothVersion:                 replay.wesnoth_version,
      instanceUuid:                   replay.instance_uuid,
    });
  }

  /**
   * Link a tournament replay to the correct tournament and tournament_round_match.
   * Searches for an in-progress tournament whose name is contained in the replay's GAME_NAME (case-insensitive).
   * Verifies both players are active participants and finds their open series.
   * Mutates parseSummary.linkedTournamentId and parseSummary.linkedTournamentRoundMatchId.
   * Returns true on success, false if the replay should be rejected.
   */
  private async linkToTournament(replay: UnparsedReplay, parseSummary: ParseSummary): Promise<boolean> {
    const gameName = (replay.game_name || '').toLowerCase();

    if (!gameName) {
      console.log(`   ❌ [TOURNAMENT LINK] No game_name available`);
      return false;
    }

    // Find all in-progress tournaments whose name is a substring of the game name
    const tournamentResult = await query(
      `SELECT id, name, tournament_mode FROM tournaments
       WHERE status = 'in_progress'
         AND LOCATE(LOWER(name), ?) > 0
       ORDER BY LENGTH(name) DESC
       LIMIT 5`,
      [gameName]
    );

    const tournaments = (tournamentResult as any).rows || [];

    if (tournaments.length === 0) {
      console.log(`   ❌ [TOURNAMENT LINK] No in-progress tournament found in game_name: "${replay.game_name}"`);
      return false;
    }

    // Use the longest (most specific) matching tournament name
    const tournament = tournaments[0];
    console.log(`   ✅ [TOURNAMENT LINK] Matched tournament: "${tournament.name}" (id=${tournament.id})`);

    // Resolve winner and loser user IDs from parseSummary
    const winnerName = parseSummary.replayVictory?.winner_name;
    const loserName  = parseSummary.replayVictory?.loser_name;

    if (!winnerName || !loserName) {
      console.log(`   ❌ [TOURNAMENT LINK] Missing winner/loser names in parseSummary`);
      return false;
    }

    const winnerUser = await this.getUserDataByNickname(winnerName);
    const loserUser  = await this.getUserDataByNickname(loserName);

    if (!winnerUser || !loserUser) {
      console.log(`   ❌ [TOURNAMENT LINK] Users not found: winner=${winnerName}, loser=${loserName}`);
      return false;
    }

    // Verify both players are active approved participants in this tournament
    const participantsResult = await query(
      `SELECT user_id FROM tournament_participants
       WHERE tournament_id = ?
         AND user_id IN (?, ?)
         AND status = 'active'
         AND participation_status = 'accepted'`,
      [tournament.id, winnerUser.id, loserUser.id]
    );

    const participants = (participantsResult as any).rows || [];
    if (participants.length < 2) {
      console.log(`   ❌ [TOURNAMENT LINK] Not all players are active approved participants (found ${participants.length}/2)`);
      return false;
    }

    // Find open tournament_round_match for this pair in the current round
    const roundMatchResult = await query(
      `SELECT trm.id, trm.player1_id, trm.player2_id
       FROM tournament_round_matches trm
       JOIN tournament_rounds tr ON trm.round_id = tr.id
       WHERE trm.tournament_id = ?
         AND trm.series_status = 'in_progress'
         AND tr.round_status = 'in_progress'
         AND (
           (trm.player1_id = ? AND trm.player2_id = ?)
           OR
           (trm.player1_id = ? AND trm.player2_id = ?)
         )
       LIMIT 1`,
      [tournament.id, winnerUser.id, loserUser.id, loserUser.id, winnerUser.id]
    );

    const roundMatches = (roundMatchResult as any).rows || [];
    if (roundMatches.length === 0) {
      console.log(`   ❌ [TOURNAMENT LINK] No open tournament_round_match found for ${winnerName} vs ${loserName}`);
      return false;
    }

    const roundMatch = roundMatches[0];
    console.log(`   ✅ [TOURNAMENT LINK] Linked to round_match id=${roundMatch.id}`);

    parseSummary.linkedTournamentId             = tournament.id;
    parseSummary.linkedTournamentRoundMatchId   = roundMatch.id;
    return true;
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
   * Resolve map name against game_maps table.
   * Tries multiple strategies (exact, prefix-stripped, LIKE, fuzzy with \ufffd→%).
   * Prefers ranked results: never stops early on an unranked match — saves it as
   * fallback and keeps searching for a ranked entry.
   */
  private async resolveMap(mapName: string | null): Promise<{ name: string | null; isRanked: boolean }> {
    if (!mapName) {
      return { name: null, isRanked: false };
    }

    // Helper: run a query and return ranked result immediately, or save as fallback
    let unrankedFallback: { name: string; isRanked: boolean } | null = null;
    const tryQuery = async (sql: string, params: any[]): Promise<{ name: string; isRanked: boolean } | null> => {
      const result = await query(sql, params);
      const rows = (result as any).rows || [];
      if (rows.length === 0) return null;
      const map = rows[0];
      const entry = { name: map.name as string, isRanked: map.is_ranked === 1 };
      if (entry.isRanked) return entry;           // ranked → use immediately
      if (!unrankedFallback) unrankedFallback = entry; // save first unranked hit
      return null;
    };

    try {
      // 1. Exact match (ORDER BY is_ranked DESC so ranked rows come first)
      let hit = await tryQuery(
        `SELECT name, is_ranked FROM game_maps WHERE LOWER(name) = LOWER(?) ORDER BY is_ranked DESC LIMIT 1`,
        [mapName]
      );
      if (hit) return hit;

      // 2. Strip "Np —" / "Np \ufffd" prefix, then exact match
      const cleaned = mapName.replace(/^\d+[a-z]?\s*[—\-–\ufffd]\s*/i, '').trim();
      if (cleaned !== mapName) {
        hit = await tryQuery(
          `SELECT name, is_ranked FROM game_maps WHERE LOWER(name) = LOWER(?) ORDER BY is_ranked DESC LIMIT 1`,
          [cleaned]
        );
        if (hit) return hit;
      }

      // 3. LIKE on raw map name
      hit = await tryQuery(
        `SELECT name, is_ranked FROM game_maps WHERE LOWER(name) LIKE LOWER(?) ORDER BY is_ranked DESC LIMIT 1`,
        [`%${mapName}%`]
      );
      if (hit) return hit;

      // 4. Fuzzy on prefix-stripped name (replace \ufffd with % wildcard)
      const fuzzyClean = cleaned.replace(/\ufffd/g, '%');
      if (fuzzyClean !== cleaned) {
        hit = await tryQuery(
          `SELECT name, is_ranked FROM game_maps WHERE LOWER(name) LIKE LOWER(?) ORDER BY is_ranked DESC LIMIT 1`,
          [fuzzyClean]
        );
        if (hit) return hit;
      }

      // 5. Fuzzy on raw map name
      const fuzzyRaw = mapName.replace(/\ufffd/g, '%');
      if (fuzzyRaw !== mapName && fuzzyRaw !== fuzzyClean) {
        hit = await tryQuery(
          `SELECT name, is_ranked FROM game_maps WHERE LOWER(name) LIKE LOWER(?) ORDER BY is_ranked DESC LIMIT 1`,
          [fuzzyRaw]
        );
        if (hit) return hit;
      }

      // No ranked result found — return best unranked match or the raw input
      return unrankedFallback || { name: mapName, isRanked: false };
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
