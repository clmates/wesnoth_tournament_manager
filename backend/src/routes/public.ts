import { Router } from 'express';
import { query } from '../config/database.js';

const router = Router();

// Get FAQ (public endpoint) - returns all language versions
// Frontend will handle language selection with fallback to English
router.get('/faq', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, question, answer, language_code, created_at, "order"
       FROM public.faq
       ORDER BY "order" ASC, created_at DESC, language_code ASC`
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
      `SELECT id, nickname, elo_rating, is_rated, matches_played, total_wins, total_losses, country, avatar
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

// Get specific player profile (public endpoint)
router.get('/players/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const playerResult = await query(
      `SELECT 
        u.id, 
        u.nickname, 
        u.elo_rating, 
        u.is_rated, 
        u.matches_played, 
        u.total_wins, 
        u.total_losses, 
        u.level, 
        u.country,
        u.avatar,
        u.created_at,
        u.trend,
        u.is_active,
        pms.avg_elo_change
      FROM users u
      LEFT JOIN player_match_statistics pms ON u.id = pms.player_id 
        AND pms.opponent_id IS NULL 
        AND pms.map_id IS NULL 
        AND pms.faction_id IS NULL
      WHERE u.id = $1 AND u.is_active = true AND u.is_blocked = false`,
      [id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Get last activity from most recent match (any status except cancelled)
    const lastActivityResult = await query(
      `SELECT created_at FROM matches WHERE (winner_id = $1 OR loser_id = $1) AND status != 'cancelled' ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    console.log(`[Player ${id}] Last activity query result:`, lastActivityResult.rows);

    const result = {
      ...player,
      last_activity: lastActivityResult.rows[0]?.created_at || null
    };

    console.log(`[Player ${id}] Final result:`, result);

    res.json(result);
  } catch (error) {
    console.error('Error fetching player:', error);
    res.status(500).json({ error: 'Failed to fetch player' });
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
// Debug endpoint to verify public routes are working
router.get('/debug', (req, res) => {
  res.json({ message: 'Public routes working', timestamp: new Date().toISOString() });
});

// Get player of the month
router.get('/player-of-month', async (req, res) => {
  try {
    console.log('🔍🔍🔍 GET /public/player-of-month called START');
    
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthYearStr = prevMonthStart.toISOString().split('T')[0];
    
    console.log(`📊 Looking for month_year: ${monthYearStr}`);

    const result = await query(
      `SELECT player_id, nickname, elo_rating, ranking_position, elo_gained, positions_gained, month_year, calculated_at
       FROM player_of_month
       WHERE month_year = $1`,
      [monthYearStr]
    );

    console.log(`📊 Query returned ${result.rows.length} rows`);
    
    if (result.rows.length === 0) {
      console.log('⚠️ No player found, returning 404');
      return res.status(404).json({ error: 'No player of month data available' });
    }

    const playerData = result.rows[0];
    console.log(`✅ Returning player: ${playerData.nickname}`, playerData);
    res.json(playerData);
  } catch (error: any) {
    console.error('❌ Error in /player-of-month:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to fetch player of month',
      details: error.message
    });
  }
});

// Get tournament unranked assets (public endpoint)
router.get('/tournaments/:id/unranked-assets', async (req, res) => {
  try {
    const { id } = req.params;

    // Get tournament
    const tournamentResult = await query(
      'SELECT id, tournament_type FROM tournaments WHERE id = $1',
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    const tournament = tournamentResult.rows[0];

    // If not an unranked tournament, return empty
    if (tournament.tournament_type !== 'unranked') {
      return res.json({
        success: true,
        tournament_type: tournament.tournament_type,
        data: { factions: [], maps: [] }
      });
    }

    // Get factions for this tournament
    const factions = await query(
      `SELECT f.id, f.name
       FROM factions f
       JOIN tournament_unranked_factions tuf ON f.id = tuf.faction_id
       WHERE tuf.tournament_id = $1
       ORDER BY f.name ASC`,
      [id]
    );

    // Get maps for this tournament
    const maps = await query(
      `SELECT m.id, m.name
       FROM game_maps m
       JOIN tournament_unranked_maps tum ON m.id = tum.map_id
       WHERE tum.tournament_id = $1
       ORDER BY m.name ASC`,
      [id]
    );

    res.json({
      success: true,
      tournament_type: tournament.tournament_type,
      data: {
        factions: factions.rows,
        maps: maps.rows
      }
    });
  } catch (error) {
    console.error('Error fetching tournament unranked assets:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tournament unranked assets' });
  }
});

// Get tournament teams (public endpoint - for team tournaments)
router.get('/tournaments/:id/teams', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify tournament exists and is team tournament
    const tournResult = await query(
      'SELECT id, tournament_type FROM tournaments WHERE id = $1',
      [id]
    );

    if (tournResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    const tournament = tournResult.rows[0];

    if (tournament.tournament_type !== 'team') {
      return res.status(400).json({ success: false, error: 'This endpoint is for team tournaments only' });
    }

    // Get teams with members
    const teamsResult = await query(
      `SELECT 
        t.id, t.name,
        COUNT(tm.id) as member_count,
        COUNT(ts.id) as substitute_count
      FROM tournament_teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN team_substitutes ts ON t.id = ts.team_id
      WHERE t.tournament_id = $1
      GROUP BY t.id
      ORDER BY t.name`,
      [id]
    );

    // Get members for each team
    const teams = await Promise.all(teamsResult.rows.map(async (team) => {
      const membersResult = await query(
        `SELECT u.id, u.nickname FROM team_members tm
         JOIN users u ON tm.player_id = u.id
         WHERE tm.team_id = $1
         ORDER BY tm.position`,
        [team.id]
      );

      return {
        ...team,
        members: membersResult.rows
      };
    }));

    res.json({
      success: true,
      tournament_type: 'team',
      data: teams
    });
  } catch (error) {
    console.error('Error fetching tournament teams:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tournament teams' });
  }
});

export default router;

