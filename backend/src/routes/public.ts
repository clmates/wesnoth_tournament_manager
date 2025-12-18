import { Router } from 'express';
import { query } from '../config/database.js';

const router = Router();

// Get FAQ (public endpoint) - returns all language versions
// Frontend will handle language selection with fallback to English
router.get('/faq', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, question, answer, language_code, created_at, "order" FROM public.faq ORDER BY "order" ASC, created_at ASC, language_code ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    res.status(500).json({ error: 'Failed to fetch FAQ' });
  }
});

// Get all tournaments (public endpoint)
router.get('/tournaments', async (req, res) => {
  try {
    // Get page from query params, default to 1
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get filter params from query
    const nameFilter = (req.query.name as string)?.trim() || '';
    const statusFilter = (req.query.status as string)?.trim() || '';
    const typeFilter = (req.query.type as string)?.trim() || '';

    // Build WHERE clause dynamically
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramCount = 1;

    if (nameFilter) {
      whereConditions.push(`t.name ILIKE $${paramCount}`);
      params.push(`%${nameFilter}%`);
      paramCount++;
    }

    if (statusFilter) {
      whereConditions.push(`t.status = $${paramCount}`);
      params.push(statusFilter);
      paramCount++;
    }

    if (typeFilter) {
      whereConditions.push(`t.tournament_type = $${paramCount}`);
      params.push(typeFilter);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count of filtered tournaments
    const countQuery = `SELECT COUNT(*) as total FROM public.tournaments t ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Get tournaments for current page with filters
    params.push(limit);
    params.push(offset);
    const tournamentsResult = await query(`
      SELECT 
        t.id, 
        t.name, 
        t.description, 
        t.creator_id,
        u.nickname as creator_nickname,
        t.status, 
        t.tournament_type,
        t.max_participants,
        t.general_rounds,
        t.final_rounds,
        t.general_rounds_format,
        t.final_rounds_format,
        t.round_duration_days,
        t.auto_advance_round,
        t.created_at, 
        t.updated_at,
        t.started_at,
        t.finished_at,
        t.approved_at
      FROM tournaments t
      LEFT JOIN users u ON t.creator_id = u.id
      ${whereClause}
      ORDER BY t.updated_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, params);

    // For each tournament, if status = 'finished', fetch winner and runner-up from participants
    const tournaments = await Promise.all(tournamentsResult.rows.map(async (t: any) => {
      let winner_id = null, winner_nickname = null, runner_up_id = null, runner_up_nickname = null;
      
      if (t.status === 'finished') {
        const rankingResult = await query(`
          SELECT tp.user_id, u.nickname
          FROM tournament_participants tp
          LEFT JOIN users u ON tp.user_id = u.id
          WHERE tp.tournament_id = $1
          ORDER BY tp.tournament_points DESC, tp.tournament_wins DESC
          LIMIT 2
        `, [t.id]);
        
        if (rankingResult.rows.length > 0) {
          winner_id = rankingResult.rows[0].user_id;
          winner_nickname = rankingResult.rows[0].nickname;
        }
        if (rankingResult.rows.length > 1) {
          runner_up_id = rankingResult.rows[1].user_id;
          runner_up_nickname = rankingResult.rows[1].nickname;
        }
      }

      return {
        ...t,
        winner_id,
        winner_nickname,
        runner_up_id,
        runner_up_nickname
      };
    }));

    res.json({
      data: tournaments,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        showing: tournaments.length
      }
    });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// Get tournament by ID (public endpoint)
router.get('/tournaments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        t.id, 
        t.name, 
        t.description, 
        t.creator_id,
        u.nickname as creator_nickname,
        t.status, 
        t.tournament_type,
        t.max_participants,
        t.general_rounds,
        t.final_rounds,
        t.general_rounds_format,
        t.final_rounds_format,
        t.round_duration_days,
        t.auto_advance_round,
        t.created_at, 
        t.updated_at,
        t.started_at,
        t.finished_at,
        t.approved_at
      FROM tournaments t
      LEFT JOIN users u ON t.creator_id = u.id
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching tournament:', error);
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

// Get tournament participants (public endpoint)
router.get('/tournaments/:id/participants', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        tp.id,
        tp.user_id,
        u.nickname,
        u.elo_rating,
        tp.participation_status,
        tp.status,
        tp.tournament_ranking,
        tp.tournament_wins,
        tp.tournament_losses,
        tp.tournament_points
      FROM tournament_participants tp
      LEFT JOIN users u ON tp.user_id = u.id
      WHERE tp.tournament_id = $1
      ORDER BY tp.tournament_ranking ASC NULLS LAST, u.elo_rating DESC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tournament participants:', error);
    res.status(500).json({ error: 'Failed to fetch participants' });
  }
});

// Get tournament matches (public endpoint)
router.get('/tournaments/:id/matches', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT 
        tm.id,
        tm.tournament_id,
        tm.round_id,
        tm.player1_id,
        tm.player2_id,
        tm.winner_id,
        tm.match_id,
        tm.match_status,
        tm.played_at,
        tm.created_at,
        tr.round_number,
        tr.round_type,
        tr.round_status,
        u1.nickname as player1_nickname,
        u2.nickname as player2_nickname,
        uw.nickname as winner_nickname
      FROM tournament_matches tm
      JOIN tournament_rounds tr ON tm.round_id = tr.id
      LEFT JOIN users u1 ON tm.player1_id = u1.id
      LEFT JOIN users u2 ON tm.player2_id = u2.id
      LEFT JOIN users uw ON tm.winner_id = uw.id
      WHERE tm.tournament_id = $1
      ORDER BY tr.round_number ASC, tm.created_at ASC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tournament matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Get announcements/news (public endpoint)
router.get('/news', async (req, res) => {
  try {
    const result = await query(
      `SELECT n.id, n.title, n.content, n.translations, n.published_at, n.created_at, u.nickname as author 
       FROM news n
       LEFT JOIN users u ON n.author_id = u.id
       ORDER BY n.published_at DESC NULLS FIRST, n.created_at DESC`
    );
    console.log('News query result:', result.rows.length, 'rows found');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news', details: (error as any).message });
  }
});

// Get recent matches (public endpoint)
router.get('/matches/recent', async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*, 
              w.nickname as winner_nickname,
              l.nickname as loser_nickname
       FROM matches m
       JOIN users w ON m.winner_id = w.id
       JOIN users l ON m.loser_id = l.id
       ORDER BY m.created_at DESC
       LIMIT 20`
    );
    console.log('Recent matches query result:', result.rows.length, 'rows found');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recent matches:', error);
    res.status(500).json({ error: 'Failed to fetch recent matches', details: (error as any).message });
  }
});

// Get all players directory (public endpoint)
router.get('/players', async (req, res) => {
  try {
    // Get page from query params, default to 1
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get filter params from query
    const nicknameFilter = (req.query.nickname as string)?.trim() || '';
    const ratedOnly = req.query.rated_only === 'true';
    const minElo = req.query.min_elo ? parseInt(req.query.min_elo as string) : null;
    const maxElo = req.query.max_elo ? parseInt(req.query.max_elo as string) : null;
    const minMatches = req.query.min_matches ? parseInt(req.query.min_matches as string) : null;

    // Build WHERE clause dynamically
    let whereConditions: string[] = ['is_active = true', 'is_blocked = false'];
    let params: any[] = [];
    let paramCount = 1;

    if (nicknameFilter) {
      whereConditions.push(`nickname ILIKE $${paramCount}`);
      params.push(`%${nicknameFilter}%`);
      paramCount++;
    }

    if (ratedOnly) {
      whereConditions.push(`is_rated = true`);
    }

    if (minElo !== null) {
      whereConditions.push(`elo_rating >= $${paramCount}`);
      params.push(minElo);
      paramCount++;
    }

    if (maxElo !== null) {
      whereConditions.push(`elo_rating <= $${paramCount}`);
      params.push(maxElo);
      paramCount++;
    }

    if (minMatches !== null) {
      whereConditions.push(`matches_played >= $${paramCount}`);
      params.push(minMatches);
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count of filtered players
    const countQuery = `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Get players for current page with filters
    params.push(limit);
    params.push(offset);
    const result = await query(
      `SELECT id, nickname, elo_rating, is_rated, matches_played, total_wins, total_losses
       FROM users
       WHERE ${whereClause}
       ORDER BY nickname ASC
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
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Get all confirmed matches (public endpoint)
router.get('/matches', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = 20;
    const offset = (page - 1) * pageSize;

    // Parse filters
    const winner = req.query.winner ? (req.query.winner as string).trim() : null;
    const loser = req.query.loser ? (req.query.loser as string).trim() : null;
    const map = req.query.map ? (req.query.map as string).trim() : null;
    const status = req.query.status ? (req.query.status as string).trim() : null;
    const confirmed = req.query.confirmed ? (req.query.confirmed as string).trim() : null;

    // Build WHERE conditions
    const whereConditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (winner) {
      whereConditions.push(`w.nickname ILIKE $${paramCount}`);
      params.push(`%${winner}%`);
      paramCount++;
    }

    if (loser) {
      whereConditions.push(`l.nickname ILIKE $${paramCount}`);
      params.push(`%${loser}%`);
      paramCount++;
    }

    if (map) {
      whereConditions.push(`m.map ILIKE $${paramCount}`);
      params.push(`%${map}%`);
      paramCount++;
    }

    if (status) {
      whereConditions.push(`m.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (confirmed) {
      const isConfirmed = confirmed.toLowerCase() === 'true' || confirmed === '1';
      whereConditions.push(`m.loser_confirmed = $${paramCount}`);
      params.push(isConfirmed);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM matches m
      JOIN users w ON m.winner_id = w.id
      JOIN users l ON m.loser_id = l.id
      ${whereClause}
    `;

    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / pageSize);

    // Get paginated data
    const dataQuery = `
      SELECT m.*, 
              w.nickname as winner_nickname,
              l.nickname as loser_nickname
       FROM matches m
       JOIN users w ON m.winner_id = w.id
       JOIN users l ON m.loser_id = l.id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(pageSize);
    params.push(offset);

    const result = await query(dataQuery, params);

    console.log('All matches query result:', result.rows.length, 'rows found');

    res.json({
      data: result.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches', details: (error as any).message });
  }
});

// Get all maps (public endpoint - only active)
router.get('/maps', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, created_at, usage_count FROM public.game_maps WHERE is_active = true ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maps:', error);
    res.status(500).json({ error: 'Failed to fetch maps' });
  }
});

// Get all factions (public endpoint - only active)
router.get('/factions', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, description, icon_path, created_at FROM public.factions WHERE is_active = true ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching factions:', error);
    res.status(500).json({ error: 'Failed to fetch factions' });
  }
});

export default router;

