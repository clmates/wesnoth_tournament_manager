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
       WHERE tp.tournament_id = $1
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
         WHERE tp.tournament_id = $1 AND tp.user_id = $2`,
        [tournamentId, userId]
      );
      const totalPoints = pointsResult.rows[0]?.total_points || 0;

      // 2. OMP (Opponent Match Points) = Average wins of all opponents faced
      const ompResult = await query(
        `SELECT COALESCE(AVG(COALESCE(tp.tournament_wins, 0)), 0)::DECIMAL(8,2) as omp
         FROM (
           SELECT DISTINCT
             CASE 
               WHEN tm.player1_id = $1 THEN tm.player2_id
               ELSE tm.player1_id
             END as opponent_id
           FROM tournament_round_matches tm
           WHERE tm.tournament_id = $2
             AND (tm.player1_id = $1 OR tm.player2_id = $1)
             AND tm.series_status = 'completed'
         ) opponents
         LEFT JOIN tournament_participants tp ON tp.tournament_id = $2 
           AND tp.user_id = opponents.opponent_id`,
        [userId, tournamentId]
      );
      const omp = parseFloat(ompResult.rows[0]?.omp || 0);

      // 3. GWP (Game Win Percentage) = (games won / total games) * 100
      const gwpResult = await query(
        `SELECT 
           COALESCE(SUM(CASE WHEN tm.player1_id = $1 THEN tm.player1_wins ELSE tm.player2_wins END), 0) as games_won,
           COALESCE(SUM(CASE WHEN tm.player1_id = $1 THEN tm.player2_wins ELSE tm.player1_wins END), 0) as games_lost
         FROM tournament_round_matches tm
         WHERE tm.tournament_id = $2
           AND (tm.player1_id = $1 OR tm.player2_id = $1)
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
             THEN (opp_wins::DECIMAL / (opp_wins + opp_losses) * 100)
             ELSE 0
           END
         ), 0)::DECIMAL(5,2) as ogp
         FROM (
           SELECT DISTINCT
             CASE 
               WHEN tm.player1_id = $1 THEN tm.player2_id
               ELSE tm.player1_id
             END as opponent_id,
             CASE 
               WHEN tm.player1_id = $1 THEN tm.player2_wins
               ELSE tm.player1_wins
             END as opp_wins,
             CASE 
               WHEN tm.player1_id = $1 THEN tm.player1_wins
               ELSE tm.player2_wins
             END as opp_losses
           FROM tournament_round_matches tm
           WHERE tm.tournament_id = $2
             AND (tm.player1_id = $1 OR tm.player2_id = $1)
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
       WHERE tt.tournament_id = $1
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
         WHERE tt.tournament_id = $1 AND tt.id = $2`,
        [tournamentId, teamId]
      );
      const totalPoints = pointsResult.rows[0]?.total_points || 0;

      // 2. OMP = Average wins of all opponent teams * 3
      const ompResult = await query(
        `SELECT COALESCE(AVG(COALESCE(tt.tournament_wins, 0) * 3), 0)::DECIMAL(8,2) as omp
         FROM (
           SELECT DISTINCT
             CASE 
               WHEN tm.player1_id = $1 THEN tm.player2_id
               ELSE tm.player1_id
             END as opponent_id
           FROM tournament_round_matches tm
           WHERE tm.tournament_id = $2
             AND (tm.player1_id = $1 OR tm.player2_id = $1)
             AND tm.series_status = 'completed'
         ) opponents
         LEFT JOIN tournament_teams tt ON tt.tournament_id = $2 
           AND tt.id = opponents.opponent_id`,
        [teamId, tournamentId]
      );
      const omp = parseFloat(ompResult.rows[0]?.omp || 0);

      // 3. GWP (Game Win Percentage)
      const gwpResult = await query(
        `SELECT 
           COALESCE(SUM(CASE WHEN tm.player1_id = $1 THEN tm.player1_wins ELSE tm.player2_wins END), 0) as games_won,
           COALESCE(SUM(CASE WHEN tm.player1_id = $1 THEN tm.player2_wins ELSE tm.player1_wins END), 0) as games_lost
         FROM tournament_round_matches tm
         WHERE tm.tournament_id = $2
           AND (tm.player1_id = $1 OR tm.player2_id = $1)
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
             THEN (opp_wins::DECIMAL / (opp_wins + opp_losses) * 100)
             ELSE 0
           END
         ), 0)::DECIMAL(5,2) as ogp
         FROM (
           SELECT DISTINCT
             CASE 
               WHEN tm.player1_id = $1 THEN tm.player2_id
               ELSE tm.player1_id
             END as opponent_id,
             CASE 
               WHEN tm.player1_id = $1 THEN tm.player2_wins
               ELSE tm.player1_wins
             END as opp_wins,
             CASE 
               WHEN tm.player1_id = $1 THEN tm.player1_wins
               ELSE tm.player2_wins
             END as opp_losses
           FROM tournament_round_matches tm
           WHERE tm.tournament_id = $2
             AND (tm.player1_id = $1 OR tm.player2_id = $1)
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
       WHERE team_id = $1 AND team_position IS NOT NULL`,
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
       WHERE team_id = $1 
         AND team_position = $2 
         AND user_id != $3`,
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

    const result = await query(
      `INSERT INTO faction_map_statistics_history (
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
        $1::DATE,
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
      WHERE fms.total_games > 0
      ON CONFLICT DO NOTHING`,
      [beforeDate.toISOString().split('T')[0]]
    );

    // Update balance_events to record snapshot date
    await query(
      `UPDATE balance_events
       SET snapshot_before_date = $1
       WHERE id = $2`,
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
    const dateStr = snapshotDate.toISOString().split('T')[0];

    const result = await query(
      `INSERT INTO faction_map_statistics_history (
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
        $1::DATE,
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
      WHERE fms.total_games > 0
      ON CONFLICT DO NOTHING`,
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
      'SELECT snapshot_before_date, event_date FROM balance_events WHERE id = $1',
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
        COALESCE(AVG(CASE WHEN fmsh.snapshot_date < $3 THEN fmsh.winrate ELSE NULL END), 0)::DECIMAL(5,2) as winrate_before,
        COALESCE(AVG(CASE WHEN fmsh.snapshot_date >= $3 THEN fmsh.winrate ELSE NULL END), 0)::DECIMAL(5,2) as winrate_after,
        COALESCE(AVG(CASE WHEN fmsh.snapshot_date >= $3 THEN fmsh.winrate ELSE NULL END), 0)::DECIMAL(6,2) -
          COALESCE(AVG(CASE WHEN fmsh.snapshot_date < $3 THEN fmsh.winrate ELSE NULL END), 0)::DECIMAL(6,2) as winrate_change,
        COUNT(DISTINCT CASE WHEN fmsh.snapshot_date < $3 THEN fmsh.map_id END) as sample_size_before,
        COUNT(DISTINCT CASE WHEN fmsh.snapshot_date >= $3 THEN fmsh.map_id END) as sample_size_after,
        COALESCE(SUM(CASE WHEN fmsh.snapshot_date < $3 THEN fmsh.total_games ELSE 0 END), 0)::INT as games_before,
        COALESCE(SUM(CASE WHEN fmsh.snapshot_date >= $3 THEN fmsh.total_games ELSE 0 END), 0)::INT as games_after
      FROM faction_map_statistics_history fmsh
      LEFT JOIN game_maps gm ON gm.id = fmsh.map_id
      LEFT JOIN factions f1 ON f1.id = fmsh.faction_id
      LEFT JOIN factions f2 ON f2.id = fmsh.opponent_faction_id
      WHERE fmsh.snapshot_date BETWEEN $2 AND $4
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
      WHERE fms.map_id = $1
        AND fms.faction_id = $2
        AND fms.opponent_faction_id = $3
        AND fms.snapshot_date BETWEEN $4 AND $5
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
       WHERE snapshot_date > $1`,
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
 */
export async function recalculatePlayerMatchStatistics(): Promise<{ records_updated: number }> {
  try {
    // Truncate the stats table
    await query('TRUNCATE TABLE player_match_statistics');

    // Get all unique players
    const playersResult = await query(
      `SELECT DISTINCT winner_id as player_id FROM matches
       UNION
       SELECT DISTINCT loser_id FROM matches`
    );

    let recordsUpdated = 0;

    for (const p of playersResult.rows) {
      const playerId = p.player_id;

      // Global stats
      const globalResult = await query(
        `SELECT
           COUNT(CASE WHEN winner_id = ? THEN 1 END) as wins,
           COUNT(CASE WHEN loser_id = ? THEN 1 END) as losses,
           AVG(CASE WHEN winner_id = ? THEN winner_elo_after - winner_elo_before
                    WHEN loser_id = ? THEN loser_elo_after - loser_elo_before END) as avg_elo_change
         FROM matches
         WHERE (winner_id = ? OR loser_id = ?)
         AND NOT (admin_reviewed = true AND status = 'cancelled')`,
        [playerId, playerId, playerId, playerId, playerId, playerId]
      );

      const { wins, losses, avg_elo_change } = globalResult.rows[0];
      const totalGames = wins + losses;
      const winrate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

      await query(
        `INSERT INTO player_match_statistics
         (player_id, opponent_id, map_id, faction_id, opponent_faction_id,
          total_games, wins, losses, winrate, avg_elo_change)
         VALUES (?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?)`,
        [playerId, totalGames, wins, losses, Math.round(winrate * 100) / 100, avg_elo_change || 0]
      );
      recordsUpdated++;
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
       WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
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
       WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
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
       WHERE snapshot_date = $1`,
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
       SET current_elo = $1,
           elo_change = elo_change + $2,
           last_elo_update = CURRENT_TIMESTAMP
       WHERE player_id = $3`,
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
         WHERE player_id = $1 AND faction_id = $2`,
        [playerId, factionId]
      );
    } else {
      await query(
        `UPDATE player_faction_statistics
         SET games_played = games_played + 1,
             games_lost = games_lost + 1,
             winrate = ROUND(100.0 * games_won / (games_played + 1), 2)
         WHERE player_id = $1 AND faction_id = $2`,
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
       WHERE map_id = $1
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
       WHERE tournament_id = $1`,
      [tournamentId]
    );

    let updatedCount = 0;

    for (const row of rankingsResult.rows) {
      // Update player rankings table
      await query(
        `UPDATE player_rankings
         SET league_rank = CASE WHEN $1 <= 10 THEN $1 ELSE NULL END,
             last_rank_update = CURRENT_TIMESTAMP
         WHERE player_id = $2`,
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
        $1 as tournament_id,
        COUNT(DISTINCT tm.id) as total_matches,
        SUM(tm.player1_wins + tm.player2_wins) as total_games,
        ROUND(AVG(tm.player1_wins + tm.player2_wins), 2) as avg_games_per_match,
        COUNT(DISTINCT tp.user_id) as total_participants,
        MAX(tm.completed_at) as final_date
       FROM tournament_round_matches tm
       LEFT JOIN tournament_participants tp ON tp.tournament_id = $1
       WHERE tm.tournament_id = $1
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
      'SELECT event_date FROM balance_events WHERE id = $1',
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      throw new Error('Balance event not found');
    }

    const eventDate = new Date(eventResult.rows[0].event_date);
    const afterDate = new Date(eventDate);
    afterDate.setDate(afterDate.getDate() + 1); // One day after

    const result = await query(
      `INSERT INTO faction_map_statistics_history (
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
        $1::DATE,
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
      [afterDate.toISOString().split('T')[0]]
    );

    // Update balance_events to record snapshot date
    await query(
      `UPDATE balance_events
       SET snapshot_after_date = $1
       WHERE id = $2`,
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
      'SELECT event_date FROM balance_events WHERE id = $1',
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
        COALESCE(AVG(fmsh.winrate), 0)::DECIMAL(5,2) as winrate_after,
        COALESCE(AVG(fmsh.winrate), 0)::DECIMAL(6,2) as winrate_change,
        0 as sample_size_before,
        COUNT(DISTINCT fmsh.map_id) as sample_size_after,
        0 as games_before,
        COALESCE(SUM(fmsh.total_games), 0)::INT as games_after
      FROM faction_map_statistics_history fmsh
      LEFT JOIN game_maps gm ON gm.id = fmsh.map_id
      LEFT JOIN factions f1 ON f1.id = fmsh.faction_id
      LEFT JOIN factions f2 ON f2.id = fmsh.opponent_faction_id
      WHERE fmsh.snapshot_date BETWEEN $1 AND $2
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
  recalculateBalanceEventSnapshots
};
