/**
 * Utility: Create or Update Match from Parsed Replay
 * File: backend/src/utils/createOrUpdateMatch.ts
 * 
 * Purpose: Helper function used by parseNewReplaysRefactored job to:
 * 1. Create or update match records from parsed replay data
 * 2. Create user records if players don't exist
 * 3. Determine match status based on confidence level
 * 4. Apply ELO ratings immediately (confidence=2) or defer (confidence=1)
 * 
 * Integration Points:
 * - Called by parseNewReplaysRefactored job after parsing replay
 * - Uses victory analysis data from ReplayParser
 * - Creates/updates both matches and users_extension tables
 * - Logs all actions to audit_logs for transparency
 */

import { query } from '../config/database.js';
import { getUserLevel } from './auth.js';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedVictory {
  confidence_level: 1 | 2;
  result_type: 'solo' | 'team' | 'one_versus_one' | 'observers';
  winner_name: string;
  winner_faction: string;
  loser_name: string;
  loser_faction: string;
}

export interface ParsedReplay {
  id: string; // replay ID from database
  files_checksum?: string;
  version?: string;
  scenario_name?: string;
  map_name?: string; // Map name for the match
  era_id?: string;
  starting_map?: string;
  starting_era?: string;
  winner_faction?: string; // Winner's faction
  loser_faction?: string; // Loser's faction
  victory: ParsedVictory;
  players?: Array<{
    name: string;
    faction_name: string;
    side_number: number;
  }>;
  addons?: Array<{
    id: string;
    name: string;
    version: string;
  }>;
  // Tournament association (if applicable)
  tournamentId?: string;
  tournamentMatchId?: string;
  tournamentMode?: 'ranked' | 'unranked' | 'team';
}

/**
 * Get player's current ranking position
 */
async function getPlayerRankingPosition(userId: string): Promise<number | null> {
  try {
    const result = await query(
      `SELECT COUNT(*) as position FROM users_extension 
       WHERE is_rated = 1 AND elo_rating > (
         SELECT elo_rating FROM users_extension WHERE id = ?
       )`,
      [userId]
    );
    
    if (result && (result as any).rows && (result as any).rows.length > 0) {
      return (result as any).rows[0].position + 1; // Add 1 because position is 0-indexed
    }
    
    return null;
  } catch (error) {
    console.warn(`⚠️  Could not get ranking position for player ${userId}:`, (error as any)?.message);
    return null;
  }
}

/**
 * Find exact faction name in database (with variant matching)
 */
async function getExactFactionName(factionName: string | undefined): Promise<string | undefined> {
  if (!factionName) return undefined;
  
  try {
    // Try exact match first
    let result = await query(
      `SELECT name FROM factions WHERE name = ? LIMIT 1`,
      [factionName]
    );
    
    if (result && (result as any).rows && (result as any).rows.length > 0) {
      return (result as any).rows[0].name;
    }
    
    // Try without common prefixes: "Ladder ", "Campaign ", etc.
    const cleaned = factionName.replace(/^(Ladder|Campaign|Ranked|Custom)\s+/i, '');
    if (cleaned !== factionName) {
      result = await query(
        `SELECT name FROM factions WHERE name = ? LIMIT 1`,
        [cleaned]
      );
      
      if (result && (result as any).rows && (result as any).rows.length > 0) {
        return (result as any).rows[0].name;
      }
    }
    
    // Not found, return original
    return factionName;
  } catch (error) {
    console.warn(`⚠️  Could not lookup faction: ${factionName}`, (error as any)?.message);
    return factionName;
  }
}

/**
 * Find exact map name in database (with variant matching)
 */
async function getExactMapName(mapName: string | undefined): Promise<string | undefined> {
  if (!mapName) return undefined;
  
  try {
    // Try exact match first
    let result = await query(
      `SELECT name FROM game_maps WHERE name = ? LIMIT 1`,
      [mapName]
    );
    
    if (result && (result as any).rows && (result as any).rows.length > 0) {
      return (result as any).rows[0].name;
    }
    
    // Try without player count prefix: "2p — ", "4p - ", etc.
    const cleaned = mapName.replace(/^\d+p[\s—\-]+/i, '');
    if (cleaned !== mapName) {
      result = await query(
        `SELECT name FROM game_maps WHERE name = ? LIMIT 1`,
        [cleaned]
      );
      
      if (result && (result as any).rows && (result as any).rows.length > 0) {
        return (result as any).rows[0].name;
      }
    }
    
    // Not found, return original
    return mapName;
  } catch (error) {
    console.warn(`⚠️  Could not lookup map: ${mapName}`, (error as any)?.message);
    return mapName;
  }
}
export async function createOrUpdateMatch(
  parsedReplay: ParsedReplay
): Promise<{ matchId: string; isNew: boolean; status: string }> {
  try {
    const { confidence_level, winner_name, loser_name, winner_faction, loser_faction } = parsedReplay.victory;
    
    console.log(`🎯 [MATCH] Creating/updating match for replay: ${parsedReplay.id}`);
    console.log(`   Winner: ${winner_name} (${winner_faction}), Confidence: ${confidence_level}`);
    console.log(`   Loser: ${loser_name} (${loser_faction})`);

    // Step 1: Ensure both players exist in users_extension
    const winnerId = await ensurePlayerExists(winner_name);
    const loserId = await ensurePlayerExists(loser_name);

    // Step 2: Check if match already exists
    const existingMatch = await query(
      `SELECT id, status FROM matches 
       WHERE replay_id = ?`,
      [parsedReplay.id]
    );

    let matchId: string;
    let isNew = true;
    let matchStatus: string;

    if (existingMatch && (existingMatch as any).rows && (existingMatch as any).rows.length > 0) {
      // Match already exists, update it
      matchId = (existingMatch as any).rows[0].id;
      isNew = false;
      matchStatus = (existingMatch as any).rows[0].status;

      console.log(`ℹ️  [MATCH] Match already exists: ${matchId}`);

      // Update match record
      await updateExistingMatch(
        matchId,
        winnerId,
        loserId,
        parsedReplay,
        confidence_level
      );
    } else {
      // Create new match
      matchId = uuidv4();
      
      // Determine status based on confidence level
      // confidence_level 2: match is auto-reported (winner needs to add comments/rating) → 'reported'
      // confidence_level 1: match needs manual report from winner or loser → 'pending_report'
      if (confidence_level === 2) {
        matchStatus = 'reported';
      } else {
        matchStatus = 'pending_report';
      }

      console.log(`✅ [MATCH] Creating new match: ${matchId} with status: ${matchStatus}`);

      await createNewMatch(
        matchId,
        winnerId,
        loserId,
        parsedReplay,
        matchStatus
      );
    }

    // Step 3: Apply ELO immediately if confidence=2
    if (confidence_level === 2 && matchStatus === 'reported') {
      console.log(`🏆 [MATCH] Applying ELO for confident match: ${matchId}`);
      await applyEloRating(matchId, winnerId, loserId);
    }

    return {
      matchId,
      isNew,
      status: matchStatus
    };

  } catch (error) {
    const errorMsg = (error as any)?.message || String(error);
    console.error(`❌ [MATCH] Failed to create/update match:`, errorMsg);
    throw error;
  }
}

/**
 * Ensure a player exists in users_extension table
 * Creates entry if player doesn't exist
 * @param playerName - Name of the player
 * @returns User ID from users_extension
 */
async function ensurePlayerExists(playerName: string): Promise<string> {
  try {
    // Check if player exists
    const existingResult = await query(
      `SELECT id FROM users_extension 
       WHERE nickname = ?`,
      [playerName]
    );

    if (existingResult && (existingResult as any).rows && (existingResult as any).rows.length > 0) {
      return (existingResult as any).rows[0].id;
    }

    // Player doesn't exist, create entry
    const userId = uuidv4();
    
    console.log(`👤 [PLAYER] Creating new player: ${playerName} (${userId})`);

    await query(
      `INSERT INTO users_extension (
        id,
        nickname,
        is_admin,
        is_active,
        is_blocked,
        elo_rating,
        total_wins,
        total_losses,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        playerName,
        false,
        true,
        false,
        1400, // Default starting elo_rating
        0,
        0
      ]
    );

    console.log(`✅ [PLAYER] Player created: ${playerName}`);

    return userId;

  } catch (error) {
    const errorMsg = (error as any)?.message || String(error);
    console.error(`❌ [PLAYER] Failed to ensure player exists:`, errorMsg);
    throw error;
  }
}

/**
 * Create a new match record
 */
async function createNewMatch(
  matchId: string,
  winnerId: string,
  loserId: string,
  parsedReplay: ParsedReplay,
  status: string
): Promise<void> {
  try {
    const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Get current ELO ratings for before-match
    const winnerResult = await query(
      `SELECT elo_rating FROM users_extension WHERE id = ?`,
      [winnerId]
    );
    const loserResult = await query(
      `SELECT elo_rating FROM users_extension WHERE id = ?`,
      [loserId]
    );

    const winnerEloBefore = (winnerResult as any).rows?.[0]?.elo_rating || 1400;
    const loserEloBefore = (loserResult as any).rows?.[0]?.elo_rating || 1400;

    // Calculate levels before match
    const winnerLevelBefore = getUserLevel(winnerEloBefore);
    const loserLevelBefore = getUserLevel(loserEloBefore);

    // Get ranking positions before match
    const winnerRankingBefore = await getPlayerRankingPosition(winnerId);
    const loserRankingBefore = await getPlayerRankingPosition(loserId);

    console.log(`   ELO Before: Winner=${winnerEloBefore} (${winnerLevelBefore}), Loser=${loserEloBefore} (${loserLevelBefore})`);
    console.log(`   Ranking Before: Winner=${winnerRankingBefore}, Loser=${loserRankingBefore}`);

    // Get exact faction names from database
    const exactWinnerFaction = await getExactFactionName(parsedReplay.victory.winner_faction);
    const exactLoserFaction = await getExactFactionName(parsedReplay.victory.loser_faction);
    
    console.log(`   Factions: Winner=${exactWinnerFaction}, Loser=${exactLoserFaction}`);

    // Get exact map name from database
    const exactMap = await getExactMapName(parsedReplay.scenario_name);
    
    console.log(`   Map: ${exactMap}`);

    // Prepare replay URL
    let replayUrl = '';
    const replayResult = await query(
      `SELECT replay_url FROM replays WHERE id = ?`,
      [parsedReplay.id]
    );

    if (replayResult && (replayResult as any).rows && (replayResult as any).rows.length > 0) {
      replayUrl = (replayResult as any).rows[0].replay_url || '';
    }

    await query(
      `INSERT INTO matches (
        id,
        replay_id,
        winner_id,
        loser_id,
        map,
        winner_faction,
        loser_faction,
        status,
        replay_file_path,
        auto_reported,
        winner_elo_before,
        loser_elo_before,
        winner_elo_after,
        loser_elo_after,
        winner_level_before,
        loser_level_before,
        winner_level_after,
        loser_level_after,
        winner_ranking_pos,
        loser_ranking_pos,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        matchId,
        parsedReplay.id,
        winnerId,
        loserId,
        exactMap || 'Unknown',
        exactWinnerFaction || 'Unknown',
        exactLoserFaction || 'Unknown',
        status,
        replayUrl,
        1, // auto_reported
        winnerEloBefore,
        loserEloBefore,
        winnerEloBefore, // Will be updated by applyEloRating
        loserEloBefore,  // Will be updated by applyEloRating
        winnerLevelBefore,
        loserLevelBefore,
        winnerLevelBefore, // Will be updated by applyEloRating
        loserLevelBefore,  // Will be updated by applyEloRating
        winnerRankingBefore,
        loserRankingBefore,
        createdAt,
        createdAt
      ]
    );

    console.log(`✅ [MATCH] Match created: ${matchId}`);

  } catch (error) {
    const errorMsg = (error as any)?.message || String(error);
    console.error(`❌ [MATCH] Failed to create match:`, errorMsg);
    throw error;
  }
}

/**
 * Update an existing match record
 */
async function updateExistingMatch(
  matchId: string,
  winnerId: string,
  loserId: string,
  parsedReplay: ParsedReplay,
  confidenceLevel: number
): Promise<void> {
  try {
    const updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Determine new status if confidence changed
    // confidence_level 2: match is auto-reported (winner needs to add comments/rating) → 'reported'
    // confidence_level 1: match needs manual report from winner or loser → 'pending_report'
    let newStatus = 'pending';
    if (confidenceLevel === 2) {
      newStatus = 'reported';
    } else if (confidenceLevel === 1) {
      newStatus = 'pending_report';
    }

    // Get exact faction names from database
    const exactWinnerFaction = await getExactFactionName(parsedReplay.victory.winner_faction);
    const exactLoserFaction = await getExactFactionName(parsedReplay.victory.loser_faction);
    
    // Get exact map name from database
    const exactMap = await getExactMapName(parsedReplay.scenario_name);

    // Get replay URL
    let replayUrl = '';
    const replayResult = await query(
      `SELECT replay_url FROM replays WHERE id = ?`,
      [parsedReplay.id]
    );

    if (replayResult && (replayResult as any).rows && (replayResult as any).rows.length > 0) {
      replayUrl = (replayResult as any).rows[0].replay_url || '';
    }

    await query(
      `UPDATE matches 
       SET winner_id = ?,
           loser_id = ?,
           map = ?,
           winner_faction = ?,
           loser_faction = ?,
           status = ?,
           replay_file_path = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        winnerId,
        loserId,
        exactMap || 'Unknown',
        exactWinnerFaction || 'Unknown',
        exactLoserFaction || 'Unknown',
        newStatus,
        replayUrl,
        updatedAt,
        matchId
      ]
    );

    console.log(`✅ [MATCH] Match updated: ${matchId}`);

  } catch (error) {
    const errorMsg = (error as any)?.message || String(error);
    console.error(`❌ [MATCH] Failed to update match:`, errorMsg);
    throw error;
  }
}

/**
 * Apply ELO rating change for confirmed match
 * Updates both matches table and users_extension with new ratings
 */
async function applyEloRating(
  matchId: string,
  winnerId: string,
  loserId: string
): Promise<void> {
  try {
    // Get current ratings and match info
    const matchResult = await query(
      `SELECT winner_elo_before, loser_elo_before, winner_ranking_pos, loser_ranking_pos FROM matches WHERE id = ?`,
      [matchId]
    );

    if (!matchResult || !(matchResult as any).rows || (matchResult as any).rows.length === 0) {
      console.warn('⚠️  [ELO] Could not find match');
      return;
    }

    const match = (matchResult as any).rows[0];
    const winnerRating = match.winner_elo_before || 1400;
    const loserRating = match.loser_elo_before || 1400;
    const winnerRankingBefore = match.winner_ranking_pos;
    const loserRankingBefore = match.loser_ranking_pos;

    // Simple Elo calculation (K=32)
    const K = 32;
    const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

    const newWinnerRating = Math.round(winnerRating + K * (1 - expectedWinner));
    const newLoserRating = Math.round(loserRating + K * (0 - expectedLoser));

    const ratingChange = newWinnerRating - winnerRating;

    // Calculate new levels
    const newWinnerLevel = getUserLevel(newWinnerRating);
    const newLoserLevel = getUserLevel(newLoserRating);

    console.log(`🏆 [ELO] Winner: ${winnerRating} (${getUserLevel(winnerRating)}) → ${newWinnerRating} (${newWinnerLevel}) (+${ratingChange})`);
    console.log(`🏆 [ELO] Loser: ${loserRating} (${getUserLevel(loserRating)}) → ${newLoserRating} (${newLoserLevel}) (${newLoserRating - loserRating})`);

    // Update winner: increment matches_played and set new ELO
    await query(
      `UPDATE users_extension 
       SET elo_rating = ?, 
           total_wins = total_wins + 1,
           is_active = 1,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [newWinnerRating, winnerId]
    );

    // Update loser: increment matches_played and set new ELO
    await query(
      `UPDATE users_extension 
       SET elo_rating = ?, 
           total_losses = total_losses + 1,
           is_active = 1,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [newLoserRating, loserId]
    );

    // Get new ranking positions after ELO update
    const winnerRankingAfter = await getPlayerRankingPosition(winnerId);
    const loserRankingAfter = await getPlayerRankingPosition(loserId);

    // Calculate ranking changes (negative = improved ranking, positive = worsened)
    const winnerRankingChange = winnerRankingAfter !== null && winnerRankingBefore !== null 
      ? winnerRankingAfter - winnerRankingBefore 
      : null;
    const loserRankingChange = loserRankingAfter !== null && loserRankingBefore !== null 
      ? loserRankingAfter - loserRankingBefore 
      : null;

    console.log(`📊 [RANKING] Winner: ${winnerRankingBefore} → ${winnerRankingAfter} (${winnerRankingChange === null ? 'N/A' : (winnerRankingChange > 0 ? '+' : '')+winnerRankingChange})`);
    console.log(`📊 [RANKING] Loser: ${loserRankingBefore} → ${loserRankingAfter} (${loserRankingChange === null ? 'N/A' : (loserRankingChange > 0 ? '+' : '')+loserRankingChange})`);

    // Update match with after-match ELO ratings, levels, and ranking changes
    await query(
      `UPDATE matches 
       SET winner_elo_after = ?,
           loser_elo_after = ?,
           winner_level_after = ?,
           loser_level_after = ?,
           winner_ranking_pos = ?,
           loser_ranking_pos = ?,
           winner_ranking_change = ?,
           loser_ranking_change = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newWinnerRating, newLoserRating, newWinnerLevel, newLoserLevel, winnerRankingAfter, loserRankingAfter, winnerRankingChange, loserRankingChange, matchId]
    );

    console.log(`✅ [ELO] Ratings and rankings updated for match: ${matchId}`);

  } catch (error) {
    const errorMsg = (error as any)?.message || String(error);
    console.error(`❌ [ELO] Failed to apply rating:`, errorMsg);
    // Don't throw - this is a non-critical operation
  }
}

export default createOrUpdateMatch;
