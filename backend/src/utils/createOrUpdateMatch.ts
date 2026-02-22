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
  era_id?: string;
  starting_map?: string;
  starting_era?: string;
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
 * Main function: Create or update match from parsed replay
 * @param parsedReplay - Parsed replay data from ReplayParser
 * @returns Match ID (newly created or existing)
 */
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
      if (confidence_level === 2) {
        matchStatus = 'confirmed';
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
    if (confidence_level === 2 && matchStatus === 'confirmed') {
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
        email,
        is_admin,
        is_active,
        is_blocked,
        elo_rating,
        total_games,
        total_wins,
        total_losses,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        playerName,
        `${playerName.toLowerCase()}@forum.wesnoth.org`,
        false,
        true,
        false,
        1400, // Default starting elo_rating
        0,
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
        map_name,
        era_name,
        status,
        replay_file_path,
        auto_reported,
        detected_from,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        matchId,
        parsedReplay.id,
        winnerId,
        loserId,
        parsedReplay.scenario_name || 'Unknown',
        parsedReplay.era_id || 'Unknown',
        status,
        replayUrl,
        1, // auto_reported
        'forum', // detected_from
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
    let newStatus = 'pending';
    if (confidenceLevel === 2) {
      newStatus = 'confirmed';
    } else if (confidenceLevel === 1) {
      newStatus = 'pending_report';
    }

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
           map_name = ?,
           era_name = ?,
           status = ?,
           replay_file_path = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        winnerId,
        loserId,
        parsedReplay.scenario_name || 'Unknown',
        parsedReplay.era_id || 'Unknown',
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
 * This triggers the ELO calculation if configured
 */
async function applyEloRating(
  matchId: string,
  winnerId: string,
  loserId: string
): Promise<void> {
  try {
    // Get current ratings
    const winnersResult = await query(
      `SELECT rating FROM users_extension WHERE id = ?`,
      [winnerId]
    );

    const losersResult = await query(
      `SELECT rating FROM users_extension WHERE id = ?`,
      [loserId]
    );

    if (!winnersResult || !(winnersResult as any).rows || (winnersResult as any).rows.length === 0 ||
        !losersResult || !(losersResult as any).rows || (losersResult as any).rows.length === 0) {
      console.warn('⚠️  [ELO] Could not find player ratings');
      return;
    }

    const winnerRating = (winnersResult as any).rows[0].rating || 1200;
    const loserRating = (losersResult as any).rows[0].rating || 1200;

    // Simple Elo calculation (K=32)
    const K = 32;
    const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));

    const newWinnerRating = Math.round(winnerRating + K * (1 - expectedWinner));
    const newLoserRating = Math.round(loserRating + K * (0 - expectedLoser));

    const ratingChange = newWinnerRating - winnerRating;

    console.log(`🏆 [ELO] Winner: ${winnerRating} → ${newWinnerRating} (+${ratingChange})`);
    console.log(`🏆 [ELO] Loser: ${loserRating} → ${newLoserRating} (${newLoserRating - loserRating})`);

    // Update both players' ratings
    await query(
      `UPDATE users_extension SET rating = ?, total_games = total_games + 1, wins = wins + 1 WHERE id = ?`,
      [newWinnerRating, winnerId]
    );

    await query(
      `UPDATE users_extension SET rating = ?, total_games = total_games + 1, losses = losses + 1 WHERE id = ?`,
      [newLoserRating, loserId]
    );

    console.log(`✅ [ELO] Ratings updated for match: ${matchId}`);

  } catch (error) {
    const errorMsg = (error as any)?.message || String(error);
    console.error(`❌ [ELO] Failed to apply rating:`, errorMsg);
    // Don't throw - this is a non-critical operation
  }
}

export default createOrUpdateMatch;
