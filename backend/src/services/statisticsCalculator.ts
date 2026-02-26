/**
 * Statistics Calculator Service
 * Migrated from PostgreSQL stored procedures to TypeScript/Node.js
 * 
 * Functions:
 * - Tournament tiebreakers calculations (league, swiss, team swiss)
 * - Balance event snapshots management
 * - Faction/map statistics trend analysis
 * - Team member validation checks
 */

import { query } from '../config/database';
import { randomUUID } from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface TiebreakerResult {
  user_id?: string;
  team_id?: string;
  total_points: number;
  omp: number; // Opponent Match Points
  gwp: number; // Game Win Percentage
  ogp: number; // Opponent Game Win Percentage
}

export interface BalanceEventSnapshot {
  snapshot_date: Date;
  map_id: string;
  faction_id: string;
  opponent_faction_id: string;
  total_games: number;
  wins: number;
  losses: number;
  winrate: number;
  sample_size_category: 'small' | 'medium' | 'large';
  confidence_level: number;
}

export interface BalanceEventImpact {
  map_id: string;
  map_name: string;
  faction_id: string;
  faction_name: string;
  opponent_faction_id: string;
  opponent_faction_name: string;
  winrate_before: number;
  winrate_after: number;
  winrate_change: number;
  sample_size_before: number;
  sample_size_after: number;
  games_before: number;
  games_after: number;
}

export interface BalanceTrendPoint {
  snapshot_date: Date;
  total_games: number;
  wins: number;
  losses: number;
  winrate: number;
  confidence_level: number;
  sample_size_category: string;
}

// ============================================================================
// TIEBREAKER CALCULATIONS
// ============================================================================

/**
 * Calculate league tournament tiebreakers
 * Returns: total_points, OMP, GWP, OGP for each player
 */
export async function calculateLeagueTiebreakers(
  tournamentId: string
): Promise<TiebreakerResult[]> {
  try {
    // Get all participants
    const participantsResult = await query(
      `SELECT DISTINCT tp.user_id
       FROM tournament_participants tp
       WHERE tp.tournament_id = ?
       ORDER BY tp.user_id`,
      [tournamentId]
    );

    const results: TiebreakerResult[] = [];

    for (const participant of participantsResult.rows) {
      const userId = participant.user_id;

      // 1. TOTAL POINTS = tournament_wins
      const pointsResult = await query(
        `SELECT COALESCE(tp.tournament_wins, 0) as total_points
         FROM tournament_participants tp
         WHERE tp.tournament_id = ? AND tp.user_id = ?`,
        [tournamentId, userId]
      );
      const totalPoints = pointsResult.rows[0]?.total_points || 0;

      // 2. OMP (Opponent Match Points) = Average wins of all opponents faced
      const ompResult = await query(
        `SELECT COALESCE(AVG(COALESCE(tp.tournament_wins, 0)), 0) as omp
         FROM (
           SELECT DISTINCT
             CASE 
               WHEN tm.player1_id = ? THEN tm.player2_id
               ELSE tm.player1_id
             END as opponent_id
           FROM tournament_round_matches tm
           WHERE tm.tournament_id = ?
             AND (tm.player1_id = ? OR tm.player2_id = ?)
             AND tm.series_status = 'completed'
         ) opponents
         LEFT JOIN tournament_participants tp ON tp.tournament_id = ? 
           AND tp.user_id = opponents.opponent_id`,
        [userId, tournamentId]
      );
      const omp = parseFloat(ompResult.rows[0]?.omp || 0);

      // 3. GWP (Game Win Percentage) = (games won / total games) * 100
      const gwpResult = await query(
        `SELECT 
           COALESCE(SUM(CASE WHEN tm.player1_id = ? THEN tm.player1_wins ELSE tm.player2_wins END), 0) as games_won,
           COALESCE(SUM(CASE WHEN tm.player1_id = ? THEN tm.player2_wins ELSE tm.player1_wins END), 0) as games_lost
         FROM tournament_round_matches tm
         WHERE tm.tournament_id = ?
           AND (tm.player1_id = ? OR tm.player2_id = ?)
           AND tm.series_status = 'completed'`,
        [userId, tournamentId]
      );
      
      const gamesWon = gwpResult.rows[0]?.games_won || 0;
      const gamesLost = gwpResult.rows[0]?.games_lost || 0;
      const totalGames = gamesWon + gamesLost;
      const gwp = totalGames > 0 ? Math.round((gamesWon / totalGames) * 10000) / 100 : 0;

      // 4. OGP (Opponent Game Win Percentage) = Average GWP of opponents
      const ogpResult = await query(
        `SELECT COALESCE(AVG(
           CASE 
             WHEN (opp_wins + opp_losses) > 0 
             THEN (opp_wins / (opp_wins + opp_losses) * 100)
             ELSE 0
           END
         ), 0) as ogp
         FROM (
           SELECT DISTINCT
             CASE 
               WHEN tm.player1_id = ? THEN tm.player2_id
               ELSE tm.player1_id
             END as opponent_id,
             CASE 
               WHEN tm.player1_id = ? THEN tm.player2_wins
               ELSE tm.player1_wins
             END as opp_wins,
             CASE 
               WHEN tm.player1_id = ? THEN tm.player1_wins
               ELSE tm.player2_wins
             END as opp_losses
           FROM tournament_round_matches tm
           WHERE tm.tournament_id = ?
             AND (tm.player1_id = ? OR tm.player2_id = ?)
             AND tm.series_status = 'completed'
         ) opponent_data`,
        [userId, tournamentId]
      );
      const ogp = parseFloat(ogpResult.rows[0]?.ogp || 0);

      results.push({
        user_id: userId,
        total_points: totalPoints,
        omp,
        gwp,
        ogp
      });
    }

    return results;
  } catch (error) {
    console.error('Error calculating league tiebreakers:', error);
    throw error;
  }
}

/**
 * Calculate swiss tournament tiebreakers (same as league for now)
 */
export async function calculateSwissTiebreakers(
  tournamentId: string
): Promise<TiebreakerResult[]> {
  // Swiss uses same calculation as league
  return calculateLeagueTiebreakers(tournamentId);
}

/**
 * Calculate team swiss tournament tiebreakers
 */
export async function calculateTeamSwissTiebreakers(
  tournamentId: string
): Promise<TiebreakerResult[]> {
  try {
    // Get all teams
    const teamsResult = await query(
      `SELECT DISTINCT tt.id
       FROM tournament_teams tt
       WHERE tt.tournament_id = ?
       ORDER BY tt.id`,
      [tournamentId]
    );

    const results: TiebreakerResult[] = [];

    for (const team of teamsResult.rows) {
      const teamId = team.id;

      // 1. TOTAL POINTS = tournament_wins * 3
      const pointsResult = await query(
        `SELECT COALESCE(tt.tournament_wins, 0) * 3 as total_points
         FROM tournament_teams tt
         WHERE tt.tournament_id = ? AND tt.id = ?`,
        [tournamentId, teamId]
      );
      const totalPoints = pointsResult.rows[0]?.total_points || 0;

      // 2. OMP = Average wins of all opponent teams * 3
      const ompResult = await query(
        `SELECT COALESCE(AVG(COALESCE(tt.tournament_wins, 0) * 3), 0) as omp
         FROM (
           SELECT DISTINCT
             CASE 
               WHEN tm.player1_id = ? THEN tm.player2_id
               ELSE tm.player1_id
             END as opponent_id
           FROM tournament_round_matches tm
           WHERE tm.tournament_id = ?
             AND (tm.player1_id = ? OR tm.player2_id = ?)
             AND tm.series_status = 'completed'
         ) opponents
         LEFT JOIN tournament_teams tt ON tt.tournament_id = ? 
           AND tt.id = opponents.opponent_id`,
        [teamId, tournamentId]
      );
      const omp = parseFloat(ompResult.rows[0]?.omp || 0);

      // 3. GWP (Game Win Percentage)
      const gwpResult = await query(
        `SELECT 
           COALESCE(SUM(CASE WHEN tm.player1_id = ? THEN tm.player1_wins ELSE tm.player2_wins END), 0) as games_won,
           COALESCE(SUM(CASE WHEN tm.player1_id = ? THEN tm.player2_wins ELSE tm.player1_wins END), 0) as games_lost
         FROM tournament_round_matches tm
         WHERE tm.tournament_id = ?
           AND (tm.player1_id = ? OR tm.player2_id = ?)
           AND tm.series_status = 'completed'`,
        [teamId, tournamentId]
      );
      
      const gamesWon = gwpResult.rows[0]?.games_won || 0;
      const gamesLost = gwpResult.rows[0]?.games_lost || 0;
      const totalGames = gamesWon + gamesLost;
      const gwp = totalGames > 0 ? Math.round((gamesWon / totalGames) * 10000) / 100 : 0;

      // 4. OGP (Opponent Game Win Percentage)
      const ogpResult = await query(
        `SELECT COALESCE(AVG(
           CASE 
             WHEN (opp_wins + opp_losses) > 0 
             THEN (opp_wins / (opp_wins + opp_losses) * 100)
             ELSE 0
           END
         ), 0) as ogp
         FROM (
           SELECT DISTINCT
             CASE 
               WHEN tm.player1_id = ? THEN tm.player2_id
               ELSE tm.player1_id
             END as opponent_id,
             CASE 
               WHEN tm.player1_id = ? THEN tm.player2_wins
               ELSE tm.player1_wins
             END as opp_wins,
             CASE 
               WHEN tm.player1_id = ? THEN tm.player1_wins
               ELSE tm.player2_wins
             END as opp_losses
           FROM tournament_round_matches tm
           WHERE tm.tournament_id = ?
             AND (tm.player1_id = ? OR tm.player2_id = ?)
             AND tm.series_status = 'completed'
         ) opponent_data`,
        [teamId, tournamentId]
      );
      const ogp = parseFloat(ogpResult.rows[0]?.ogp || 0);

      results.push({
        team_id: teamId,
        total_points: totalPoints,
        omp,
        gwp,
        ogp
      });
    }

    return results;
  } catch (error) {
    console.error('Error calculating team swiss tiebreakers:', error);
    throw error;
  }
}

// ============================================================================
// TEAM MEMBER VALIDATIONS
// ============================================================================

/**
 * Check if team has more than 2 members
 */
export async function checkTeamMemberCount(teamId: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM tournament_participants 
       WHERE team_id = ? AND team_position IS NOT NULL`,
      [teamId]
    );
    
    const count = result.rows[0]?.count || 0;
    return count <= 2;
  } catch (error) {
    console.error('Error checking team member count:', error);
    throw error;
  }
}

/**
 * Check if team has duplicate positions (position must be unique)
 */
export async function checkTeamMemberPositions(
  teamId: string,
  position: number,
  userId: string
): Promise<boolean> {
  try {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM tournament_participants 
       WHERE team_id = ? 
         AND team_position = ? 
         AND user_id != ?`,
      [teamId, position, userId]
    );
    
    const count = result.rows[0]?.count || 0;
    return count === 0; // Should be 0 duplicates
  } catch (error) {
    console.error('Error checking team member positions:', error);
    throw error;
  }
}

// ============================================================================
// BALANCE EVENT SNAPSHOTS
// ============================================================================

/**
 * Create BEFORE snapshot for balance event
 */
export async function createBalanceEventBeforeSnapshot(
  eventId: string
): Promise<number> {
  try {
    const beforeDate = new Date();
    beforeDate.setDate(beforeDate.getDate() - 1); // Yesterday
    const dateStr = beforeDate.toISOString().split('T')[0];

    // Get existing snapshots for this date to avoid duplicates
    const existingResult = await query(
      `SELECT COUNT(*) as count FROM faction_map_statistics_history WHERE snapshot_date = ?`,
      [dateStr]
    );
    
    if (existingResult.rows[0].count > 0) {
      // Snapshot already exists for this date, skip
      return existingResult.rows[0].count;
    }

    const result = await query(
      `INSERT INTO faction_map_statistics_history (
        id,
        snapshot_date,
        snapshot_timestamp,
        map_id,
        faction_id,
        opponent_faction_id,
        total_games,
        wins,
        losses,
        winrate,
        sample_size_category,
        confidence_level
      )
      SELECT
        UUID(),
        ?,
        CURRENT_TIMESTAMP,
        fms.map_id,
        fms.faction_id,
        fms.opponent_faction_id,
        fms.total_games,
        fms.wins,
        fms.losses,
        fms.winrate,
        CASE
          WHEN fms.total_games < 10 THEN 'small'
          WHEN fms.total_games < 50 THEN 'medium'
          ELSE 'large'
        END,
        CASE
          WHEN fms.total_games < 10 THEN 25.0
          WHEN fms.total_games < 30 THEN 50.0
          WHEN fms.total_games < 50 THEN 75.0
          ELSE 95.0
        END
      FROM faction_map_statistics fms
      WHERE fms.total_games > 0`,
      [dateStr]
    );

    // Update balance_events to record snapshot date
    await query(
      `UPDATE balance_events
       SET snapshot_before_date = ?
       WHERE id = ?`,
      [beforeDate.toISOString().split('T')[0], eventId]
    );

    return result.rowCount || 0;
  } catch (error) {
    console.error('Error creating balance event before snapshot:', error);
    throw error;
  }
}

/**
 * Create faction/map statistics snapshot
 */
export async function createFactionMapStatisticsSnapshot(
  snapshotDate: Date = new Date()
): Promise<{ snapshots_created: number; snapshots_skipped: number }> {
  try {
    const { randomUUID } = await import('crypto');
    const dateStr = snapshotDate.toISOString().split('T')[0];

    // Check if snapshot already exists for this date
    const existingResult = await query(
      `SELECT COUNT(*) as count FROM faction_map_statistics_history WHERE snapshot_date = ?`,
      [dateStr]
    );
    
    if (existingResult.rows[0].count > 0) {
      // Snapshot already exists, skip
      return {
        snapshots_created: 0,
        snapshots_skipped: existingResult.rows[0].count
      };
    }

    const result = await query(
      `INSERT INTO faction_map_statistics_history (
        id,
        snapshot_date,
        snapshot_timestamp,
        map_id,
        faction_id,
        opponent_faction_id,
        total_games,
        wins,
        losses,
        winrate,
        sample_size_category,
        confidence_level
      )
      SELECT
        UUID(),
        ?,
        CURRENT_TIMESTAMP,
        fms.map_id,
        fms.faction_id,
        fms.opponent_faction_id,
        fms.total_games,
        fms.wins,
        fms.losses,
        fms.winrate,
        CASE
          WHEN fms.total_games < 10 THEN 'small'
          WHEN fms.total_games < 50 THEN 'medium'
          ELSE 'large'
        END,
        CASE
          WHEN fms.total_games < 10 THEN 25.0
          WHEN fms.total_games < 30 THEN 50.0
          WHEN fms.total_games < 50 THEN 75.0
          ELSE 95.0
        END
      FROM faction_map_statistics fms
      WHERE fms.total_games > 0`,
      [dateStr]
    );

    return {
      snapshots_created: result.rowCount || 0,
      snapshots_skipped: 0
    };
  } catch (error) {
    console.error('Error creating faction/map statistics snapshot:', error);
    throw error;
  }
}

/**
 * Get balance event impact (before vs after)
 */
export async function getBalanceEventImpact(
  eventId: string,
  daysBefore: number = 30,
  daysAfter: number = 30
): Promise<BalanceEventImpact[]> {
  try {
    // Get event details
    const eventResult = await query(
      'SELECT snapshot_before_date, event_date FROM balance_events WHERE id = ?',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return [];
    }

    const { snapshot_before_date, event_date } = eventResult.rows[0];
    const afterDate = new Date(event_date);
    afterDate.setDate(afterDate.getDate() + daysAfter);

    const result = await query(
      `SELECT
        COALESCE(gm.id, '') as map_id,
        COALESCE(gm.name, '') as map_name,
        COALESCE(f1.id, '') as faction_id,
        COALESCE(f1.name, '') as faction_name,
        COALESCE(f2.id, '') as opponent_faction_id,
        COALESCE(f2.name, '') as opponent_faction_name,
        COALESCE(AVG(CASE WHEN fmsh.snapshot_date < ? THEN fmsh.winrate ELSE NULL END), 0) as winrate_before,
        COALESCE(AVG(CASE WHEN fmsh.snapshot_date >= ? THEN fmsh.winrate ELSE NULL END), 0) as winrate_after,
        COALESCE(AVG(CASE WHEN fmsh.snapshot_date >= ? THEN fmsh.winrate ELSE NULL END), 0) -
          COALESCE(AVG(CASE WHEN fmsh.snapshot_date < ? THEN fmsh.winrate ELSE NULL END), 0) as winrate_change,
        COUNT(DISTINCT CASE WHEN fmsh.snapshot_date < ? THEN fmsh.map_id END) as sample_size_before,
        COUNT(DISTINCT CASE WHEN fmsh.snapshot_date >= ? THEN fmsh.map_id END) as sample_size_after,
        COALESCE(SUM(CASE WHEN fmsh.snapshot_date < ? THEN fmsh.total_games ELSE 0 END), 0) as games_before,
        COALESCE(SUM(CASE WHEN fmsh.snapshot_date >= ? THEN fmsh.total_games ELSE 0 END), 0) as games_after
      FROM faction_map_statistics_history fmsh
      LEFT JOIN game_maps gm ON gm.id = fmsh.map_id
      LEFT JOIN factions f1 ON f1.id = fmsh.faction_id
      LEFT JOIN factions f2 ON f2.id = fmsh.opponent_faction_id
      WHERE fmsh.snapshot_date BETWEEN ? AND ?
      GROUP BY gm.id, gm.name, f1.id, f1.name, f2.id, f2.name`,
      [eventId, snapshot_before_date, event_date, afterDate.toISOString().split('T')[0]]
    );

    return result.rows as BalanceEventImpact[];
  } catch (error) {
    console.error('Error getting balance event impact:', error);
    throw error;
  }
}

/**
 * Get balance trend for faction/map over time
 */
export async function getBalanceTrend(
  mapId: string,
  factionId: string,
  opponentFactionId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<BalanceTrendPoint[]> {
  try {
    const result = await query(
      `SELECT
        fms.snapshot_date,
        fms.total_games,
        fms.wins,
        fms.losses,
        fms.winrate,
        fms.confidence_level,
        fms.sample_size_category
      FROM faction_map_statistics_history fms
      WHERE fms.map_id = ?
        AND fms.faction_id = ?
        AND fms.opponent_faction_id = ?
        AND fms.snapshot_date BETWEEN ? AND ?
      ORDER BY fms.snapshot_date ASC`,
      [mapId, factionId, opponentFactionId, dateFrom, dateTo]
    );

    return result.rows as BalanceTrendPoint[];
  } catch (error) {
    console.error('Error getting balance trend:', error);
    throw error;
  }
}

/**
 * Manage faction/map statistics snapshots (cleanup old, create new)
 */
export async function manageFactionMapStatisticsSnapshots(): Promise<{
  snapshots_deleted: number;
  snapshot_after_created: boolean;
}> {
  try {
    // Find last balance event
    const eventResult = await query(
      `SELECT id, event_date FROM balance_events
       ORDER BY event_date DESC LIMIT 1`
    );

    if (eventResult.rows.length === 0) {
      return {
        snapshots_deleted: 0,
        snapshot_after_created: false
      };
    }

    const lastEvent = eventResult.rows[0];
    const lastEventDate = new Date(lastEvent.event_date);

    // Delete snapshots after last event
    const deleteResult = await query(
      `DELETE FROM faction_map_statistics_history
       WHERE snapshot_date > ?`,
      [lastEventDate]
    );

    // Create today's snapshot
    const snapshotResult = await createFactionMapStatisticsSnapshot(new Date());

    return {
      snapshots_deleted: deleteResult.rowCount || 0,
      snapshot_after_created: snapshotResult.snapshots_created > 0
    };
  } catch (error) {
    console.error('Error managing faction/map statistics snapshots:', error);
    throw error;
  }
}

// ============================================================================
// STATISTICS RECALCULATION (10 functions)
// ============================================================================

/**
 * Recalculate all player match statistics
 * Populates 4 types of rows per player:
 *  1. Global  (opponent_id=NULL, map_id=NULL, faction_id=NULL)
 *  2. Per-opponent (opponent_id=set, map_id=NULL, faction_id=NULL, opponent_faction_id=NULL)
 *  3. Per-map      (opponent_id=NULL, map_id=set, faction_id=NULL)
 *  4. Per-faction  (opponent_id=NULL, map_id=NULL, faction_id=set, opponent_faction_id=set)
 */
export async function recalculatePlayerMatchStatistics(): Promise<{ records_updated: number }> {
  try {
    const { randomUUID } = await import('crypto');

    // Truncate the stats table
    await query('TRUNCATE TABLE player_match_statistics');

    // Get all unique players that have played at least one non-cancelled match
    const playersResult = await query(
      `SELECT DISTINCT winner_id as player_id FROM matches WHERE status != 'cancelled'
       UNION
       SELECT DISTINCT loser_id FROM matches WHERE status != 'cancelled'`
    );

    let recordsUpdated = 0;

    for (const p of playersResult.rows) {
      const playerId = p.player_id;

      // ── 1. GLOBAL STATS ─────────────────────────────────────────────────────
      const globalResult = await query(
        `SELECT
           SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN loser_id  = ? THEN 1 ELSE 0 END) as losses,
           AVG(CASE WHEN winner_id = ? THEN winner_elo_after - winner_elo_before
                    WHEN loser_id  = ? THEN loser_elo_after  - loser_elo_before END) as avg_elo_change
         FROM matches
         WHERE (winner_id = ? OR loser_id = ?) AND status != 'cancelled'`,
        [playerId, playerId, playerId, playerId, playerId, playerId]
      );

      const gRow = globalResult.rows[0];
      const gWins   = parseInt(gRow.wins)   || 0;
      const gLosses = parseInt(gRow.losses) || 0;
      const gTotal  = gWins + gLosses;
      const gWinrate = gTotal > 0 ? (gWins / gTotal) * 100 : 0;

      await query(
        `INSERT INTO player_match_statistics
         (id, player_id, opponent_id, map_id, faction_id, opponent_faction_id,
          total_games, wins, losses, winrate, avg_elo_change)
         VALUES (?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
        [randomUUID(), playerId, gTotal, gWins, gLosses,
         Math.round(gWinrate * 100) / 100, Math.round((gRow.avg_elo_change || 0) * 100) / 100]
      );
      recordsUpdated++;

      // ── 2. PER-OPPONENT STATS ────────────────────────────────────────────────
      const opponentResult = await query(
        `SELECT
           CASE WHEN winner_id = ? THEN loser_id  ELSE winner_id END as opponent_id,
           SUM(CASE WHEN winner_id = ? THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN loser_id  = ? THEN 1 ELSE 0 END) as losses,
           AVG(CASE WHEN winner_id = ? THEN winner_elo_after - winner_elo_before
                    WHEN loser_id  = ? THEN loser_elo_after  - loser_elo_before END) as avg_elo_change,
           SUM(CASE WHEN winner_id = ? AND (winner_elo_after - winner_elo_before) > 0
                    THEN winner_elo_after - winner_elo_before ELSE 0 END) as elo_gained,
           SUM(CASE WHEN loser_id  = ? AND (loser_elo_before - loser_elo_after) > 0
                    THEN loser_elo_before - loser_elo_after  ELSE 0 END) as elo_lost,
           MAX(CASE WHEN winner_id = ? THEN loser_elo_before
                    WHEN loser_id  = ? THEN winner_elo_before END) as last_elo_against_me,
           MAX(created_at) as last_match_date
         FROM matches
         WHERE (winner_id = ? OR loser_id = ?) AND status != 'cancelled'
         GROUP BY CASE WHEN winner_id = ? THEN loser_id ELSE winner_id END`,
        [playerId, playerId, playerId, playerId, playerId,
         playerId, playerId, playerId, playerId, playerId, playerId, playerId]
      );

      for (const row of opponentResult.rows) {
        const wins   = parseInt(row.wins)   || 0;
        const losses = parseInt(row.losses) || 0;
        const total  = wins + losses;
        const winrate = total > 0 ? (wins / total) * 100 : 0;

        await query(
          `INSERT INTO player_match_statistics
           (id, player_id, opponent_id, map_id, faction_id, opponent_faction_id,
            total_games, wins, losses, winrate, avg_elo_change,
            elo_gained, elo_lost, last_elo_against_me, last_match_date)
           VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), playerId, row.opponent_id, total, wins, losses,
           Math.round(winrate * 100) / 100,
           Math.round((row.avg_elo_change || 0) * 100) / 100,
           Math.round((row.elo_gained || 0) * 100) / 100,
           Math.round((row.elo_lost   || 0) * 100) / 100,
           row.last_elo_against_me ? Math.round(row.last_elo_against_me * 100) / 100 : null,
           row.last_match_date || null]
        );
        recordsUpdated++;
      }

      // ── 3. PER-MAP STATS ─────────────────────────────────────────────────────
      const mapResult = await query(
        `SELECT
           gm.id as map_id,
           SUM(CASE WHEN m.winner_id = ? THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN m.loser_id  = ? THEN 1 ELSE 0 END) as losses,
           AVG(CASE WHEN m.winner_id = ? THEN m.winner_elo_after - m.winner_elo_before
                    WHEN m.loser_id  = ? THEN m.loser_elo_after  - m.loser_elo_before END) as avg_elo_change
         FROM matches m
         JOIN game_maps gm ON gm.name = m.map
         WHERE (m.winner_id = ? OR m.loser_id = ?) AND m.status != 'cancelled'
         GROUP BY gm.id`,
        [playerId, playerId, playerId, playerId, playerId, playerId]
      );

      for (const row of mapResult.rows) {
        const wins   = parseInt(row.wins)   || 0;
        const losses = parseInt(row.losses) || 0;
        const total  = wins + losses;
        const winrate = total > 0 ? (wins / total) * 100 : 0;

        await query(
          `INSERT INTO player_match_statistics
           (id, player_id, opponent_id, map_id, faction_id, opponent_faction_id,
            total_games, wins, losses, winrate, avg_elo_change)
           VALUES (?, ?, NULL, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
          [randomUUID(), playerId, row.map_id, total, wins, losses,
           Math.round(winrate * 100) / 100,
           Math.round((row.avg_elo_change || 0) * 100) / 100]
        );
        recordsUpdated++;
      }

      // ── 4. PER-FACTION (PLAYER'S FACTION vs OPPONENT FACTION) ───────────────
      // Wins side: player was winner — group by winner_faction vs loser_faction
      const factionWinResult = await query(
        `SELECT
           f_w.id as faction_id,
           f_l.id as opponent_faction_id,
           COUNT(*) as wins
         FROM matches m
         JOIN factions f_w ON f_w.name = m.winner_faction
         JOIN factions f_l ON f_l.name = m.loser_faction
         WHERE m.winner_id = ? AND m.status != 'cancelled'
         GROUP BY f_w.id, f_l.id`,
        [playerId]
      );

      // Losses side: player was loser — group by loser_faction vs winner_faction
      const factionLossResult = await query(
        `SELECT
           f_l.id as faction_id,
           f_w.id as opponent_faction_id,
           COUNT(*) as losses
         FROM matches m
         JOIN factions f_w ON f_w.name = m.winner_faction
         JOIN factions f_l ON f_l.name = m.loser_faction
         WHERE m.loser_id = ? AND m.status != 'cancelled'
         GROUP BY f_l.id, f_w.id`,
        [playerId]
      );

      // Merge wins and losses by faction pairing
      const factionMap = new Map<string, { faction_id: string; opponent_faction_id: string; wins: number; losses: number }>();

      for (const row of factionWinResult.rows) {
        const key = `${row.faction_id}|${row.opponent_faction_id}`;
        factionMap.set(key, { faction_id: row.faction_id, opponent_faction_id: row.opponent_faction_id, wins: parseInt(row.wins) || 0, losses: 0 });
      }
      for (const row of factionLossResult.rows) {
        const key = `${row.faction_id}|${row.opponent_faction_id}`;
        const existing = factionMap.get(key);
        if (existing) {
          existing.losses += parseInt(row.losses) || 0;
        } else {
          factionMap.set(key, { faction_id: row.faction_id, opponent_faction_id: row.opponent_faction_id, wins: 0, losses: parseInt(row.losses) || 0 });
        }
      }

      for (const stats of factionMap.values()) {
        const total  = stats.wins + stats.losses;
        const winrate = total > 0 ? (stats.wins / total) * 100 : 0;

        await query(
          `INSERT INTO player_match_statistics
           (id, player_id, opponent_id, map_id, faction_id, opponent_faction_id,
            total_games, wins, losses, winrate, avg_elo_change)
           VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, 0)`,
          [randomUUID(), playerId, stats.faction_id, stats.opponent_faction_id,
           total, stats.wins, stats.losses, Math.round(winrate * 100) / 100]
        );
        recordsUpdated++;
      }
    }

    return { records_updated: recordsUpdated };
  } catch (error) {
    console.error('Error recalculating player match statistics:', error);
    throw error;
  }
}

/**
 * Recalculate all faction/map statistics
 */
export async function recalculateFactionMapStatistics(): Promise<{ records_updated: number }> {
  try {
    // Truncate the stats table
    await query('TRUNCATE TABLE faction_map_statistics');

    // Get all faction/map combinations from matches
    const statsResult = await query(
      `SELECT
         gm.id as map_id,
         f_w.id as faction_id,
         f_l.id as opponent_faction_id,
         COUNT(*) as total_games,
         SUM(CASE WHEN 1=1 THEN 1 ELSE 0 END) as wins,
         0 as losses
       FROM matches m
       JOIN game_maps gm ON gm.name = m.map
       JOIN factions f_w ON f_w.name = m.winner_faction
       JOIN factions f_l ON f_l.name = m.loser_faction
       WHERE m.status != 'cancelled'
       GROUP BY gm.id, f_w.id, f_l.id
       
       UNION ALL
       
       SELECT
         gm.id as map_id,
         f_l.id as faction_id,
         f_w.id as opponent_faction_id,
         COUNT(*) as total_games,
         0 as wins,
         SUM(CASE WHEN 1=1 THEN 1 ELSE 0 END) as losses
       FROM matches m
       JOIN game_maps gm ON gm.name = m.map
       JOIN factions f_w ON f_w.name = m.winner_faction
       JOIN factions f_l ON f_l.name = m.loser_faction
       WHERE m.status != 'cancelled'
       GROUP BY gm.id, f_l.id, f_w.id`
    );

    // Aggregate by map/faction/opponent_faction
    const aggregated = new Map<string, any>();

    for (const row of statsResult.rows) {
      const key = `${row.map_id}|${row.faction_id}|${row.opponent_faction_id}`;
      const existing = aggregated.get(key);

      if (existing) {
        existing.total_games += row.total_games;
        existing.wins += row.wins;
        existing.losses += row.losses;
      } else {
        aggregated.set(key, {
          map_id: row.map_id,
          faction_id: row.faction_id,
          opponent_faction_id: row.opponent_faction_id,
          total_games: row.total_games,
          wins: row.wins,
          losses: row.losses
        });
      }
    }

    // Insert with calculated winrate
    let recordsInserted = 0;
    
    // Import randomUUID for ID generation
    const { randomUUID } = await import('crypto');
    
    for (const stats of aggregated.values()) {
      stats.winrate = stats.total_games > 0 ? (stats.wins / stats.total_games) * 100 : 0;

      await query(
        `INSERT INTO faction_map_statistics
         (id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), stats.map_id, stats.faction_id, stats.opponent_faction_id, stats.total_games,
         stats.wins, stats.losses, Math.round(stats.winrate * 100) / 100]
      );
      recordsInserted++;
    }

    return { records_updated: recordsInserted };
  } catch (error) {
    console.error('Error recalculating faction/map statistics:', error);
    throw error;
  }
}

/**
 * Update faction/map statistics for a single match
 */
export async function updateFactionMapStatistics(
  map: string,
  winnerFaction: string,
  loserFaction: string
): Promise<boolean> {
  try {
    // Import randomUUID for ID generation
    const { randomUUID } = await import('crypto');
    
    // Get map and faction IDs
    const mapResult = await query('SELECT id FROM game_maps WHERE name = ?', [map]);
    const winnerFactionResult = await query('SELECT id FROM factions WHERE name = ?', [winnerFaction]);
    const loserFactionResult = await query('SELECT id FROM factions WHERE name = ?', [loserFaction]);

    if (mapResult.rows.length === 0 || winnerFactionResult.rows.length === 0 || loserFactionResult.rows.length === 0) {
      return false;
    }

    const mapId = mapResult.rows[0].id;
    const winnerFactionId = winnerFactionResult.rows[0].id;
    const loserFactionId = loserFactionResult.rows[0].id;

    // Update winner stats (need to use INSERT + UPDATE since MariaDB doesn't support ON CONFLICT)
    try {
      await query(
        `INSERT INTO faction_map_statistics
         (id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
         VALUES (?, ?, ?, ?, 1, 1, 0, 100.00)`,
        [randomUUID(), mapId, winnerFactionId, loserFactionId]
      );
    } catch (e) {
      // Record exists, update it
      await query(
        `UPDATE faction_map_statistics
         SET total_games = total_games + 1,
             wins = wins + 1,
             winrate = ROUND(100.0 * (wins + 1) / (total_games + 1), 2)
         WHERE map_id = ? AND faction_id = ? AND opponent_faction_id = ?`,
        [mapId, winnerFactionId, loserFactionId]
      );
    }

    // Update loser stats
    try {
      await query(
        `INSERT INTO faction_map_statistics
         (id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
         VALUES (?, ?, ?, ?, 1, 0, 1, 0.00)`,
        [randomUUID(), mapId, loserFactionId, winnerFactionId]
      );
    } catch (e) {
      // Record exists, update it
      await query(
        `UPDATE faction_map_statistics
         SET total_games = total_games + 1,
             losses = losses + 1,
             winrate = ROUND(100.0 * wins / (total_games + 1), 2)
         WHERE map_id = ? AND faction_id = ? AND opponent_faction_id = ?`,
        [mapId, loserFactionId, winnerFactionId]
      );
    }

    return true;
  } catch (error) {
    console.error('Error updating faction/map statistics:', error);
    return false;
  }
}

/**
 * Get balance statistics snapshot for a specific date
 */
export async function getBalanceStatisticsSnapshot(
  snapshotDate: Date
): Promise<BalanceEventSnapshot[]> {
  try {
    const dateStr = snapshotDate.toISOString().split('T')[0];

    const result = await query(
      `SELECT
        snapshot_date,
        map_id,
        faction_id,
        opponent_faction_id,
        total_games,
        wins,
        losses,
        winrate,
        sample_size_category,
        confidence_level
       FROM faction_map_statistics_history
       WHERE snapshot_date = ?`,
      [dateStr]
    );

    return result.rows as BalanceEventSnapshot[];
  } catch (error) {
    console.error('Error getting balance statistics snapshot:', error);
    throw error;
  }
}

/**
 * Recalculate all match statistics (calls recalculatePlayerMatchStatistics + recalculateFactionMapStatistics)
 */
export async function recalculateAllMatchStatistics(): Promise<{
  player_records: number;
  faction_map_records: number;
}> {
  try {
    const playerResult = await recalculatePlayerMatchStatistics();
    const factionResult = await recalculateFactionMapStatistics();

    return {
      player_records: playerResult.records_updated,
      faction_map_records: factionResult.records_updated
    };
  } catch (error) {
    console.error('Error recalculating all match statistics:', error);
    throw error;
  }
}

/**
 * Update player ELO in ranking tables after match
 */
export async function updatePlayerElo(
  playerId: string,
  eloChange: number,
  newElo: number
): Promise<boolean> {
  try {
    await query(
      `UPDATE player_rankings
       SET current_elo = ?,
           elo_change = elo_change + ?,
           last_elo_update = CURRENT_TIMESTAMP
       WHERE player_id = ?`,
      [newElo, eloChange, playerId]
    );

    return true;
  } catch (error) {
    console.error('Error updating player ELO:', error);
    return false;
  }
}

/**
 * Update player faction statistics
 */
export async function updatePlayerFactionStats(
  playerId: string,
  factionId: string,
  isWin: boolean
): Promise<boolean> {
  try {
    if (isWin) {
      await query(
        `UPDATE player_faction_statistics
         SET games_played = games_played + 1,
             games_won = games_won + 1,
             winrate = ROUND(100.0 * (games_won + 1) / (games_played + 1), 2)
         WHERE player_id = ? AND faction_id = ?`,
        [playerId, factionId]
      );
    } else {
      await query(
        `UPDATE player_faction_statistics
         SET games_played = games_played + 1,
             games_lost = games_lost + 1,
             winrate = ROUND(100.0 * games_won / (games_played + 1), 2)
         WHERE player_id = ? AND faction_id = ?`,
        [playerId, factionId]
      );
    }

    return true;
  } catch (error) {
    console.error('Error updating player faction statistics:', error);
    return false;
  }
}

/**
 * Calculate faction winrates for a specific map
 */
export async function calculateFactionWinrates(
  mapId: string
): Promise<Map<string, number>> {
  try {
    const result = await query(
      `SELECT
        faction_id,
        winrate
       FROM faction_map_statistics
       WHERE map_id = ?
       ORDER BY faction_id`,
      [mapId]
    );

    const winrates = new Map<string, number>();
    for (const row of result.rows) {
      winrates.set(row.faction_id, row.winrate);
    }

    return winrates;
  } catch (error) {
    console.error('Error calculating faction winrates:', error);
    throw error;
  }
}

/**
 * Update league rankings after tournament completion
 */
export async function updateLeagueRankings(
  tournamentId: string
): Promise<number> {
  try {
    // Get finishing positions from tournament_participants
    const rankingsResult = await query(
      `SELECT
        rank() OVER (ORDER BY
          tournament_wins DESC,
          tournament_losses ASC,
          tournament_omp DESC,
          tournament_gwp DESC,
          tournament_ogp DESC
        ) as final_rank,
        user_id
       FROM tournament_participants
       WHERE tournament_id = ?`,
      [tournamentId]
    );

    let updatedCount = 0;

    for (const row of rankingsResult.rows) {
      // Update player rankings table
      await query(
        `UPDATE player_rankings
         SET league_rank = CASE WHEN ? <= 10 THEN ? ELSE NULL END,
             last_rank_update = CURRENT_TIMESTAMP
         WHERE player_id = ?`,
        [row.final_rank, row.user_id]
      );
      updatedCount++;
    }

    return updatedCount;
  } catch (error) {
    console.error('Error updating league rankings:', error);
    throw error;
  }
}

/**
 * Get tournament statistics snapshot
 */
export async function getTournamentSnapshot(
  tournamentId: string
): Promise<{
  tournament_id: string;
  total_matches: number;
  total_games: number;
  avg_games_per_match: number;
  total_participants: number;
  final_date: Date;
}> {
  try {
    const result = await query(
      `SELECT
        ? as tournament_id,
        COUNT(DISTINCT tm.id) as total_matches,
        SUM(tm.player1_wins + tm.player2_wins) as total_games,
        ROUND(AVG(tm.player1_wins + tm.player2_wins), 2) as avg_games_per_match,
        COUNT(DISTINCT tp.user_id) as total_participants,
        MAX(tm.completed_at) as final_date
       FROM tournament_round_matches tm
       LEFT JOIN tournament_participants tp ON tp.tournament_id = ?
       WHERE tm.tournament_id = ?
       AND tm.series_status = 'completed'`,
      [tournamentId]
    );

    if (result.rows.length === 0) {
      throw new Error('Tournament not found');
    }

    return result.rows[0] as any;
  } catch (error) {
    console.error('Error getting tournament snapshot:', error);
    throw error;
  }
}

/**
 * Create balance event after snapshot
 */
export async function createBalanceEventAfterSnapshot(
  eventId: string
): Promise<number> {
  try {
    // Find the event
    const eventResult = await query(
      'SELECT event_date FROM balance_events WHERE id = ?',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      throw new Error('Balance event not found');
    }

    const { randomUUID } = await import('crypto');
    const eventDate = new Date(eventResult.rows[0].event_date);
    const afterDate = new Date(eventDate);
    afterDate.setDate(afterDate.getDate() + 1); // One day after
    const dateStr = afterDate.toISOString().split('T')[0];

    // Check if snapshot already exists for this date
    const existingResult = await query(
      `SELECT COUNT(*) as count FROM faction_map_statistics_history WHERE snapshot_date = ?`,
      [dateStr]
    );
    
    if (existingResult.rows[0].count > 0) {
      // Snapshot already exists, skip and just update the after_date
      await query(
        `UPDATE balance_events
         SET snapshot_after_date = ?
         WHERE id = ?`,
        [dateStr, eventId]
      );
      return 0;
    }

    const result = await query(
      `INSERT INTO faction_map_statistics_history (
        id,
        snapshot_date,
        snapshot_timestamp,
        map_id,
        faction_id,
        opponent_faction_id,
        total_games,
        wins,
        losses,
        winrate,
        sample_size_category,
        confidence_level
      )
      SELECT
        UUID(),
        ?,
        CURRENT_TIMESTAMP,
        fms.map_id,
        fms.faction_id,
        fms.opponent_faction_id,
        fms.total_games,
        fms.wins,
        fms.losses,
        fms.winrate,
        CASE
          WHEN fms.total_games < 10 THEN 'small'
          WHEN fms.total_games < 50 THEN 'medium'
          ELSE 'large'
        END,
        CASE
          WHEN fms.total_games < 10 THEN 25.0
          WHEN fms.total_games < 30 THEN 50.0
          WHEN fms.total_games < 50 THEN 75.0
          ELSE 95.0
        END
      FROM faction_map_statistics fms
      WHERE fms.total_games > 0`,
      [dateStr]
    );

    // Update balance_events to record snapshot date
    await query(
      `UPDATE balance_events
       SET snapshot_after_date = ?
       WHERE id = ?`,
      [afterDate.toISOString().split('T')[0], eventId]
    );

    return result.rowCount || 0;
  } catch (error) {
    console.error('Error creating balance event after snapshot:', error);
    throw error;
  }
}

/**
 * Get balance event forward impact (looking ahead from patch date)
 */
export async function getBalanceEventForwardImpact(
  eventId: string,
  daysAfter: number = 60
): Promise<BalanceEventImpact[]> {
  try {
    // Get event details
    const eventResult = await query(
      'SELECT event_date FROM balance_events WHERE id = ?',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return [];
    }

    const eventDate = new Date(eventResult.rows[0].event_date);
    const afterDate = new Date(eventDate);
    afterDate.setDate(afterDate.getDate() + daysAfter);

    const result = await query(
      `SELECT
        COALESCE(gm.id, '') as map_id,
        COALESCE(gm.name, '') as map_name,
        COALESCE(f1.id, '') as faction_id,
        COALESCE(f1.name, '') as faction_name,
        COALESCE(f2.id, '') as opponent_faction_id,
        COALESCE(f2.name, '') as opponent_faction_name,
        0 as winrate_before,
        COALESCE(AVG(fmsh.winrate), 0) as winrate_after,
        COALESCE(AVG(fmsh.winrate), 0) as winrate_change,
        0 as sample_size_before,
        COUNT(DISTINCT fmsh.map_id) as sample_size_after,
        0 as games_before,
        COALESCE(SUM(fmsh.total_games), 0) as games_after
      FROM faction_map_statistics_history fmsh
      LEFT JOIN game_maps gm ON gm.id = fmsh.map_id
      LEFT JOIN factions f1 ON f1.id = fmsh.faction_id
      LEFT JOIN factions f2 ON f2.id = fmsh.opponent_faction_id
      WHERE fmsh.snapshot_date BETWEEN ? AND ?
      GROUP BY gm.id, gm.name, f1.id, f1.name, f2.id, f2.name`,
      [eventDate.toISOString().split('T')[0], afterDate.toISOString().split('T')[0]]
    );

    return result.rows as BalanceEventImpact[];
  } catch (error) {
    console.error('Error getting balance event forward impact:', error);
    throw error;
  }
}

/**
 * Recalculate balance event snapshots and impacts
 */
export async function recalculateBalanceEventSnapshots(): Promise<{
  balance_events_updated: number;
  snapshots_created: number;
}> {
  try {
    // Get all balance events without snapshots
    const eventsResult = await query(
      `SELECT id FROM balance_events
       WHERE snapshot_before_date IS NULL OR snapshot_after_date IS NULL`
    );

    let eventsUpdated = 0;
    let snapshotsCreated = 0;

    for (const event of eventsResult.rows) {
      try {
        if (!event.snapshot_before_date) {
          const beforeCount = await createBalanceEventBeforeSnapshot(event.id);
          snapshotsCreated += beforeCount;
        }
        if (!event.snapshot_after_date) {
          const afterCount = await createBalanceEventAfterSnapshot(event.id);
          snapshotsCreated += afterCount;
        }
        eventsUpdated++;
      } catch (e) {
        console.error(`Error processing balance event ${event.id}:`, e);
      }
    }

    return {
      balance_events_updated: eventsUpdated,
      snapshots_created: snapshotsCreated
    };
  } catch (error) {
    console.error('Error recalculating balance event snapshots:', error);
    throw error;
  }
}
/**
 * CRITICAL: Recalculate player ELO from match records
 * Takes the FINAL ELO from the last non-cancelled match for each player
 * Updates users_extension with correct ELO, ranking, and level
 */
export async function recalculatePlayerEloSequential(): Promise<{
  players_updated: number;
  total_matches_processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let playersUpdated = 0;

  try {
    // Get all unique players from non-cancelled matches
    const playersResult = await query(
      `SELECT DISTINCT winner_id as player_id FROM matches
       WHERE status != 'cancelled'
       UNION
       SELECT DISTINCT loser_id FROM matches
       WHERE status != 'cancelled'`
    );

    const totalMatches = await query(
      `SELECT COUNT(*) as count FROM matches
       WHERE status != 'cancelled'`
    );

    // For each player, get their final ELO and stats from their matches
    for (const player of playersResult.rows) {
      const playerId = player.player_id;
      
      try {
        // Get all stats for this player from their matches (non-cancelled only)
        const statsResult = await query(
          `SELECT
             COUNT(CASE WHEN winner_id = ? THEN 1 END) as wins,
             COUNT(CASE WHEN loser_id = ? THEN 1 END) as losses,
             MAX(CASE WHEN winner_id = ? THEN winner_elo_after ELSE NULL END) as final_elo_as_winner,
             MAX(CASE WHEN loser_id = ? THEN loser_elo_after ELSE NULL END) as final_elo_as_loser
           FROM matches
           WHERE (winner_id = ? OR loser_id = ?)
           AND status != 'cancelled'`,
          [playerId, playerId, playerId, playerId, playerId, playerId]
        );

        const stats = statsResult.rows[0];
        const wins = stats.wins || 0;
        const losses = stats.losses || 0;
        const matchesPlayed = wins + losses;

        // Get final ELO (use the most recent match ELO)
        const finalElo = stats.final_elo_as_winner || stats.final_elo_as_loser || 1400;

        // Determine if player should be rated (10+ matches and ELO >= 1400)
        const isRated = matchesPlayed >= 10 && finalElo >= 1400 ? 1 : 0;

        // Calculate level based on ELO
        let level = 'Novato';
        if (finalElo >= 1600) level = 'Experto';
        else if (finalElo >= 1500) level = 'Avanzado';
        else if (finalElo >= 1450) level = 'Iniciado';

        // Get previous ELO for trend calculation
        const prevEloResult = await query(
          `SELECT elo_rating FROM users_extension WHERE id = ?`,
          [playerId]
        );

        const prevElo = prevEloResult.rows[0]?.elo_rating || 1400;
        const trend = finalElo > prevElo ? 1 : (finalElo < prevElo ? -1 : 0);

        // Update users_extension
        await query(
          `UPDATE users_extension
           SET elo_rating = ?,
               matches_played = ?,
               total_wins = ?,
               total_losses = ?,
               is_rated = ?,
               level = ?,
               trend = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [finalElo, matchesPlayed, wins, losses, isRated, level, trend, playerId]
        );

        playersUpdated++;
      } catch (e) {
        const msg = `Error updating player ${playerId}: ${e instanceof Error ? e.message : String(e)}`;
        errors.push(msg);
        console.error(msg);
      }
    }

    return {
      players_updated: playersUpdated,
      total_matches_processed: totalMatches.rows[0]?.count || 0,
      errors
    };
  } catch (error) {
    const msg = `Error in recalculatePlayerEloSequential: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(msg);
    console.error(msg);
    throw error;
  }
}

export default {
  calculateLeagueTiebreakers,
  calculateSwissTiebreakers,
  calculateTeamSwissTiebreakers,
  checkTeamMemberCount,
  checkTeamMemberPositions,
  createBalanceEventBeforeSnapshot,
  createFactionMapStatisticsSnapshot,
  getBalanceEventImpact,
  getBalanceTrend,
  manageFactionMapStatisticsSnapshots,
  recalculatePlayerMatchStatistics,
  recalculateFactionMapStatistics,
  updateFactionMapStatistics,
  getBalanceStatisticsSnapshot,
  recalculateAllMatchStatistics,
  updatePlayerElo,
  updatePlayerFactionStats,
  calculateFactionWinrates,
  updateLeagueRankings,
  getTournamentSnapshot,
  createBalanceEventAfterSnapshot,
  getBalanceEventForwardImpact,
  recalculateBalanceEventSnapshots,
  recalculatePlayerEloSequential
};
