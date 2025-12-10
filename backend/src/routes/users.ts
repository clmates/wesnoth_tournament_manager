import { Router } from 'express';
import { query } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get user profile
router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, nickname, email, language, discord_id, elo_rating, level, is_admin, created_at, 
              is_rated, matches_played, total_wins, total_losses, trend 
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get user stats
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const matchesResult = await query(
      `SELECT COUNT(*) as total FROM matches WHERE (winner_id = $1 OR loser_id = $1) AND status = 'confirmed'`,
      [id]
    );

    const winsResult = await query("SELECT COUNT(*) as wins FROM matches WHERE winner_id = $1 AND status = 'confirmed'", [id]);
    const lossesResult = await query("SELECT COUNT(*) as losses FROM matches WHERE loser_id = $1 AND status = 'confirmed'", [id]);

    const userResult = await query('SELECT elo_rating, level FROM users WHERE id = $1', [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      total_matches: matchesResult.rows[0].total,
      wins: winsResult.rows[0].wins,
      losses: lossesResult.rows[0].losses,
      elo_rating: userResult.rows[0].elo_rating,
      level: userResult.rows[0].level,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get recent matches
router.get('/:id/matches', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        m.*,
        w.nickname as winner_nickname,
        l.nickname as loser_nickname
       FROM matches m
       JOIN users w ON m.winner_id = w.id
       JOIN users l ON m.loser_id = l.id
       WHERE (m.winner_id = $1 OR m.loser_id = $1)
       ORDER BY m.created_at DESC
       LIMIT 20`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Search users
router.get('/search/:searchQuery', async (req, res) => {
  try {
    const { searchQuery } = req.params;

    const result = await query(
      `SELECT id, nickname, elo_rating, level FROM users 
       WHERE nickname ILIKE $1 AND is_active = true AND is_blocked = false
       LIMIT 20`,
      [`%${searchQuery}%`]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Update Discord ID
router.put('/profile/discord', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { discord_id } = req.body;
    console.log('Update Discord ID request:', { discord_id, userId: req.userId });

    if (!discord_id || discord_id.trim() === '') {
      return res.status(400).json({ error: 'Discord ID cannot be empty' });
    }

    const result = await query(
      `UPDATE users SET discord_id = $1 WHERE id = $2 RETURNING id, nickname, email, language, discord_id, elo_rating, level, created_at`,
      [discord_id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Discord ID updated successfully:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating Discord ID:', error);
    res.status(500).json({ error: 'Failed to update Discord ID' });
  }
});

// Get global ranking
router.get('/ranking/global', async (req, res) => {
  try {
    // Get page from query params, default to 1
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get filter params from query
    const nicknameFilter = (req.query.nickname as string)?.trim() || '';
    const minElo = req.query.min_elo ? parseInt(req.query.min_elo as string) : null;
    const maxElo = req.query.max_elo ? parseInt(req.query.max_elo as string) : null;

    // Build WHERE clause dynamically
    let whereConditions: string[] = [
      'u.is_active = true',
      'u.is_blocked = false',
      'u.is_rated = true',
      'u.elo_rating >= 1400'
    ];
    let params: any[] = [];
    let paramCount = 1;

    if (nicknameFilter) {
      whereConditions.push(`u.nickname ILIKE $${paramCount}`);
      params.push(`%${nicknameFilter}%`);
      paramCount++;
    }

    if (minElo !== null) {
      whereConditions.push(`u.elo_rating >= $${paramCount}`);
      params.push(minElo);
      paramCount++;
    }

    if (maxElo !== null) {
      whereConditions.push(`u.elo_rating <= $${paramCount}`);
      params.push(maxElo);
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count of filtered players
    const countQuery = `SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Get players for current page with filters
    params.push(limit);
    params.push(offset);
    const result = await query(
      `SELECT u.id, u.nickname, u.elo_rating, u.level, u.is_rated, u.matches_played, u.total_wins, u.total_losses, COALESCE(u.trend, '-') as trend 
       FROM users u
       WHERE ${whereClause}
       ORDER BY u.elo_rating DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        showing: result.rows.length
      }
    });
  } catch (error) {
    console.error('Ranking error:', error);
    res.status(500).json({ error: 'Failed to fetch ranking', details: (error as any).message });
  }
});

// Get active ranking (with recent activity filter)
router.get('/ranking/active', async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT u.id, u.nickname, u.elo_rating, u.level, u.is_rated, u.matches_played, u.total_wins, u.total_losses, COALESCE(u.trend, '-') as trend,
              MAX(m.created_at) as last_match_date
       FROM users u
       LEFT JOIN matches m ON (m.winner_id = u.id OR m.loser_id = u.id) AND m.status = 'confirmed'
       WHERE u.is_active = true 
         AND u.is_blocked = false
         AND u.is_rated = true
         AND u.elo_rating >= 1400
       GROUP BY u.id, u.nickname, u.elo_rating, u.level, u.is_rated, u.matches_played, u.total_wins, u.total_losses, u.trend
       HAVING MAX(m.created_at) >= NOW() - INTERVAL '30 days' OR MAX(m.created_at) IS NULL
       ORDER BY u.elo_rating DESC
       LIMIT 100`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Active ranking error:', error);
    res.status(500).json({ error: 'Failed to fetch active ranking', details: (error as any).message });
  }
});

// Get all active users for opponent selection (no rating filter)
router.get('/all', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, nickname, elo_rating, level, is_rated, created_at FROM users 
       WHERE is_active = true 
         AND is_blocked = false
       ORDER BY created_at DESC
       LIMIT 500`
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('All users error:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: (error as any).message });
  }
});

export default router;
