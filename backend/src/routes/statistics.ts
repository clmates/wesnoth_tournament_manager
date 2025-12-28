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
 * Only shows one direction (faction_id < opponent_faction_id) to avoid duplicates
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
      AND fms.faction_id < fms.opponent_faction_id
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

// ===== BALANCE HISTORY ENDPOINTS =====

/**
 * Get balance history for a specific faction/map matchup
 * Returns daily snapshots of winrate over a date range
 */
router.get('/history/trend', async (req, res) => {
  try {
    const { mapId, factionId, opponentFactionId, dateFrom, dateTo } = req.query;
    
    if (!mapId || !factionId || !opponentFactionId || !dateFrom || !dateTo) {
      return res.status(400).json({ error: 'Missing required parameters: mapId, factionId, opponentFactionId, dateFrom, dateTo' });
    }
    
    const result = await query(
      `SELECT * FROM get_balance_trend($1, $2, $3, $4::DATE, $5::DATE)`,
      [mapId, factionId, opponentFactionId, dateFrom, dateTo]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching balance trend:', error);
    res.status(500).json({ error: 'Failed to fetch balance trend' });
  }
});

/**
 * Get all balance events with optional filtering
 * Used to mark balance patches and changes
 */
router.get('/history/events', async (req, res) => {
  try {
    const { factionId, mapId, eventType, limit = '50', offset = '0' } = req.query;
    
    let whereClause = '';
    const params = [];
    let paramIndex = 1;
    
    if (factionId) {
      whereClause += `faction_id = $${paramIndex++} `;
      params.push(factionId);
    }
    
    if (mapId) {
      if (whereClause) whereClause += 'AND ';
      whereClause += `map_id = $${paramIndex++} `;
      params.push(mapId);
    }
    
    if (eventType) {
      if (whereClause) whereClause += 'AND ';
      whereClause += `event_type = $${paramIndex++} `;
      params.push(eventType);
    }
    
    if (whereClause) whereClause = 'WHERE ' + whereClause;
    
    params.push(parseInt(limit as string));
    params.push(parseInt(offset as string));
    
    const result = await query(
      `SELECT 
        be.id,
        be.event_date,
        be.patch_version,
        be.event_type,
        be.description,
        f.name as faction_name,
        gm.name as map_name,
        u.username as created_by_name
      FROM balance_events be
      LEFT JOIN factions f ON be.faction_id = f.id
      LEFT JOIN game_maps gm ON be.map_id = gm.id
      LEFT JOIN users u ON be.created_by = u.id
      ${whereClause}
      ORDER BY be.event_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching balance events:', error);
    res.status(500).json({ error: 'Failed to fetch balance events' });
  }
});

/**
 * Get balance event impact (before/after comparison)
 * Compares stats before and after a specific balance patch
 */
router.get('/history/events/:eventId/impact', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { daysBefore = '30', daysAfter = '30' } = req.query;
    
    const result = await query(
      `SELECT * FROM get_balance_event_impact($1, $2::INT, $3::INT)`,
      [eventId, parseInt(daysBefore as string), parseInt(daysAfter as string)]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching event impact:', error);
    res.status(500).json({ error: 'Failed to fetch event impact' });
  }
});

/**
 * Get snapshot data for a specific date (admin only)
 * Shows all faction/map combinations as they were on that date
 */
router.get('/history/snapshot', async (req, res) => {
  try {
    const { date, minGames = '2' } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Missing required parameter: date' });
    }
    
    const result = await query(
      `SELECT 
        gm.id as map_id,
        gm.name as map_name,
        f1.id as faction_id,
        f1.name as faction_name,
        f2.id as opponent_faction_id,
        f2.name as opponent_faction_name,
        fms.total_games,
        fms.wins,
        fms.losses,
        fms.winrate,
        fms.sample_size_category,
        fms.confidence_level,
        fms.snapshot_date
      FROM faction_map_statistics_history fms
      JOIN game_maps gm ON fms.map_id = gm.id
      JOIN factions f1 ON fms.faction_id = f1.id
      JOIN factions f2 ON fms.opponent_faction_id = f2.id
      WHERE fms.snapshot_date = $1::DATE
      AND fms.total_games >= $2::INT
      ORDER BY gm.name, fms.winrate DESC`,
      [date, parseInt(minGames as string)]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    res.status(500).json({ error: 'Failed to fetch snapshot' });
  }
});

/**
 * Create a new balance event (admin only)
 * Records a patch or balance change
 */
router.post('/history/events', async (req, res) => {
  try {
    const { event_date, patch_version, event_type, description, faction_id, map_id, notes } = req.body;
    const userId = (req as any).userId;
    
    if (!event_date || !event_type || !description) {
      return res.status(400).json({ error: 'Missing required fields: event_date, event_type, description' });
    }
    
    if (!['BUFF', 'NERF', 'REWORK', 'HOTFIX', 'GENERAL_BALANCE_CHANGE'].includes(event_type)) {
      return res.status(400).json({ error: 'Invalid event_type' });
    }
    
    const result = await query(
      `INSERT INTO balance_events (event_date, patch_version, event_type, description, faction_id, map_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, event_date, patch_version, event_type, description, created_at`,
      [event_date, patch_version, event_type, description, faction_id || null, map_id || null, notes || null, userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating balance event:', error);
    res.status(500).json({ error: 'Failed to create balance event' });
  }
});

/**
 * Manually create a snapshot for a specific date (admin only)
 * Useful for backfilling historical data
 */
router.post('/history/snapshot', async (req, res) => {
  try {
    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Missing required field: date' });
    }
    
    const result = await query(
      `SELECT * FROM create_faction_map_statistics_snapshot($1::DATE)`,
      [date]
    );
    
    const { snapshots_created, snapshots_skipped } = result.rows[0];
    res.json({ 
      message: 'Snapshot created successfully',
      snapshots_created,
      snapshots_skipped,
      date
    });
  } catch (error) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
});

export default router;
