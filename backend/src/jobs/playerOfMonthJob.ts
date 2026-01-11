import { query } from '../config/database.js';

/**
 * Calculate and update player of the month
 * Should run once at the beginning of each month (01:30 on the 1st)
 * Calculates for the PREVIOUS month (e.g., on Feb 1st, calculates for January)
 */
export const calculatePlayerOfMonth = async (): Promise<void> => {
  try {
    console.log('🎯 Calculating player of the month for previous month...');

    const now = new Date();
    // Get the first day of the previous month
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month

    // Calculate the player who gained the most ELO in the previous month
    const playerOfMonthResult = await query(
      `WITH elo_gains AS (
        SELECT 
          u.id,
          u.nickname,
          u.elo_rating,
          COALESCE(SUM(CASE WHEN m.winner_id = u.id THEN m.winner_elo_after - m.winner_elo_before 
                           WHEN m.loser_id = u.id THEN m.loser_elo_after - m.loser_elo_before 
                           ELSE 0 END), 0) as elo_gained
        FROM users u
        LEFT JOIN matches m ON (m.winner_id = u.id OR m.loser_id = u.id) 
          AND m.status = 'confirmed' 
          AND m.created_at >= $1
          AND m.created_at < $2
        WHERE u.is_active = true 
          AND u.is_blocked = false
          AND u.is_rated = true
        GROUP BY u.id, u.nickname, u.elo_rating
        ORDER BY elo_gained DESC
        LIMIT 1
      )
      SELECT * FROM elo_gains`,
      [prevMonthStart, prevMonthEnd]
    );

    if (playerOfMonthResult.rows.length === 0) {
      console.log('⚠️  No eligible players found for this month');
      return;
    }

    const player = playerOfMonthResult.rows[0];
    const playerId = player.id;

    // Get current ranking position
    const rankingResult = await query(
      `SELECT COUNT(*) + 1 as ranking_position
       FROM users u2
       WHERE u2.is_active = true 
         AND u2.is_blocked = false
         AND u2.is_rated = true
         AND u2.elo_rating >= 1400
         AND (u2.elo_rating > $1 OR (u2.elo_rating = $1 AND u2.id < $2))`,
      [player.elo_rating, playerId]
    );

    const rankingPosition = rankingResult.rows[0]?.ranking_position || 1;

    // Get ranking position at start of previous month to calculate positions gained
    const startOfMonthEloResult = await query(
      `SELECT CASE 
         WHEN m.winner_id = $1 THEN m.winner_elo_before
         ELSE m.loser_elo_before
       END as elo_at_month_start
       FROM matches m
       WHERE (m.winner_id = $1 OR m.loser_id = $1)
         AND m.status = 'confirmed'
         AND m.created_at >= $2
         AND m.created_at < $3
       ORDER BY m.created_at ASC
       LIMIT 1`,
      [playerId, prevMonthStart, prevMonthEnd]
    );

    let positionsGained = 0;
    if (startOfMonthEloResult.rows.length > 0) {
      const eloAtMonthStart = startOfMonthEloResult.rows[0].elo_at_month_start;
      
      // Count ranking at start of month
      const rankAtStartResult = await query(
        `SELECT COUNT(*) + 1 as rank_at_start
         FROM users u2
         WHERE u2.is_active = true 
           AND u2.is_blocked = false
           AND u2.is_rated = true
           AND u2.elo_rating >= 1400
           AND (u2.elo_rating > $1 OR (u2.elo_rating = $1 AND u2.id < $2))`,
        [eloAtMonthStart, playerId]
      );

      const rankAtStart = rankAtStartResult.rows[0]?.rank_at_start || 1;
      positionsGained = rankAtStart - rankingPosition;
    }

    // Delete previous month's record and insert new one
    // Store the month_year as the first day of the PREVIOUS month
    
    await query(
      `DELETE FROM player_of_month WHERE month_year = $1`,
      [prevMonthStart]
    );

    await query(
      `INSERT INTO player_of_month (player_id, nickname, elo_rating, ranking_position, elo_gained, positions_gained, month_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [playerId, player.nickname, player.elo_rating, rankingPosition, Math.round(player.elo_gained), positionsGained, prevMonthStart]
    );

    console.log(`✅ Player of month calculated: ${player.nickname} (ELO gained: +${Math.round(player.elo_gained)}, Positions: ${positionsGained >= 0 ? '+' : ''}${positionsGained})`);
  } catch (error) {
    console.error('❌ Error calculating player of month:', error);
    throw error;
  }
};
