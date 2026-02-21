/**
 * Tournament Lookup Utility
 * File: backend/src/utils/tournamentLookup.ts
 * 
 * Purpose: Helper functions to find and link tournaments to auto-reported matches
 * 
 * When Ranked addon specifies tournament="yes", the game_name matches a tournament name
 * This utility finds that tournament and returns its ID for match linking
 */

import { query } from '../config/database.js';

export interface TournamentMatch {
  tournamentId: string;
  tournamentName: string;
  tournamentMode: 'ranked' | 'unranked' | 'team';
  isOpen: boolean;
  participants: Array<{
    userId: string;
    username: string;
  }>;
}

/**
 * Find tournament by exact name match
 * Returns tournament ID, mode, and participant list if found and still open
 */
export async function findTournamentByName(
  tournamentName: string
): Promise<TournamentMatch | null> {
  try {
    console.log(`🏆 [TOURNAMENT] Searching for tournament: "${tournamentName}"`);

    // Search for tournament with exact name match
    const result = await query(
      `SELECT id, name, tournament_mode, status 
       FROM tournaments 
       WHERE name = ? AND status IN ('open', 'in_progress')
       LIMIT 1`,
      [tournamentName]
    );

    if (!result || !(result as any).rows || (result as any).rows.length === 0) {
      console.log(`ℹ️  [TOURNAMENT] No open tournament found: "${tournamentName}"`);
      return null;
    }

    const tournament = (result as any).rows[0];
    const isOpen = tournament.status === 'open';

    console.log(`✅ [TOURNAMENT] Found: ${tournament.name} (${tournament.tournament_mode}) - ${tournament.status}`);

    // Get participants
    const participantsResult = await query(
      `SELECT DISTINCT 
        tp.user_id, 
        ue.username
       FROM tournament_participants tp
       JOIN users_extension ue ON tp.user_id = ue.id
       WHERE tp.tournament_id = ?
       ORDER BY ue.username`,
      [tournament.id]
    );

    const participants = ((participantsResult as any).rows || []).map((row: any) => ({
      userId: row.user_id,
      username: row.username
    }));

    return {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      tournamentMode: tournament.tournament_mode || 'ranked',
      isOpen,
      participants
    };

  } catch (error) {
    console.error('[TOURNAMENT] Error searching for tournament:', error);
    return null;
  }
}

/**
 * Verify both players are registered in a tournament
 * Returns true if both are participants
 */
export async function verifyPlayersInTournament(
  tournamentId: string,
  player1Name: string,
  player2Name: string
): Promise<{ valid: boolean; player1Id?: string; player2Id?: string }> {
  try {
    // Find player IDs by username
    const playersResult = await query(
      `SELECT id, username FROM users_extension 
       WHERE username IN (?, ?)`,
      [player1Name, player2Name]
    );

    const players = ((playersResult as any).rows || []) as Array<{ id: string; username: string }>;
    
    if (players.length !== 2) {
      console.warn(`⚠️  [TOURNAMENT] Players not found: expected 2, got ${players.length}`);
      return { valid: false };
    }

    const player1Id = players.find(p => p.username === player1Name)?.id;
    const player2Id = players.find(p => p.username === player2Name)?.id;

    if (!player1Id || !player2Id) {
      return { valid: false };
    }

    // Check both are registered in tournament
    const registrationResult = await query(
      `SELECT COUNT(*) as count FROM tournament_participants 
       WHERE tournament_id = ? AND user_id IN (?, ?)`,
      [tournamentId, player1Id, player2Id]
    );

    const count = (registrationResult as any).rows[0]?.count || 0;

    if (count !== 2) {
      console.warn(`⚠️  [TOURNAMENT] Not both players registered: ${count}/2`);
      return { valid: false };
    }

    console.log(`✅ [TOURNAMENT] Both players registered in tournament`);

    return {
      valid: true,
      player1Id,
      player2Id
    };

  } catch (error) {
    console.error('[TOURNAMENT] Error verifying tournament players:', error);
    return { valid: false };
  }
}

/**
 * Find tournament match record that corresponds to this auto-reported match
 * Used to link the generated match record to the tournament match
 */
export async function findTournamentMatchRecord(
  tournamentId: string,
  player1Id: string,
  player2Id: string
): Promise<string | null> {
  try {
    // Look for pending/unstarted tournament match with these two players
    const result = await query(
      `SELECT id FROM tournament_matches 
       WHERE tournament_id = ? 
         AND (
           (player1_id = ? AND player2_id = ?) OR
           (player1_id = ? AND player2_id = ?)
         )
         AND match_status IN ('pending', 'unstarted')
       LIMIT 1`,
      [tournamentId, player1Id, player2Id, player2Id, player1Id]
    );

    if (result && (result as any).rows && (result as any).rows.length > 0) {
      const matchId = (result as any).rows[0].id;
      console.log(`✅ [TOURNAMENT] Found pending match: ${matchId}`);
      return matchId;
    }

    return null;

  } catch (error) {
    console.error('[TOURNAMENT] Error finding tournament match:', error);
    return null;
  }
}

export default {
  findTournamentByName,
  verifyPlayersInTournament,
  findTournamentMatchRecord
};
