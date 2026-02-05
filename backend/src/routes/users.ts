import { Router } from 'express';
import { query } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Get user profile
router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userResult = await query(
      `SELECT 
        u.id, 
        u.nickname, 
        u.email, 
        u.language, 
        u.discord_id, 
        u.elo_rating, 
        u.level, 
        u.is_admin, 
        u.created_at, 
        u.is_rated, 
        u.matches_played, 
        u.total_wins, 
        u.total_losses, 
        u.trend,
        u.is_active,
        u.country,
        u.avatar,
        COALESCE(u.password_must_change, false) as password_must_change,
        pms.avg_elo_change
      FROM users u
      LEFT JOIN player_match_statistics pms ON u.id = pms.player_id 
        AND pms.opponent_id IS NULL 
        AND pms.map_id IS NULL 
        AND pms.faction_id IS NULL
      WHERE u.id = $1`,
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get last activity from most recent match (any status except cancelled)
    const lastActivityResult = await query(
      `SELECT created_at FROM matches WHERE (winner_id = $1 OR loser_id = $1) AND status != 'cancelled' ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );

    console.log(`[User ${req.userId}] Last activity query result:`, lastActivityResult.rows);

    const result = {
      ...user,
      last_activity: lastActivityResult.rows[0]?.created_at || null
    };

    console.log(`[User ${req.userId}] Final result:`, result);

    res.json(result);
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

// Get user matches with pagination and filters
router.get('/:id/matches', async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get filter params from query
    const playerFilter = (req.query.player as string)?.trim() || '';
    const mapFilter = (req.query.map as string)?.trim() || '';
    const statusFilter = (req.query.status as string)?.trim() || '';
    const factionFilter = (req.query.faction as string)?.trim() || '';

    console.log('🔍 GET /users/:id/matches - Filters received:', { playerFilter, mapFilter, statusFilter, factionFilter });

    // Build WHERE clause dynamically
    let whereConditions: string[] = ['(m.winner_id = $1 OR m.loser_id = $1)'];
    let params: any[] = [id];
    let paramCount = 2;

    if (playerFilter) {
      whereConditions.push(`(w.nickname ILIKE $${paramCount} OR l.nickname ILIKE $${paramCount})`);
      params.push(`%${playerFilter}%`);
      paramCount++;
    }

    if (mapFilter) {
      whereConditions.push(`m.map ILIKE $${paramCount}`);
      params.push(`%${mapFilter}%`);
      paramCount++;
    }

    if (statusFilter) {
      whereConditions.push(`m.status = $${paramCount}`);
      params.push(statusFilter);
      paramCount++;
    }

    if (factionFilter) {
      whereConditions.push(`(m.winner_faction = $${paramCount} OR m.loser_faction = $${paramCount})`);
      params.push(factionFilter);
      params.push(factionFilter);
      paramCount++;
      console.log('🔍 Faction filter applied:', factionFilter);
    }

    const whereClause = whereConditions.join(' AND ');

    console.log('🔍 WHERE clause:', whereClause);
    console.log('🔍 Query params:', params);

    // Get total count of filtered matches
    const countQuery = `SELECT COUNT(*) as total FROM matches m 
                        JOIN users w ON m.winner_id = w.id 
                        JOIN users l ON m.loser_id = l.id 
                        WHERE ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Get matches for current page with filters
    params.push(limit);
    params.push(offset);
    const result = await query(
      `SELECT 
        m.*,
        w.nickname as winner_nickname,
        l.nickname as loser_nickname
       FROM matches m
       JOIN users w ON m.winner_id = w.id
       JOIN users l ON m.loser_id = l.id
       WHERE ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    console.log('🔍 Query returned', result.rows.length, 'matches');
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
    console.error('Error fetching user matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Search users - RATE LIMITED
router.get('/search/:searchQuery', searchLimiter, async (req, res) => {
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
      `UPDATE users SET discord_id = $1 WHERE id = $2 RETURNING id, nickname, email, language, discord_id, country, avatar, elo_rating, level, created_at`,
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

// Update user profile (country and avatar)
router.put('/profile/update', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { country, avatar } = req.body;

    if (!country && !avatar) {
      return res.status(400).json({ error: 'At least one field (country or avatar) is required' });
    }

    let updateFields: string[] = [];
    let params: any[] = [];
    let paramCount = 1;

    if (country) {
      updateFields.push(`country = $${paramCount}`);
      params.push(country);
      paramCount++;
    }

    if (avatar) {
      updateFields.push(`avatar = $${paramCount}`);
      params.push(avatar);
      paramCount++;
    }

    params.push(req.userId);
    
    const result = await query(
      `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING id, nickname, email, language, discord_id, country, avatar, elo_rating, level, created_at`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile', details: (error as any).message });
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
      'u.elo_rating >= 1400',
      'u.matches_played >= 10'
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
      `SELECT u.id, u.nickname, u.elo_rating, u.level, u.is_rated, u.matches_played, u.total_wins, u.total_losses, u.country, u.avatar, COALESCE(u.trend, '-') as trend 
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
      `SELECT u.id, u.nickname, u.elo_rating, u.level, u.is_rated, u.matches_played, u.total_wins, u.total_losses, u.country, u.avatar, COALESCE(u.trend, '-') as trend
       FROM users u
       WHERE u.is_active = true 
         AND u.is_blocked = false
         AND u.is_rated = true
         AND u.elo_rating >= 1400
         AND u.matches_played >= 10
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
      `SELECT id, nickname, elo_rating, level, is_rated, country, avatar, created_at FROM users 
       WHERE is_blocked = false
       ORDER BY created_at DESC
       LIMIT 500`
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('All users error:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: (error as any).message });
  }
});

// Get monthly statistics for a user
router.get('/:id/stats/month', async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get ELO change this month
    const eloChangeResult = await query(
      `SELECT 
        COALESCE(SUM(CASE WHEN winner_id = $1 THEN elo_change ELSE -elo_change END), 0) as elo_gained
       FROM matches 
       WHERE (winner_id = $1 OR loser_id = $1) 
         AND status = 'confirmed'
         AND created_at >= $2`,
      [id, monthAgo]
    );

    // Get previous month ELO to calculate ranking positions change
    const prevMonthEloResult = await query(
      `SELECT COALESCE(MIN(elo_rating), 0) as min_elo_month
       FROM (
         SELECT CASE 
           WHEN winner_id = $1 THEN winner_elo_before
           ELSE loser_elo_before
         END as elo_rating
         FROM matches 
         WHERE (winner_id = $1 OR loser_id = $1)
           AND status = 'confirmed'
           AND created_at >= $2
         ORDER BY created_at ASC
         LIMIT 1
       ) as first_month
      `,
      [id, monthAgo]
    );

    // Get current ELO
    const currentEloResult = await query(
      'SELECT elo_rating FROM users WHERE id = $1',
      [id]
    );

    const eloGained = eloChangeResult.rows[0].elo_gained;
    const currentElo = currentEloResult.rows[0]?.elo_rating || 0;
    const prevMonthElo = prevMonthEloResult.rows[0]?.min_elo_month || currentElo;

    // Get ranking at start of month and current ranking
    const startRankingResult = await query(
      `SELECT COUNT(*) as rank_at_start 
       FROM users u2 
       WHERE u2.is_active = true 
         AND u2.is_blocked = false
         AND u2.is_rated = true
         AND u2.elo_rating >= 1400
         AND (
           u2.elo_rating > $1 
           OR (u2.elo_rating = $1 AND u2.id < $2)
         )`,
      [prevMonthElo, id]
    );

    const currentRankingResult = await query(
      `SELECT COUNT(*) as current_rank 
       FROM users u2 
       WHERE u2.is_active = true 
         AND u2.is_blocked = false
         AND u2.is_rated = true
         AND u2.elo_rating >= 1400
         AND (
           u2.elo_rating > $1 
           OR (u2.elo_rating = $1 AND u2.id < $2)
         )`,
      [currentElo, id]
    );

    const rankAtStart = parseInt(startRankingResult.rows[0].rank_at_start) + 1;
    const currentRank = parseInt(currentRankingResult.rows[0].current_rank) + 1;
    const positionsGained = rankAtStart - currentRank;

    res.json({
      elo_gained: Math.round(eloGained),
      positions_gained: positionsGained,
      rank_start: rankAtStart,
      current_rank: currentRank
    });
  } catch (error) {
    console.error('Monthly stats error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly stats', details: (error as any).message });
  }
});

// Get available countries with multilingual names
router.get('/data/countries', async (req, res) => {
  try {
    console.log('🔵 GET /data/countries called');
    // Get the preferred language from query params, default to English
    const lang = (req.query.lang as string || 'en').toLowerCase();
    console.log('📍 Language:', lang);
    
    const result = await query(
      `SELECT 
        code, 
        names_json, 
        flag_emoji,
        official_name,
        region
       FROM countries 
       WHERE is_active = true 
       ORDER BY names_json->>'en' ASC`
    );
    
    console.log('✅ Query result rows:', result.rows.length);
    console.log('📊 First row:', result.rows[0]);

    // Transform the response to include the country name in the requested language
    const countries = result.rows.map(row => {
      const names = row.names_json || {};
      const name = names[lang] || names['en'] || 'Unknown';
      
      return {
        code: row.code,
        name,
        flag: row.flag_emoji,
        official_name: row.official_name,
        region: row.region,
        names: names // Include all names for frontend flexibility
      };
    });
    
    console.log('📤 Sending response:', countries.length, 'countries');
    console.log('🏁 First country response:', countries[0]);
    
    res.json(countries);
  } catch (error) {
    console.error('❌ Countries error:', error);
    res.status(500).json({ error: 'Failed to fetch countries', details: (error as any).message });
  }
});

// Get available avatars
router.get('/data/avatars', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, icon_path, description FROM player_avatars WHERE is_active = true ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Avatars error:', error);
    res.status(500).json({ error: 'Failed to fetch avatars', details: (error as any).message });
  }
});

export default router;
