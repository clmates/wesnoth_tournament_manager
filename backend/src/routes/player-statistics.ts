import { Router } from 'express';
import { query } from '../config/database.js';

const router = Router();

/**
 * Get global player statistics
 * Returns overall winrate, ELO change, games played
 */
router.get('/player/:playerId/global', async (req, res) => {
  try {
    const { playerId } = req.params;
    
    const result = await query(
      `SELECT 
        pms.player_id,
        u.nickname as player_name,
        pms.total_games,
        pms.wins,
        pms.losses,
        pms.winrate,
        pms.avg_elo_change,
        pms.last_updated
      FROM player_match_statistics pms
      JOIN users_extension u ON pms.player_id = u.id
      WHERE pms.player_id = $1
      AND pms.opponent_id IS NULL
      AND pms.map_id IS NULL
      AND pms.faction_id IS NULL`,
      [playerId]
    );
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching player global statistics:', error);
    res.status(500).json({ error: 'Failed to fetch player statistics' });
  }
});

/**
 * Get player statistics by map
 * Shows how a player performs on each map
 */
router.get('/player/:playerId/by-map', async (req, res) => {
  try {
    const { playerId } = req.params;
    const minGames = parseInt(req.query.minGames as string) || 2;
    
    console.log('Fetching by-map stats for player:', playerId, 'minGames:', minGames);
    
    const result = await query(
      `SELECT 
        gm.id as map_id,
        gm.name as map_name,
        pms.total_games,
        pms.wins,
        pms.losses,
        pms.winrate,
        pms.avg_elo_change
      FROM player_match_statistics pms
      JOIN game_maps gm ON pms.map_id = gm.id
      WHERE pms.player_id = $1
      AND pms.opponent_id IS NULL
      AND pms.map_id IS NOT NULL
      AND pms.faction_id IS NULL
      AND pms.total_games >= $2
      ORDER BY pms.winrate DESC`,
      [playerId, minGames]
    );
    console.log('By-map result rows:', result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching player map statistics:', error);
    res.status(500).json({ error: 'Failed to fetch player map statistics' });
  }
});

/**
 * Get player statistics by faction
 * Shows how a player performs with each faction
 */
router.get('/player/:playerId/by-faction', async (req, res) => {
  try {
    const { playerId } = req.params;
    const minGames = parseInt(req.query.minGames as string) || 2;
    
    console.log('Fetching by-faction stats for player:', playerId, 'minGames:', minGames);
    
    const result = await query(
      `SELECT 
        f.id as faction_id,
        f.name as faction_name,
        pms.total_games,
        pms.wins,
        pms.losses,
        pms.winrate,
        pms.avg_elo_change
      FROM player_match_statistics pms
      JOIN factions f ON pms.faction_id = f.id
      WHERE pms.player_id = $1
      AND pms.opponent_id IS NULL
      AND pms.map_id IS NULL
      AND pms.faction_id IS NOT NULL
      AND pms.total_games >= $2
      ORDER BY pms.winrate DESC`,
      [playerId, minGames]
    );
    console.log('By-faction result rows:', result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching player faction statistics:', error);
    res.status(500).json({ error: 'Failed to fetch player faction statistics' });
  }
});

/**
 * Get player head-to-head statistics vs a specific opponent
 */
router.get('/player/:playerId/vs-player/:opponentId', async (req, res) => {
  try {
    const { playerId, opponentId } = req.params;
    
    const result = await query(
      `SELECT 
        pms.player_id,
        u1.nickname as player_name,
        pms.opponent_id,
        u2.nickname as opponent_name,
        pms.total_games,
        pms.wins,
        pms.losses,
        pms.winrate,
        pms.avg_elo_change,
        COUNT(DISTINCT gm.id) as maps_played
      FROM player_match_statistics pms
      JOIN users_extension u1 ON pms.player_id = u1.id
      JOIN users_extension u2 ON pms.opponent_id = u2.id
      LEFT JOIN game_maps gm ON pms.map_id = gm.id
      WHERE pms.player_id = $1
      AND pms.opponent_id = $2
      AND pms.map_id IS NULL
      AND pms.faction_id IS NULL
      GROUP BY pms.player_id, u1.nickname, pms.opponent_id, u2.nickname, pms.total_games, pms.wins, pms.losses, pms.winrate, pms.avg_elo_change`,
      [playerId, opponentId]
    );
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching head-to-head statistics:', error);
    res.status(500).json({ error: 'Failed to fetch head-to-head statistics' });
  }
});

/**
 * Get player statistics on a specific map
 */
router.get('/player/:playerId/map/:mapId', async (req, res) => {
  try {
    const { playerId, mapId } = req.params;
    
    const result = await query(
      `SELECT 
        gm.id as map_id,
        gm.name as map_name,
        pms.total_games,
        pms.wins,
        pms.losses,
        pms.winrate,
        pms.avg_elo_change,
        COUNT(DISTINCT f.id) as factions_used
      FROM player_match_statistics pms
      JOIN game_maps gm ON pms.map_id = gm.id
      LEFT JOIN factions f ON pms.faction_id = f.id AND pms.map_id = gm.id
      WHERE pms.player_id = $1
      AND pms.map_id = $2
      AND pms.opponent_id IS NULL
      AND pms.faction_id IS NULL
      GROUP BY gm.id, gm.name, pms.total_games, pms.wins, pms.losses, pms.winrate, pms.avg_elo_change`,
      [playerId, mapId]
    );
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching player map statistics:', error);
    res.status(500).json({ error: 'Failed to fetch player map statistics' });
  }
});

/**
 * Get player statistics with a specific faction
 */
router.get('/player/:playerId/faction/:factionId', async (req, res) => {
  try {
    const { playerId, factionId } = req.params;
    
    const result = await query(
      `SELECT 
        f.id as faction_id,
        f.name as faction_name,
        pms.total_games,
        pms.wins,
        pms.losses,
        pms.winrate,
        pms.avg_elo_change,
        COUNT(DISTINCT gm.id) as maps_used
      FROM player_match_statistics pms
      JOIN factions f ON pms.faction_id = f.id
      LEFT JOIN game_maps gm ON pms.map_id = gm.id AND pms.faction_id = f.id
      WHERE pms.player_id = $1
      AND pms.faction_id = $2
      AND pms.opponent_id IS NULL
      AND pms.map_id IS NULL
      GROUP BY f.id, f.name, pms.total_games, pms.wins, pms.losses, pms.winrate, pms.avg_elo_change`,
      [playerId, factionId]
    );
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching player faction statistics:', error);
    res.status(500).json({ error: 'Failed to fetch player faction statistics' });
  }
});

/**
 * Get player statistics with a specific faction on a specific map
 */
router.get('/player/:playerId/map/:mapId/faction/:factionId', async (req, res) => {
  try {
    const { playerId, mapId, factionId } = req.params;
    
    const result = await query(
      `SELECT 
        gm.id as map_id,
        gm.name as map_name,
        f.id as faction_id,
        f.name as faction_name,
        pms.total_games,
        pms.wins,
        pms.losses,
        pms.winrate,
        pms.avg_elo_change
      FROM player_match_statistics pms
      JOIN game_maps gm ON pms.map_id = gm.id
      JOIN factions f ON pms.faction_id = f.id
      WHERE pms.player_id = $1
      AND pms.map_id = $2
      AND pms.faction_id = $3
      AND pms.opponent_id IS NULL`,
      [playerId, mapId, factionId]
    );
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('Error fetching player map-faction statistics:', error);
    res.status(500).json({ error: 'Failed to fetch player map-faction statistics' });
  }
});

/**
 * Get recent opponents and head-to-head records
 */
router.get('/player/:playerId/recent-opponents', async (req, res) => {
  try {
    const { playerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    console.log('Fetching recent opponents for player:', playerId, 'limit:', limit);
    
    // Get opponents from pre-calculated aggregated h2h records (map_id and faction_id NULL)
    // These are pre-calculated during statistics recalculation for O(1) query performance
    const result = await query(
      `SELECT
        pms.opponent_id,
        u.nickname as opponent_name,
        u.elo_rating as current_elo,
        pms.total_games,
        pms.wins,
        pms.losses,
        pms.winrate,
        CAST(COALESCE(pms.elo_gained, 0) AS DECIMAL(8,2)) as elo_gained,
        CAST(COALESCE(pms.elo_lost, 0) AS DECIMAL(8,2)) as elo_lost,
        CAST(pms.last_match_date AS CHAR) as last_match_date,
        pms.last_elo_against_me
      FROM player_match_statistics pms
      JOIN users_extension u ON pms.opponent_id = u.id
      WHERE pms.player_id = $1
      AND pms.opponent_id IS NOT NULL
      AND pms.map_id IS NULL
      AND pms.faction_id IS NULL
      AND pms.opponent_faction_id IS NULL
      ORDER BY pms.last_match_date DESC NULLS LAST
      LIMIT $2`,
      [playerId, limit]
    );
    console.log('Recent opponents result rows:', result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent opponents:', error);
    res.status(500).json({ error: 'Failed to fetch recent opponents' });
  }
});

export default router;
