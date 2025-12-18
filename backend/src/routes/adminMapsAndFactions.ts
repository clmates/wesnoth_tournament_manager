import { Router, Response, NextFunction } from 'express';
import { query } from '../config/database.js';
import { authMiddleware, AuthRequest, adminMiddleware } from '../middleware/auth.js';

const router = Router();

// ============================================================
// MAPS MANAGEMENT
// ============================================================

// Get all maps (with translations)
router.get('/maps', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        is_active,
        created_at,
        usage_count
      FROM game_maps
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maps:', error);
    res.status(500).json({ error: 'Failed to fetch maps' });
  }
});

// Get map translations
router.get('/maps/:mapId/translations', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { mapId } = req.params;
    const result = await query(`
      SELECT * FROM map_translations
      WHERE map_id = $1
      ORDER BY language_code
    `, [mapId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching map translations:', error);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

// Create new map
router.post('/maps', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, description, language_code } = req.body;
    
    if (!name || !language_code) {
      return res.status(400).json({ error: 'Name and language_code are required' });
    }

    // Create map
    const mapResult = await query(`
      INSERT INTO game_maps (name, is_active)
      VALUES ($1, true)
      RETURNING id, name, is_active, created_at
    `, [name]);

    const mapId = mapResult.rows[0].id;

    // Create translation
    await query(`
      INSERT INTO map_translations (map_id, language_code, name, description)
      VALUES ($1, $2, $3, $4)
    `, [mapId, language_code, name, description || null]);

    res.json(mapResult.rows[0]);
  } catch (error) {
    console.error('Error creating map:', error);
    res.status(500).json({ error: 'Failed to create map' });
  }
});

// Update map status
router.patch('/maps/:mapId', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { mapId } = req.params;
    const { is_active } = req.body;

    const result = await query(`
      UPDATE game_maps
      SET is_active = $1
      WHERE id = $2
      RETURNING id, name, is_active, created_at
    `, [is_active, mapId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Map not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating map:', error);
    res.status(500).json({ error: 'Failed to update map' });
  }
});

// Add translation to existing map
router.post('/maps/:mapId/translations', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { mapId } = req.params;
    const { language_code, name, description } = req.body;

    if (!language_code || !name) {
      return res.status(400).json({ error: 'language_code and name are required' });
    }

    const result = await query(`
      INSERT INTO map_translations (map_id, language_code, name, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (map_id, language_code) DO UPDATE SET
        name = $3,
        description = $4,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, map_id, language_code, name, description
    `, [mapId, language_code, name, description || null]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding translation:', error);
    res.status(500).json({ error: 'Failed to add translation' });
  }
});

// Delete map
router.delete('/maps/:mapId', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { mapId } = req.params;

    // Check if map is being used
    const usageResult = await query(`
      SELECT COUNT(*) as count FROM matches WHERE map = (SELECT name FROM game_maps WHERE id = $1)
    `, [mapId]);

    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete map that has been used in matches' });
    }

    await query('DELETE FROM game_maps WHERE id = $1', [mapId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting map:', error);
    res.status(500).json({ error: 'Failed to delete map' });
  }
});

// ============================================================
// FACTIONS MANAGEMENT
// ============================================================

// Get all factions (with translations)
router.get('/factions', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(`
      SELECT 
        id,
        name,
        is_active,
        created_at
      FROM factions
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching factions:', error);
    res.status(500).json({ error: 'Failed to fetch factions' });
  }
});

// Get faction translations
router.get('/factions/:factionId/translations', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { factionId } = req.params;
    const result = await query(`
      SELECT * FROM faction_translations
      WHERE faction_id = $1
      ORDER BY language_code
    `, [factionId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching faction translations:', error);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

// Create new faction
router.post('/factions', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, description, language_code } = req.body;
    
    if (!name || !language_code) {
      return res.status(400).json({ error: 'Name and language_code are required' });
    }

    // Create faction
    const factionResult = await query(`
      INSERT INTO factions (name, is_active)
      VALUES ($1, true)
      RETURNING id, name, is_active, created_at
    `, [name]);

    const factionId = factionResult.rows[0].id;

    // Create translation
    await query(`
      INSERT INTO faction_translations (faction_id, language_code, name, description)
      VALUES ($1, $2, $3, $4)
    `, [factionId, language_code, name, description || null]);

    res.json(factionResult.rows[0]);
  } catch (error) {
    console.error('Error creating faction:', error);
    res.status(500).json({ error: 'Failed to create faction' });
  }
});

// Update faction status
router.patch('/factions/:factionId', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { factionId } = req.params;
    const { is_active } = req.body;

    const result = await query(`
      UPDATE factions
      SET is_active = $1
      WHERE id = $2
      RETURNING id, name, is_active, created_at
    `, [is_active, factionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Faction not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating faction:', error);
    res.status(500).json({ error: 'Failed to update faction' });
  }
});

// Add translation to existing faction
router.post('/factions/:factionId/translations', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { factionId } = req.params;
    const { language_code, name, description } = req.body;

    if (!language_code || !name) {
      return res.status(400).json({ error: 'language_code and name are required' });
    }

    const result = await query(`
      INSERT INTO faction_translations (faction_id, language_code, name, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (faction_id, language_code) DO UPDATE SET
        name = $3,
        description = $4,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, faction_id, language_code, name, description
    `, [factionId, language_code, name, description || null]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding translation:', error);
    res.status(500).json({ error: 'Failed to add translation' });
  }
});

// Delete faction
router.delete('/factions/:factionId', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { factionId } = req.params;

    // Check if faction is being used
    const usageResult = await query(`
      SELECT COUNT(*) as count FROM matches 
      WHERE winner_faction = (SELECT name FROM factions WHERE id = $1)
      OR loser_faction = (SELECT name FROM factions WHERE id = $1)
    `, [factionId]);

    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete faction that has been used in matches' });
    }

    await query('DELETE FROM factions WHERE id = $1', [factionId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting faction:', error);
    res.status(500).json({ error: 'Failed to delete faction' });
  }
});

export default router;
