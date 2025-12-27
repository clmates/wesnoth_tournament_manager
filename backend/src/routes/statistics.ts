import { Router } from 'express';
import { query } from '../config/database.js';

const router = Router();

/**
 * Get faction statistics by map
 * Returns winrates for each faction on each map
 */
router.get('/faction-by-map', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        gm.id as map_id,
        gm.name as map_name,
        f.id as faction_id,
        f.name as faction_name,
        fms.total_games,
        fms.wins,
        fms.losses,
        fms.winrate,
        fms.last_updated
      FROM faction_map_statistics fms
      JOIN game_maps gm ON fms.map_id = gm.id
      JOIN factions f ON fms.faction_id = f.id
      WHERE fms.total_games >= 2
      ORDER BY gm.name, fms.winrate DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching faction statistics by map:', error);
    res.status(500).json({ error: 'Failed to fetch faction statistics' });
  }
});

/**
 * Get matchup statistics (faction A vs faction B)
 * Shows which matchups are most unbalanced
 */
router.get('/matchups', async (req, res) => {
  try {
    const minGames = parseInt(req.query.minGames as string) || 5;
    
    const result = await query(
      `SELECT 
        gm.id as map_id,
        gm.name as map_name,
        f1.id as faction_1_id,
        f1.name as faction_1_name,
        f2.id as faction_2_id,
        f2.name as faction_2_name,
        fms.total_games,
        fms.wins as faction_1_wins,
        fms.losses as faction_2_wins,
        fms.winrate as faction_1_winrate,
        (100 - fms.winrate) as faction_2_winrate,
        ABS(fms.wins - fms.losses) as imbalance,
        fms.last_updated
      FROM faction_map_statistics fms
      JOIN game_maps gm ON fms.map_id = gm.id
      JOIN factions f1 ON fms.faction_id = f1.id
      JOIN factions f2 ON fms.opponent_faction_id = f2.id
      WHERE fms.total_games >= $1
      ORDER BY imbalance DESC, gm.name, fms.faction_id`,
      [minGames]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching matchup statistics:', error);
    res.status(500).json({ error: 'Failed to fetch matchup statistics' });
  }
});

/**
 * Get faction winrates across all maps (global stats)
 * Sums wins from both perspectives (when faction_id is winner or when winning against opponent)
 */
router.get('/faction-global', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        f.id as faction_id,
        f.name as faction_name,
        SUM(fms.total_games) as total_games,
        SUM(fms.wins) as total_wins,
        SUM(fms.losses) as total_losses,
        ROUND(100.0 * SUM(fms.wins) / SUM(fms.total_games), 2) as global_winrate,
        COUNT(DISTINCT fms.map_id) as maps_played,
        MAX(fms.last_updated) as last_updated
      FROM faction_map_statistics fms
      JOIN factions f ON fms.faction_id = f.id
      GROUP BY f.id, f.name
      HAVING SUM(fms.total_games) >= 5
      ORDER BY global_winrate DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching global faction statistics:', error);
    res.status(500).json({ error: 'Failed to fetch global faction statistics' });
  }
});

/**
 * Get map statistics (which maps have best balance)
 * Groups by map only to avoid duplicates from bidirectional matchups
 */
router.get('/map-balance', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        gm.id as map_id,
        gm.name as map_name,
        COUNT(DISTINCT fms.faction_id) as factions_used,
        SUM(fms.total_games) / 2 as total_games,
        ROUND(STDDEV(fms.winrate), 2) as avg_imbalance,
        MIN(fms.winrate) as lowest_winrate,
        MAX(fms.winrate) as highest_winrate,
        MAX(fms.last_updated) as last_updated
      FROM faction_map_statistics fms
      JOIN game_maps gm ON fms.map_id = gm.id
      GROUP BY gm.id, gm.name
      HAVING SUM(fms.total_games) >= 10
      ORDER BY avg_imbalance ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching map balance statistics:', error);
    res.status(500).json({ error: 'Failed to fetch map balance statistics' });
  }
});

/**
 * Get statistics for a specific faction across all maps
 */
router.get('/faction/:factionId', async (req, res) => {
  try {
    const { factionId } = req.params;
    
    const result = await query(
      `SELECT 
        gm.id as map_id,
        gm.name as map_name,
        f2.id as opponent_faction_id,
        f2.name as opponent_faction_name,
        fms.total_games,
        fms.wins,
        fms.losses,
        fms.winrate,
        fms.last_updated
      FROM faction_map_statistics fms
      JOIN game_maps gm ON fms.map_id = gm.id
      JOIN factions f2 ON fms.opponent_faction_id = f2.id
      WHERE fms.faction_id = $1
      AND fms.total_games >= 2
      ORDER BY gm.name, fms.winrate DESC`,
      [factionId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching faction statistics:', error);
    res.status(500).json({ error: 'Failed to fetch faction statistics' });
  }
});

/**
 * Get statistics for a specific map
 */
router.get('/map/:mapId', async (req, res) => {
  try {
    const { mapId } = req.params;
    
    const result = await query(
      `SELECT 
        f.id as faction_id,
        f.name as faction_name,
        fms.total_games,
        fms.wins,
        fms.losses,
        fms.winrate,
        fms.last_updated
      FROM faction_map_statistics fms
      JOIN factions f ON fms.faction_id = f.id
      WHERE fms.map_id = $1
      AND fms.total_games >= 2
      ORDER BY fms.winrate DESC`,
      [mapId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching map statistics:', error);
    res.status(500).json({ error: 'Failed to fetch map statistics' });
  }
});

export default router;
