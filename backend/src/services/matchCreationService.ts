/**
 * matchCreationService.ts
 *
 * Shared service for creating a ranked/tournament match from a parsed replay.
 * Used by both the automated parse job (confidence=2) and the manual confirm endpoint (confidence=1).
 */

import { query } from '../config/database.js';
import { calculateNewRating, calculateTrend } from '../utils/elo.js';
import { getUserLevel } from '../utils/auth.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateMatchInput {
  winnerId: string;
  loserId: string;
  winnerFaction: string;
  loserFaction: string;
  map: string;
  winnerSide: number;
  /** ID of the replays table row */
  replayRowId: string;
  replayFilePath: string;
  /** 'ranked' | 'tournament_ranked' | 'tournament_unranked' */
  matchType: string;
  /** tournament_id to set on the match (null for direct ranked) */
  linkedTournamentId: string | null;
  /** If set, update win counters in tournament_round_matches after match creation */
  linkedTournamentRoundMatchId: string | null;
  gameId: number;
  wesnothVersion: string;
  instanceUuid: string;
}

export interface CreateMatchResult {
  success: boolean;
  matchId?: string;
  error?: string;
}

function getTournamentType(matchType: string): string | null {
  if (matchType === 'tournament_ranked')   return 'ranked';
  if (matchType === 'tournament_unranked') return 'unranked';
  return null;
}

function getTournamentMode(matchType: string): string | null {
  if (matchType === 'ranked')              return 'ladder';
  if (matchType === 'tournament_ranked')   return 'ranked';
  if (matchType === 'tournament_unranked') return 'unranked';
  return null;
}

/**
 * Create a match record, update ELO/stats for both players,
 * and (if tournament) update tournament_round_match win counters.
 */
export async function createMatch(input: CreateMatchInput): Promise<CreateMatchResult> {
  try {
    const winnerResult = await query(
      `SELECT id, elo_rating, level, matches_played, is_rated, trend FROM users_extension WHERE id = ?`,
      [input.winnerId]
    );
    const loserResult = await query(
      `SELECT id, elo_rating, level, matches_played, is_rated, trend FROM users_extension WHERE id = ?`,
      [input.loserId]
    );

    const winner = (winnerResult as any).rows?.[0];
    const loser  = (loserResult  as any).rows?.[0];

    if (!winner || !loser) {
      return { success: false, error: 'Could not fetch winner/loser from users_extension' };
    }

    const winnerNewRating = calculateNewRating(winner.elo_rating, loser.elo_rating, 'win',  winner.matches_played);
    const loserNewRating  = calculateNewRating(loser.elo_rating,  winner.elo_rating, 'loss', loser.matches_played);

    const winnerTrend = calculateTrend(winner.trend || '-', true);
    const loserTrend  = calculateTrend(loser.trend  || '-', false);

    const matchId = uuidv4();

    await query(
      `INSERT INTO matches (
         id, winner_id, loser_id, winner_faction, loser_faction, map,
         replay_id, replay_file_path, auto_reported, status,
         tournament_type, tournament_mode, tournament_id,
         winner_elo_before, loser_elo_before, winner_level_before, loser_level_before,
         winner_elo_after,  loser_elo_after,  winner_level_after,  loser_level_after,
         winner_side, game_id, wesnoth_version, instance_uuid,
         created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'reported', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        matchId,
        winner.id, loser.id,
        input.winnerFaction, input.loserFaction,
        input.map,
        input.replayRowId, input.replayFilePath,
        getTournamentType(input.matchType),
        getTournamentMode(input.matchType),
        input.linkedTournamentId,
        winner.elo_rating,             loser.elo_rating,
        getUserLevel(winner.elo_rating), getUserLevel(loser.elo_rating),
        winnerNewRating,               loserNewRating,
        getUserLevel(winnerNewRating),  getUserLevel(loserNewRating),
        input.winnerSide,
        input.gameId, input.wesnothVersion, input.instanceUuid,
      ]
    );

    // Update winner stats
    const newWinnerMatches = winner.matches_played + 1;
    const winnerIsNowRated = resolveRated(winner.is_rated, winnerNewRating, newWinnerMatches);
    await query(
      `UPDATE users_extension
       SET elo_rating = ?, is_rated = ?, matches_played = ?,
           total_wins = total_wins + 1, trend = ?, level = ?, updated_at = NOW()
       WHERE id = ?`,
      [winnerNewRating, winnerIsNowRated, newWinnerMatches, winnerTrend, getUserLevel(winnerNewRating), winner.id]
    );

    // Update loser stats
    const newLoserMatches = loser.matches_played + 1;
    const loserIsNowRated = resolveRated(loser.is_rated, loserNewRating, newLoserMatches);
    await query(
      `UPDATE users_extension
       SET elo_rating = ?, is_rated = ?, matches_played = ?,
           total_losses = total_losses + 1, trend = ?, level = ?, updated_at = NOW()
       WHERE id = ?`,
      [loserNewRating, loserIsNowRated, newLoserMatches, loserTrend, getUserLevel(loserNewRating), loser.id]
    );

    // Update tournament round match if linked
    if (input.linkedTournamentRoundMatchId) {
      await updateTournamentRoundMatch(input.linkedTournamentRoundMatchId, winner.id);
    }

    return { success: true, matchId };
  } catch (err) {
    return { success: false, error: (err as any)?.message || String(err) };
  }
}

function resolveRated(currentlyRated: boolean, newElo: number, matchesPlayed: number): boolean {
  if (currentlyRated && newElo < 1400) return false;
  if (!currentlyRated && matchesPlayed >= 10 && newElo >= 1400) return true;
  return currentlyRated;
}

/**
 * Increment win counters in tournament_round_matches.
 * Closes the series if wins_required is reached.
 */
export async function updateTournamentRoundMatch(
  roundMatchId: string,
  winnerId: string
): Promise<{ seriesCompleted: boolean; tournamentId: string | null; roundId: string | null }> {
  const rmResult = await query(
    `SELECT id, tournament_id, round_id, player1_id, player2_id, player1_wins, player2_wins, wins_required
     FROM tournament_round_matches WHERE id = ?`,
    [roundMatchId]
  );

  const rows = (rmResult as any).rows || [];
  if (rows.length === 0) {
    console.warn(`⚠️  [TOURNAMENT LINK] tournament_round_match not found: ${roundMatchId}`);
    return { seriesCompleted: false, tournamentId: null, roundId: null };
  }

  const rm = rows[0];
  const winnerIsPlayer1 = rm.player1_id === winnerId;
  const newP1Wins = rm.player1_wins + (winnerIsPlayer1 ? 1 : 0);
  const newP2Wins = rm.player2_wins + (winnerIsPlayer1 ? 0 : 1);

  const seriesOver = newP1Wins >= rm.wins_required || newP2Wins >= rm.wins_required;
  const newStatus  = seriesOver ? 'completed' : 'in_progress';
  const newWinnerId = seriesOver ? winnerId : null;

  await query(
    `UPDATE tournament_round_matches
     SET player1_wins = ?, player2_wins = ?, series_status = ?, winner_id = ?, updated_at = NOW()
     WHERE id = ?`,
    [newP1Wins, newP2Wins, newStatus, newWinnerId, roundMatchId]
  );

  console.log(`   ✅ [TOURNAMENT LINK] Round match updated: p1_wins=${newP1Wins} p2_wins=${newP2Wins} status=${newStatus}`);

  // When the series ends, update tournament_participants win/loss/points
  if (seriesOver && rm.tournament_id) {
    const loserId = winnerIsPlayer1 ? rm.player2_id : rm.player1_id;

    await query(
      `UPDATE tournament_participants
       SET tournament_wins   = COALESCE(tournament_wins, 0) + 1,
           tournament_points = COALESCE(tournament_points, 0) + 1
       WHERE tournament_id = ? AND user_id = ?`,
      [rm.tournament_id, winnerId]
    );
    await query(
      `UPDATE tournament_participants
       SET tournament_losses = COALESCE(tournament_losses, 0) + 1
       WHERE tournament_id = ? AND user_id = ?`,
      [rm.tournament_id, loserId]
    );

    console.log(`   ✅ [TOURNAMENT LINK] Participant stats: winner(${winnerId}) +1W+1P, loser(${loserId}) +1L`);
  }

  return { seriesCompleted: seriesOver, tournamentId: rm.tournament_id || null, roundId: rm.round_id || null };
}
