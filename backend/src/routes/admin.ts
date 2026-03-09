import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { authMiddleware, moderatorOrAdminMiddleware, AuthRequest } from '../middleware/auth.js';
import { calculateNewRating, calculateTrend } from '../utils/elo.js';
import { unlockAccount } from '../services/accountLockout.js';
import { logAuditEvent, getUserIP, getUserAgent } from '../middleware/audit.js';
import { notifyUserUnlocked } from '../services/discord.js';
import { performGlobalStatsRecalculation } from './matches.js';

const router = Router();

// Get all users
router.get('/users', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const result = await query(
      `SELECT id, nickname, language, discord_id, is_admin, is_active, is_blocked, is_rated, elo_rating, matches_played, total_wins, total_losses, created_at, updated_at
       FROM users_extension 
       WHERE id != '00000000-0000-0000-0000-000000000000'
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', details: (error as any).message });
  }
});

// Block user (duplicate removed — canonical endpoint below, after FAQ)

router.post('/users/:id/unlock', moderatorOrAdminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const ip = getUserIP(req);

    if (process.env.BACKEND_DEBUG_LOGS === 'true') {
      console.log('🔓 [UNLOCK ENDPOINT] Called for user ID:', id);
    }

    // Get user info for logging and Discord notifications
    const userInfo = await query('SELECT nickname, discord_id, is_admin FROM users_extension WHERE id = ?', [id]);
    if (userInfo.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userInfo.rows[0];

    if (user.is_admin) {
      return res.status(403).json({ error: 'Cannot unblock an admin user' });
    }

    // Unlock account - reset failed attempts and unblock
    await unlockAccount(id);
    await query('UPDATE users_extension SET is_blocked = 0 WHERE id = ?', [id]);

    if (process.env.BACKEND_DEBUG_LOGS === 'true') {
      console.log('✅ User unlocked and unblocked:', user.nickname);
    }

    // Send Discord notification if enabled
    try {
      await notifyUserUnlocked({ nickname: user.nickname, discord_id: user.discord_id });
    } catch (discordError) {
      console.error('Discord notification error (unlock):', discordError);
    }

    await logAuditEvent({
      event_type: 'USER_UNBLOCKED',
      user_id: req.userId,
      ip_address: ip,
      user_agent: getUserAgent(req),
      details: { target_user_id: id, target_nickname: user.nickname }
    });

    res.json({ message: 'Account unlocked successfully' });
  } catch (error) {
    console.error('Unlock account error:', error);
    res.status(500).json({ error: 'Failed to unlock account' });
  }
});

// =============================
// User management endpoints
// =============================

// Create news (multi-language)
// Body: { en: {title, content}, es: {title, content}, zh: {title, content}, de: {title, content}, ru: {title, content} }
router.post('/news', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const languages = ['en', 'es', 'zh', 'de', 'ru'];
    
    // English is required
    const enData = req.body.en;
    if (!enData || !enData.title || !enData.content) {
      return res.status(400).json({ error: 'English title and content are required' });
    }

    const createdNewsId = uuidv4();
    for (const lang of languages) {
      const langData = req.body[lang];
      // Skip languages that are not provided (except English which is required)
      if (!langData || !langData.title || !langData.content) {
        continue;
      }

      await query(
        `INSERT INTO news (id, title, content, language_code, author_id, published_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [createdNewsId, langData.title, langData.content, lang, req.userId]
      );
    }

    res.status(201).json({ id: createdNewsId });
  } catch (error: any) {
    console.error('News creation error:', error);
    res.status(500).json({ error: 'Failed to create news', details: error.message });
  }
});

// Update news (multi-language)
// Body: { en: {title, content}, es: {title, content}, ... }
router.put('/news/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const languages = ['en', 'es', 'zh', 'de', 'ru'];

    // English is required
    const enData = req.body.en;
    if (!enData || !enData.title || !enData.content) {
      return res.status(400).json({ error: 'English title and content are required' });
    }

    // Update existing news for each language (preserving created_at, published_at, and updating only updated_at)
    for (const lang of languages) {
      const langData = req.body[lang];
      // Skip languages that are not provided (except English which is required)
      if (!langData || !langData.title || !langData.content) {
        continue;
      }

      // Check if record exists for this language
      const existsResult = await query(
        `SELECT id FROM news WHERE id = ? AND language_code = ?`,
        [id, lang]
      );

      if (existsResult.rows.length > 0) {
        // Update existing record, only updating title, content, and updated_at
        await query(
          `UPDATE news 
           SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND language_code = ?`,
          [langData.title, langData.content, id, lang]
        );
      } else {
        // Insert new language version (if it doesn't exist)
        await query(
          `INSERT INTO news (id, title, content, language_code, author_id, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [id, langData.title, langData.content, lang, req.userId]
        );
      }
    }

    res.json({ message: 'News updated' });
  } catch (error: any) {
    console.error('News update error:', error);
    res.status(500).json({ error: 'Failed to update news', details: error.message });
  }
});

// Delete news (deletes all language versions)
router.delete('/news/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM news WHERE id = ?', [id]);
    res.json({ message: 'News deleted' });
  } catch (error) {
    console.error('News delete error:', error);
    res.status(500).json({ error: 'Failed to delete news' });
  }
});

// Get all news/announcements
router.get('/news', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT n.id, n.title, n.content, n.published_at, n.language_code, u.nickname as author 
       FROM news n
       LEFT JOIN users_extension u ON n.author_id = u.id
       ORDER BY n.published_at DESC, n.language_code ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// Get FAQ
router.get('/faq', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, question, answer, language_code, "order", created_at FROM faq ORDER BY "order" ASC, created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FAQ' });
  }
});

// Create FAQ entry - accepts all 5 languages in single request
router.post('/faq', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { en, es, zh, de, ru } = req.body;

    // Validate that English is required
    if (!en || !en.question || !en.answer) {
      return res.status(400).json({ error: 'English question and answer are required' });
    }

    // Generate a single ID for all language versions
    const faqId = uuidv4();
    
    const languages = [
      { code: 'en', data: en },
      { code: 'es', data: es },
      { code: 'zh', data: zh },
      { code: 'de', data: de },
      { code: 'ru', data: ru }
    ];

    // Create records for all languages provided (English is guaranteed)
    for (const lang of languages) {
      if (lang.data && lang.data.question && lang.data.answer) {
        if (lang.code === 'en') {
          await query(
            `INSERT INTO faq (id, question, answer, language_code, \`order\`) VALUES (?, ?, ?, ?, ?)`,
            [faqId, lang.data.question, lang.data.answer, lang.code, lang.data.order ? Number(lang.data.order) : 0]
          );
        } else {
          await query(
            `INSERT INTO faq (id, question, answer, language_code, \`order\`) VALUES (?, ?, ?, ?, ?)`,
            [faqId, lang.data.question, lang.data.answer, lang.code, en.order ? Number(en.order) : 0]
          );
        }
      }
    }

    // Return the created FAQ ID
    res.status(201).json({ id: faqId, message: 'FAQ created' });
  } catch (error) {
    console.error('FAQ creation error:', error);
    res.status(500).json({ error: 'Failed to create FAQ entry', details: (error as any).message });
  }
});

// Update FAQ entry - accepts all 5 languages and replaces all records
router.put('/faq/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { en, es, zh, de, ru } = req.body;

    // Validate that English is required
    if (!en || !en.question || !en.answer) {
      return res.status(400).json({ error: 'English question and answer are required' });
    }

    // Delete all existing records for this FAQ ID
    await query(`DELETE FROM faq WHERE id = ?`, [id]);

    const languages = [
      { code: 'en', data: en },
      { code: 'es', data: es },
      { code: 'zh', data: zh },
      { code: 'de', data: de },
      { code: 'ru', data: ru }
    ];

    // Create records for all languages provided (English is guaranteed)
    for (const lang of languages) {
      if (lang.data && lang.data.question && lang.data.answer) {
        if (lang.code === 'en') {
          await query(
            `INSERT INTO faq (id, question, answer, language_code, \`order\`) VALUES (?, ?, ?, ?, ?)`,
            [id, lang.data.question, lang.data.answer, lang.code, lang.data.order ? Number(lang.data.order) : 0]
          );
        } else {
          await query(
            `INSERT INTO faq (id, question, answer, language_code, \`order\`) VALUES (?, ?, ?, ?, ?)`,
            [id, lang.data.question, lang.data.answer, lang.code, en.order ? Number(en.order) : 0]
          );
        }
      }
    }

    res.json({ id, message: 'FAQ updated' });
  } catch (error) {
    console.error('FAQ update error:', error);
    res.status(500).json({ error: 'Failed to update FAQ entry', details: (error as any).message });
  }
});

// Delete FAQ entry
router.delete('/faq/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM faq WHERE id = ?', [id]);
    res.json({ message: 'FAQ entry deleted' });
  } catch (error) {
    console.error('FAQ delete error:', error);
    res.status(500).json({ error: 'Failed to delete FAQ entry', details: (error as any).message });
  }
});

// Block user — accessible to admins and tournament moderators (cannot block admins)
router.post('/users/:id/block', moderatorOrAdminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const target = await query(`SELECT id, nickname, is_admin FROM users_extension WHERE id = ?`, [id]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    if (target.rows[0].is_admin) return res.status(403).json({ error: 'Cannot block an admin user' });

    await query(`UPDATE users_extension SET is_blocked = 1 WHERE id = ?`, [id]);

    await logAuditEvent({
      event_type: 'USER_BLOCKED',
      user_id: req.userId,
      ip_address: getUserIP(req),
      user_agent: getUserAgent(req),
      details: { target_user_id: id, target_nickname: target.rows[0].nickname }
    });

    const result = await query(`SELECT id, nickname, is_blocked, is_admin FROM users_extension WHERE id = ?`, [id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Make user admin
router.post('/users/:id/make-admin', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query(`UPDATE users_extension SET is_admin = 1 WHERE id = ?`, [id]);
    const result = await query(`SELECT id, nickname, is_blocked, is_admin FROM users_extension WHERE id = ?`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to make user admin' });
  }
});

// Remove admin
router.post('/users/:id/remove-admin', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query(`UPDATE users_extension SET is_admin = 0 WHERE id = ?`, [id]);
    const result = await query(`SELECT id, nickname, is_blocked, is_admin FROM users_extension WHERE id = ?`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove admin' });
  }
});

// Delete user
router.delete('/users/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM users_extension WHERE id = ?', [id]);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * DEBUG ENDPOINT: Faction Map Statistics Diagnosis
 */
router.get('/debug/faction-map-stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    console.log('🔍 Starting Faction Map Statistics Diagnosis...\n');

    // 1. Count total matches
    const matchesCount = await query(`
      SELECT 
        COUNT(*) as total_matches,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_matches,
        SUM(CASE WHEN status = 'unconfirmed' THEN 1 ELSE 0 END) as unconfirmed_matches,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_matches
      FROM matches
    `);
    console.log('📊 Matches Summary:');
    console.log(matchesCount.rows[0]);

    // 2. Count faction_map_statistics records
    const statsCount = await query(`
      SELECT 
        COUNT(*) as total_records,
        CEIL(SUM(total_games) / 2.0) as estimated_matches,
        SUM(total_games) as total_games_sum,
        MIN(total_games) as min_games,
        MAX(total_games) as max_games,
        AVG(total_games) as avg_games
      FROM faction_map_statistics
    `);
    console.log('\n📈 Statistics Table Summary:');
    console.log(statsCount.rows[0]);

    // 3. Find matches NOT in statistics
    const missingMatches = await query(`
      SELECT 
        COUNT(*) as missing_count
      FROM matches m
      WHERE m.status != 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM faction_map_statistics fms
          JOIN game_maps gm ON fms.map_id = gm.id
          JOIN factions f_winner ON fms.faction_id = f_winner.id
          JOIN factions f_loser ON fms.opponent_faction_id = f_loser.id
          WHERE gm.name = m.map 
            AND f_winner.name = m.winner_faction 
            AND f_loser.name = m.loser_faction
        )
    `);
    console.log('\n🔴 Missing from Statistics:');
    console.log(missingMatches.rows[0]);

    // 4. Faction distribution
    const factionDist = await query(`
      SELECT 
        f.name as faction,
        COUNT(DISTINCT fms.id) as matchups,
        SUM(fms.total_games) as games,
        SUM(fms.wins) as wins,
        ROUND(100.0 * SUM(fms.wins) / SUM(fms.total_games), 2) as winrate
      FROM faction_map_statistics fms
      JOIN factions f ON fms.faction_id = f.id
      GROUP BY f.id, f.name
      ORDER BY games DESC
    `);
    console.log('\n⚔️ Faction Distribution:');
    factionDist.rows.forEach((row: any) => {
      console.log(`  ${row.faction}: ${row.games} games, ${row.wins} wins, ${row.winrate}% WR`);
    });

    // Return summary
    const summary = {
      total_matches: matchesCount.rows[0].total_matches,
      confirmed: matchesCount.rows[0].confirmed_matches,
      unconfirmed: matchesCount.rows[0].unconfirmed_matches,
      cancelled: matchesCount.rows[0].cancelled_matches,
      stats_records: statsCount.rows[0].total_records,
      estimated_stats_matches: Math.ceil(statsCount.rows[0].estimated_matches),
      missing_count: missingMatches.rows[0]?.missing_count || 0,
      status: 'DIAGNOSIS_COMPLETE'
    };

    res.json(summary);
  } catch (error) {
    console.error('❌ Diagnosis error:', error);
    res.status(500).json({ error: 'Diagnosis failed', details: String(error) });
  }
});

// Recalculate all stats from scratch (global replay of all non-cancelled matches)
router.post('/recalculate-all-stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Verify admin status
    const adminResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (process.env.BACKEND_DEBUG_LOGS === 'true') {
      console.log(`🔄 Starting global stats recalculation by admin ${req.userId}`);
    }

    // Call the centralized recalculation function (handles ELO, player stats, faction/map stats, snapshots)
    const recalcResult = await performGlobalStatsRecalculation();

    // Log the results
    if (process.env.BACKEND_DEBUG_LOGS === 'true') {
      console.log(`Global stats recalculation completed: ${recalcResult.success ? 'SUCCESS' : 'WITH ERRORS'}`);
      recalcResult.logs.forEach(log => console.log(log));
    }

    // Calculate player of the month for the previous month
    try {
      const { calculatePlayerOfMonth } = await import('../jobs/playerOfMonthJob.js');
      if (process.env.BACKEND_DEBUG_LOGS === 'true') {
        console.log('🎯 Recalculating player of month...');
      }
      await calculatePlayerOfMonth();
      if (process.env.BACKEND_DEBUG_LOGS === 'true') {
        console.log('✅ Player of month recalculated successfully');
      }
    } catch (error: any) {
      if (process.env.BACKEND_DEBUG_LOGS === 'true') {
        console.error('⚠️  Warning: Failed to recalculate player of month:', error.message);
      }
      // Don't fail the entire operation if player of month calculation fails
    }

    res.json({
      message: 'Global stats recalculation completed successfully',
      success: recalcResult.success,
      matchesProcessed: recalcResult.matchesProcessed,
      usersUpdated: recalcResult.usersUpdated,
      debugLogs: recalcResult.logs
    });
  } catch (error) {
    console.error('Global stats recalculation error:', error);
    res.status(500).json({ error: 'Failed to recalculate stats' });
  }
});

// Get audit logs — accessible to admins and tournament moderators
router.get('/audit-logs', moderatorOrAdminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { eventType, username, ipAddress, daysBack = 7 } = req.query;

    // Build WHERE clause
    let whereConditions: string[] = [];
    let params: any[] = [];

    // Filter by date range
    whereConditions.push(`created_at >= DATE_SUB(NOW(), INTERVAL ${parseInt(daysBack as string) || 7} DAY)`);

    if (eventType) {
      whereConditions.push(`event_type = ?`);
      params.push(eventType);
    }

    if (username) {
      whereConditions.push(`username LIKE ?`);
      params.push(`%${username}%`);
    }

    if (ipAddress) {
      whereConditions.push(`ip_address = ?`);
      params.push(ipAddress);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT id, event_type, user_id, username, ip_address, user_agent, details, created_at
       FROM audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 1000`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Audit logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Delete selected audit logs
router.delete('/audit-logs', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const adminCheck = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Only admins can delete audit logs' });
    }

    const { logIds } = req.body;

    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({ error: 'No log IDs provided' });
    }

    // Delete logs with proper parameterized query
    const placeholders = logIds.map(() => '?').join(',');
    await query(
      `DELETE FROM audit_logs WHERE id IN (${placeholders})`,
      logIds
    );

    // Log this admin action
    await logAuditEvent({
      event_type: 'ADMIN_ACTION',
      user_id: req.userId,
      ip_address: getUserIP(req),
      user_agent: getUserAgent(req),
      details: { action: 'delete_audit_logs', count: logIds.length }
    });

    res.json({ message: `Deleted ${logIds.length} audit log(s)` });
  } catch (error) {
    console.error('Audit logs delete error:', error);
    res.status(500).json({ error: 'Failed to delete audit logs' });
  }
});

// Delete old audit logs (older than X days)
router.delete('/audit-logs/old', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const adminCheck = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Only admins can delete audit logs' });
    }

    const { daysBack = 30 } = req.body;

    if (daysBack < 1) {
      return res.status(400).json({ error: 'daysBack must be at least 1' });
    }

    // Get count before deletion
    const countBefore = await query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ${daysBack} DAY)`
    );

    // Delete old logs
    await query(
      `DELETE FROM audit_logs 
       WHERE created_at < DATE_SUB(NOW(), INTERVAL ${daysBack} DAY)`
    );

    const deletedCount = parseInt(countBefore.rows[0].count);

    // Log this admin action
    await logAuditEvent({
      event_type: 'ADMIN_ACTION',
      user_id: req.userId,
      ip_address: getUserIP(req),
      user_agent: getUserAgent(req),
      details: { action: 'delete_old_audit_logs', daysBack, count: deletedCount }
    });

    res.json({ message: `Deleted ${deletedCount} old audit log(s)` });
  } catch (error) {
    console.error('Audit logs cleanup error:', error);
    res.status(500).json({ error: 'Failed to delete old audit logs' });
  }
});

// List replays with filtering — accessible to admins and tournament moderators
router.get('/replays', moderatorOrAdminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const params: any[] = [];
    let where = '';
    if (status) {
      where = 'WHERE parse_status = ?';
      params.push(status);
    }
    const result = await query(
      `SELECT id, replay_filename, parse_status, game_id, match_type, error_message, created_at, updated_at
       FROM replays ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );
    res.json({ replays: result.rows });
  } catch (error) {
    console.error('List replays error:', error);
    res.status(500).json({ error: 'Failed to fetch replays' });
  }
});

// Force-discard an unprocessed replay — accessible to admins and tournament moderators
router.post('/replays/:replayId/force-discard', moderatorOrAdminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { replayId } = req.params;

    const replayResult = await query(
      `SELECT id, parse_status, replay_filename FROM replays WHERE id = ?`,
      [replayId]
    );
    if (replayResult.rows.length === 0) {
      return res.status(404).json({ error: 'Replay not found' });
    }

    const replay = replayResult.rows[0];
    const allowedStatuses = ['new', 'parsed', 'error'];
    if (!allowedStatuses.includes(replay.parse_status)) {
      return res.status(400).json({
        error: `Cannot discard replay with status '${replay.parse_status}'. Allowed: ${allowedStatuses.join(', ')}`
      });
    }

    await query(`UPDATE replays SET parse_status = 'rejected', updated_at = NOW() WHERE id = ?`, [replayId]);

    await logAuditEvent({
      event_type: 'REPLAY_FORCE_DISCARDED',
      user_id: req.userId,
      ip_address: getUserIP(req),
      user_agent: getUserAgent(req),
      details: { replay_id: replayId, filename: replay.replay_filename, previous_status: replay.parse_status }
    });

    res.json({ status: 'success', message: 'Replay force-discarded', replay_id: replayId });
  } catch (error) {
    console.error('Force discard replay error:', error);
    res.status(500).json({ error: 'Failed to discard replay' });
  }
});

// ============================================================
// MAPS MANAGEMENT
// ============================================================

// Get all maps
router.get('/maps', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const result = await query(`
      SELECT 
        id,
        name,
        is_active,
        is_ranked,
        created_at
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
router.get('/maps/:mapId/translations', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { mapId } = req.params;
    const result = await query(`
      SELECT * FROM map_translations
      WHERE map_id = ?
      ORDER BY language_code
    `, [mapId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching map translations:', error);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

// Create new map
router.post('/maps', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { name, description, language_code, is_active, is_ranked } = req.body;
    
    if (!name || !language_code) {
      return res.status(400).json({ error: 'Name and language_code are required' });
    }

    // Create map
    const mapId = uuidv4();
    await query(`
      INSERT INTO game_maps (id, name, is_active, is_ranked)
      VALUES (?, ?, ?, ?)
    `, [mapId, name, is_active === undefined ? 1 : (is_active ? 1 : 0), is_ranked === undefined ? 1 : (is_ranked ? 1 : 0)]);

    // Create translation
    await query(`
      INSERT INTO map_translations (map_id, language_code, name, description)
      VALUES (?, ?, ?, ?)
    `, [mapId, language_code, name, description || null]);

    const mapResult = await query(`
      SELECT id, name, is_active, is_ranked, created_at FROM game_maps WHERE id = ?
    `, [mapId]);
    res.json(mapResult.rows[0]);
  } catch (error) {
    console.error('Error creating map:', error);
    res.status(500).json({ error: 'Failed to create map' });
  }
});

// Update map status
router.patch('/maps/:mapId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { mapId } = req.params;
    const { is_active, is_ranked } = req.body;

    await query(`
      UPDATE game_maps
      SET 
        is_active = COALESCE(?, is_active),
        is_ranked = COALESCE(?, is_ranked)
      WHERE id = ?
    `, [
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      is_ranked !== undefined ? (is_ranked ? 1 : 0) : null,
      mapId
    ]);

    const result = await query(`
      SELECT id, name, is_active, is_ranked, created_at FROM game_maps WHERE id = ?
    `, [mapId]);

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
router.post('/maps/:mapId/translations', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { mapId } = req.params;
    const { language_code, name, description } = req.body;

    if (!language_code || !name) {
      return res.status(400).json({ error: 'language_code and name are required' });
    }

    await query(`
      INSERT INTO map_translations (map_id, language_code, name, description)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `, [mapId, language_code, name, description || null]);

    const result = await query(`
      SELECT id, map_id, language_code, name, description FROM map_translations WHERE map_id = ? AND language_code = ?
    `, [mapId, language_code]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding translation:', error);
    res.status(500).json({ error: 'Failed to add translation' });
  }
});

// Delete map
router.delete('/maps/:mapId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { mapId } = req.params;

    // Check if map is being used
    const usageResult = await query(`
      SELECT COUNT(*) as count FROM matches WHERE map = (SELECT name FROM game_maps WHERE id = ?)
    `, [mapId]);

    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete map that has been used in matches' });
    }

    await query('DELETE FROM game_maps WHERE id = ?', [mapId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting map:', error);
    res.status(500).json({ error: 'Failed to delete map' });
  }
});

// ============================================================
// FACTIONS MANAGEMENT
// ============================================================

// Get all factions
router.get('/factions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const result = await query(`
      SELECT 
        id,
        name,
        is_active,
        is_ranked,
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
router.get('/factions/:factionId/translations', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { factionId } = req.params;
    const result = await query(`
      SELECT * FROM faction_translations
      WHERE faction_id = ?
      ORDER BY language_code
    `, [factionId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching faction translations:', error);
    res.status(500).json({ error: 'Failed to fetch translations' });
  }
});

// Create new faction
router.post('/factions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { name, description, language_code, is_active, is_ranked } = req.body;
    
    if (!name || !language_code) {
      return res.status(400).json({ error: 'Name and language_code are required' });
    }

    // Create faction
    const factionId = uuidv4();
    await query(`
      INSERT INTO factions (id, name, is_active, is_ranked)
      VALUES (?, ?, ?, ?)
    `, [factionId, name, is_active === undefined ? 1 : (is_active ? 1 : 0), is_ranked === undefined ? 1 : (is_ranked ? 1 : 0)]);

    // Create translation
    await query(`
      INSERT INTO faction_translations (faction_id, language_code, name, description)
      VALUES (?, ?, ?, ?)
    `, [factionId, language_code, name, description || null]);

    const factionResult = await query(`
      SELECT id, name, is_active, is_ranked, created_at FROM factions WHERE id = ?
    `, [factionId]);
    res.json(factionResult.rows[0]);
  } catch (error) {
    console.error('Error creating faction:', error);
    res.status(500).json({ error: 'Failed to create faction' });
  }
});

// Update faction status
router.patch('/factions/:factionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { factionId } = req.params;
    const { is_active, is_ranked } = req.body;

    await query(`
      UPDATE factions
      SET 
        is_active = COALESCE(?, is_active),
        is_ranked = COALESCE(?, is_ranked)
      WHERE id = ?
    `, [
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      is_ranked !== undefined ? (is_ranked ? 1 : 0) : null,
      factionId
    ]);

    const result = await query(`
      SELECT id, name, is_active, is_ranked, created_at FROM factions WHERE id = ?
    `, [factionId]);

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
router.post('/factions/:factionId/translations', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { factionId } = req.params;
    const { language_code, name, description } = req.body;

    if (!language_code || !name) {
      return res.status(400).json({ error: 'language_code and name are required' });
    }

    await query(`
      INSERT INTO faction_translations (faction_id, language_code, name, description)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `, [factionId, language_code, name, description || null]);

    const result = await query(`
      SELECT id, faction_id, language_code, name, description FROM faction_translations WHERE faction_id = ? AND language_code = ?
    `, [factionId, language_code]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding translation:', error);
    res.status(500).json({ error: 'Failed to add translation' });
  }
});

// Delete faction
router.delete('/factions/:factionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { factionId } = req.params;

    // Check if faction is being used
    const usageResult = await query(`
      SELECT COUNT(*) as count FROM matches 
      WHERE winner_faction = (SELECT name FROM factions WHERE id = ?)
      OR loser_faction = (SELECT name FROM factions WHERE id = ?)
    `, [factionId, factionId]);

    if (parseInt(usageResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete faction that has been used in matches' });
    }

    await query('DELETE FROM factions WHERE id = ?', [factionId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting faction:', error);
    res.status(500).json({ error: 'Failed to delete faction' });
  }
});

// ===== RECALCULATE BALANCE EVENT SNAPSHOTS =====
router.post('/recalculate-snapshots', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { eventId, recreateAll } = req.body;

    console.log('🟡 Starting balance event snapshots recalculation');
    console.log('Parameters:', { eventId, recreateAll });

    // Call TypeScript function to recalculate snapshots
    const { recalculateBalanceEventSnapshots } = await import('../services/statisticsCalculator.js');
    const tsResult = await recalculateBalanceEventSnapshots(recreateAll === true);

    console.log('🟢 Balance event snapshots recalculated');

    res.json({
      success: true,
      message: 'Balance event snapshots recalculated successfully',
      totalEventsProcessed: tsResult.balance_events_updated,
      totalSnapshotsCreated: tsResult.snapshots_created,
      recreatedAll: recreateAll
    });
  } catch (error) {
    console.error('🔴 ERROR recalculating balance event snapshots:', error);
    res.status(500).json({
      error: 'Failed to recalculate balance event snapshots',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get player of the month (calculated at start of each month via cron job)
router.get('/player-of-month', async (req, res) => {
  try {
    console.log('🔍 GET /admin/player-of-month called');
    
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthYearStr = prevMonthStart.toISOString().split('T')[0];
    
    console.log(`📊 Looking for month_year: ${monthYearStr}`);

    const result = await query(
      `SELECT player_id, nickname, elo_rating, ranking_position, elo_gained, positions_gained, month_year, calculated_at
       FROM player_of_month
       WHERE month_year = ?`,
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

// Manually trigger player of month calculation (admin only)
router.post('/calculate-player-of-month', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Verify admin status
    const adminResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { calculatePlayerOfMonth } = await import('../jobs/playerOfMonthJob.js');
    await calculatePlayerOfMonth();

    res.json({ message: 'Player of month calculation triggered successfully' });
  } catch (error) {
    console.error('Error calculating player of month:', error);
    res.status(500).json({
      error: 'Failed to calculate player of month',
      details: (error as any).message
    });
  }
});

// ============================================================================
// UNRANKED TOURNAMENTS ENDPOINTS
// ============================================================================

// Get all unranked factions
router.get('/unranked-factions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Allow any authenticated user to view ALL factions (ranked and unranked)
    // for creating tournaments. Unranked tournaments can use any faction.
    const { search } = req.query;
    let query_str = `
      SELECT 
        f.id,
        f.name,
        f.is_ranked,
        f.created_at,
        COUNT(DISTINCT tuf.tournament_id) as used_in_tournaments
      FROM factions f
      LEFT JOIN tournament_unranked_factions tuf ON f.id = tuf.faction_id
    `;

    const params = [];
    if (search) {
      query_str += ` WHERE f.name LIKE ?`;
      params.push(`%${search}%`);
    }

    query_str += ` GROUP BY f.id ORDER BY f.created_at DESC`;

    const result = await query(query_str, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching unranked factions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unranked factions' });
  }
});

// Create new unranked faction (any authenticated user can create, always as unranked)
router.post('/unranked-factions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0 || name.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Faction name is required and must be 1-100 characters'
      });
    }

    // Check if faction name already exists
    const existing = await query(
      'SELECT id FROM factions WHERE LOWER(name) = LOWER(?)',
      [name]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'A faction with this name already exists'
      });
    }

    const newFactionId = uuidv4();
    await query(
      `INSERT INTO factions (id, name, is_active, is_ranked)
       VALUES (?, ?, 1, 0)`,
      [newFactionId, name]
    );
    const result = await query(
      `SELECT id, name, is_ranked, created_at FROM factions WHERE id = ?`,
      [newFactionId]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating unranked faction:', error);
    res.status(500).json({ success: false, error: 'Failed to create unranked faction' });
  }
});

// Get faction usage (before delete)
router.get('/unranked-factions/:id/usage', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userResult = await query(
      'SELECT is_admin FROM users_extension WHERE id = ?',
      [req.userId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;

    // Get faction info
    const factionResult = await query(
      'SELECT id, name FROM factions WHERE id = ? AND is_ranked = 0',
      [id]
    );
    if (factionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Faction not found' });
    }

    const faction = factionResult.rows[0];

    // Get active tournaments using this faction
    const activeTournaments = await query(
      `SELECT DISTINCT t.id, t.name, t.status
       FROM tournaments t
       JOIN tournament_unranked_factions tuf ON t.id = tuf.tournament_id
       WHERE tuf.faction_id = ?
       AND t.status IN ('CREATED', 'REGISTRATION_OPEN', 'STARTED', 'MATCHES_ONGOING')
       ORDER BY t.created_at DESC`,
      [id]
    );

    // Get completed tournaments using this faction
    const completedTournaments = await query(
      `SELECT DISTINCT t.id, t.name, t.status
       FROM tournaments t
       JOIN tournament_unranked_factions tuf ON t.id = tuf.tournament_id
       WHERE tuf.faction_id = ?
       AND t.status IN ('COMPLETED', 'CANCELLED', 'CANCELLED_IN_PROGRESS')
       ORDER BY t.created_at DESC`,
      [id]
    );

    const total = activeTournaments.rows.length + completedTournaments.rows.length;

    res.json({
      success: true,
      data: {
        faction_id: faction.id,
        faction_name: faction.name,
        total_tournaments_using: total,
        active_tournaments: activeTournaments.rows,
        completed_tournaments: completedTournaments.rows,
        can_delete: activeTournaments.rows.length === 0,
        reason:
          activeTournaments.rows.length > 0
            ? `In use by ${activeTournaments.rows.length} active tournament(s)`
            : 'No active tournaments using this faction'
      }
    });
  } catch (error) {
    console.error('Error fetching faction usage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch faction usage' });
  }
});

// Delete unranked faction (admin only, validates not in active tournaments)
router.delete('/unranked-factions/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userResult = await query(
      'SELECT is_admin FROM users_extension WHERE id = ?',
      [req.userId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;

    // Check if faction exists
    const factionResult = await query(
      'SELECT id, name FROM factions WHERE id = ?',
      [id]
    );
    if (factionResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Faction not found' });
    }

    // Check for active tournaments
    const activeTournaments = await query(
      `SELECT t.id, t.name, t.status
       FROM tournaments t
       JOIN tournament_unranked_factions tuf ON t.id = tuf.tournament_id
       WHERE tuf.faction_id = ?
       AND t.status IN ('CREATED', 'REGISTRATION_OPEN', 'STARTED', 'MATCHES_ONGOING')`,
      [id]
    );

    if (activeTournaments.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'FACTION_IN_ACTIVE_TOURNAMENTS',
        message: `Cannot delete faction - in use by ${activeTournaments.rows.length} active tournament(s)`,
        data: { active_tournaments: activeTournaments.rows }
      });
    }

    // Delete faction (cascade will remove associations)
    await query('DELETE FROM factions WHERE id = ?', [id]);

    res.json({ success: true, message: 'Faction deleted successfully' });
  } catch (error) {
    console.error('Error deleting unranked faction:', error);
    res.status(500).json({ success: false, error: 'Failed to delete unranked faction' });
  }
});

// Get all unranked maps
router.get('/unranked-maps', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Allow any authenticated user to view ALL maps (ranked and unranked)
    // for creating tournaments. Unranked tournaments can use any map.
    const { search } = req.query;
    let query_str = `
      SELECT 
        m.id,
        m.name,
        m.is_ranked,
        m.created_at,
        COUNT(DISTINCT tum.tournament_id) as used_in_tournaments
      FROM game_maps m
      LEFT JOIN tournament_unranked_maps tum ON m.id = tum.map_id
    `;

    const params = [];
    if (search) {
      query_str += ` WHERE m.name LIKE ?`;
      params.push(`%${search}%`);
    }

    query_str += ` GROUP BY m.id ORDER BY m.created_at DESC`;

    const result = await query(query_str, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching unranked maps:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unranked maps' });
  }
});

// Create new unranked map
// Create new unranked map (any authenticated user can create, always as unranked)
router.post('/unranked-maps', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0 || name.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Map name is required and must be 1-100 characters'
      });
    }

    // Check if map name already exists
    const existing = await query(
      'SELECT id FROM game_maps WHERE LOWER(name) = LOWER(?)',
      [name]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'A map with this name already exists'
      });
    }

    const mapId = uuidv4();
    await query(
      `INSERT INTO game_maps (id, name, is_active, is_ranked)
       VALUES (?, ?, 1, 0)`,
      [mapId, name]
    );

    const inserted = await query(
      'SELECT id, name, is_ranked, is_active, created_at FROM game_maps WHERE id = ?',
      [mapId]
    );

    res.status(201).json({
      success: true,
      data: inserted.rows[0]
    });
  } catch (error) {
    console.error('Error creating unranked map:', error);
    res.status(500).json({ success: false, error: 'Failed to create unranked map' });
  }
});

// Get map usage (before delete)
router.get('/unranked-maps/:id/usage', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userResult = await query(
      'SELECT is_admin FROM users_extension WHERE id = ?',
      [req.userId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;

    // Get map info
    const mapResult = await query(
      'SELECT id, name FROM game_maps WHERE id = ? AND is_ranked = 0',
      [id]
    );
    if (mapResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Map not found' });
    }

    const map = mapResult.rows[0];

    // Get active tournaments using this map
    const activeTournaments = await query(
      `SELECT DISTINCT t.id, t.name, t.status
       FROM tournaments t
       JOIN tournament_unranked_maps tum ON t.id = tum.tournament_id
       WHERE tum.map_id = ?
       AND t.status IN ('CREATED', 'REGISTRATION_OPEN', 'STARTED', 'MATCHES_ONGOING')
       ORDER BY t.created_at DESC`,
      [id]
    );

    // Get completed tournaments using this map
    const completedTournaments = await query(
      `SELECT DISTINCT t.id, t.name, t.status
       FROM tournaments t
       JOIN tournament_unranked_maps tum ON t.id = tum.tournament_id
       WHERE tum.map_id = ?
       AND t.status IN ('COMPLETED', 'CANCELLED', 'CANCELLED_IN_PROGRESS')
       ORDER BY t.created_at DESC`,
      [id]
    );

    const total = activeTournaments.rows.length + completedTournaments.rows.length;

    res.json({
      success: true,
      data: {
        map_id: map.id,
        map_name: map.name,
        total_tournaments_using: total,
        active_tournaments: activeTournaments.rows,
        completed_tournaments: completedTournaments.rows,
        can_delete: activeTournaments.rows.length === 0,
        reason:
          activeTournaments.rows.length > 0
            ? `In use by ${activeTournaments.rows.length} active tournament(s)`
            : 'No active tournaments using this map'
      }
    });
  } catch (error) {
    console.error('Error fetching map usage:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch map usage' });
  }
});

// Delete unranked map (admin only, validates not in active tournaments)
router.delete('/unranked-maps/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userResult = await query(
      'SELECT is_admin FROM users_extension WHERE id = ?',
      [req.userId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;

    // Check if map exists
    const mapResult = await query(
      'SELECT id, name FROM game_maps WHERE id = ?',
      [id]
    );
    if (mapResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Map not found' });
    }

    // Check for active tournaments
    const activeTournaments = await query(
      `SELECT t.id, t.name, t.status
       FROM tournaments t
       JOIN tournament_unranked_maps tum ON t.id = tum.tournament_id
       WHERE tum.map_id = ?
       AND t.status IN ('CREATED', 'REGISTRATION_OPEN', 'STARTED', 'MATCHES_ONGOING')`,
      [id]
    );

    if (activeTournaments.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'MAP_IN_ACTIVE_TOURNAMENTS',
        message: `Cannot delete map - in use by ${activeTournaments.rows.length} active tournament(s)`,
        data: { active_tournaments: activeTournaments.rows }
      });
    }

    // Delete map (cascade will remove associations)
    await query('DELETE FROM game_maps WHERE id = ?', [id]);

    res.json({ success: true, message: 'Map deleted successfully' });
  } catch (error) {
    console.error('Error deleting unranked map:', error);
    res.status(500).json({ success: false, error: 'Failed to delete unranked map' });
  }
});

// Update tournament unranked assets (factions and maps)
router.put('/tournaments/:id/unranked-assets', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { faction_ids, map_ids } = req.body;

    // Get tournament
    const tournamentResult = await query(
      `SELECT id, organizer_id, tournament_mode, status
       FROM tournaments WHERE id = ?`,
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    const tournament = tournamentResult.rows[0];

    // Check authorization (must be organizer)
    if (tournament.organizer_id !== req.userId) {
      const userResult = await query(
        'SELECT is_admin FROM users_extension WHERE id = ?',
        [req.userId]
      );
      if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
        return res.status(403).json({ success: false, error: 'Not authorized to modify this tournament' });
      }
    }

    // Validate tournament status
    if (!['CREATED', 'REGISTRATION_OPEN'].includes(tournament.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify assets after tournament starts'
      });
    }

    // Validate faction_ids
    if (!faction_ids || !Array.isArray(faction_ids) || faction_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one faction must be selected'
      });
    }

    // Validate map_ids
    if (!map_ids || !Array.isArray(map_ids) || map_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one map must be selected'
      });
    }

    // Verify all factions exist (can be ranked or unranked)
    for (const factionId of faction_ids) {
      const faction = await query(
        'SELECT id FROM factions WHERE id = ?',
        [factionId]
      );
      if (faction.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Faction ${factionId} not found`
        });
      }
    }

    // Verify all maps exist and are unranked
    for (const mapId of map_ids) {
      const map = await query(
        'SELECT id FROM game_maps WHERE id = ?',
        [mapId]
      );
      if (map.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Map ${mapId} not found`
        });
      }
    }

    // Delete existing associations
    await query('DELETE FROM tournament_unranked_factions WHERE tournament_id = ?', [id]);
    await query('DELETE FROM tournament_unranked_maps WHERE tournament_id = ?', [id]);

    // Insert new associations
    for (const factionId of faction_ids) {
      await query(
        `INSERT IGNORE INTO tournament_unranked_factions (tournament_id, faction_id)
         VALUES (?, ?)`,
        [id, factionId]
      );
    }

    for (const mapId of map_ids) {
      await query(
        `INSERT IGNORE INTO tournament_unranked_maps (tournament_id, map_id)
         VALUES (?, ?)`,
        [id, mapId]
      );
    }

    res.json({
      success: true,
      message: 'Tournament unranked assets updated successfully'
    });
  } catch (error) {
    console.error('Error updating tournament unranked assets:', error);
    res.status(500).json({ success: false, error: 'Failed to update tournament unranked assets' });
  }
});

// ============================================================================
// TEAM TOURNAMENT ENDPOINTS
// ============================================================================

// Get teams for a tournament
router.get('/tournaments/:id/teams', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Get tournament and verify organizer
    const tournResult = await query(
      'SELECT id, tournament_type, organizer_id FROM tournaments WHERE id = ?',
      [id]
    );

    if (tournResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    const tournament = tournResult.rows[0];

    if (tournament.tournament_type !== 'team') {
      return res.status(400).json({ success: false, error: 'This endpoint is for team tournaments only' });
    }

    // Verify user is tournament organizer
    if (tournament.organizer_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Only organizer can manage teams' });
    }

    // Get teams with members
    const teamsResult = await query(
      `SELECT 
        t.id, t.name, t.created_at,
        COUNT(tm.id) as member_count,
        COUNT(ts.id) as substitute_count
      FROM tournament_teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN team_substitutes ts ON t.id = ts.team_id
      WHERE t.tournament_id = ?
      GROUP BY t.id
      ORDER BY t.name`,
      [id]
    );

    // Get members for each team
    const teams = await Promise.all(teamsResult.rows.map(async (team) => {
      const membersResult = await query(
        `SELECT u.id, u.nickname, tm.position FROM team_members tm
         JOIN users_extension u ON tm.player_id = u.id
         WHERE tm.team_id = ?
         ORDER BY tm.position`,
        [team.id]
      );

      const substitutesResult = await query(
        `SELECT u.id, u.nickname FROM team_substitutes ts
         JOIN users_extension u ON ts.player_id = u.id
         WHERE ts.team_id = ?
         ORDER BY ts.substitute_order`,
        [team.id]
      );

      return {
        ...team,
        members: membersResult.rows,
        substitutes: substitutesResult.rows
      };
    }));

    res.json({ success: true, data: teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch teams' });
  }
});

// Create a team
router.post('/tournaments/:id/teams', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Team name is required' });
    }

    // Get tournament and verify organizer
    const tournResult = await query(
      'SELECT id, tournament_type, organizer_id FROM tournaments WHERE id = ?',
      [id]
    );

    if (tournResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    const tournament = tournResult.rows[0];

    if (tournament.tournament_type !== 'team') {
      return res.status(400).json({ success: false, error: 'This endpoint is for team tournaments only' });
    }

    if (tournament.organizer_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Only organizer can create teams' });
    }

    // Create team
    const teamId = uuidv4();
    await query(
      `INSERT INTO tournament_teams (id, tournament_id, name, created_by)
       VALUES (?, ?, ?, ?)`,
      [teamId, id, name.trim(), req.userId]
    );

    const teamInserted = await query(
      'SELECT id, name, created_at FROM tournament_teams WHERE id = ?',
      [teamId]
    );

    res.json({ success: true, data: teamInserted.rows[0], message: 'Team created successfully' });
  } catch (error: any) {
    console.error('Error creating team:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Team with this name already exists' });
    }
    res.status(500).json({ success: false, error: 'Failed to create team' });
  }
});

// Add member to team
router.post('/tournaments/:id/teams/:teamId/members', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id, teamId } = req.params;
    const { player_id, position } = req.body;

    if (!player_id || !position || ![1, 2].includes(position)) {
      return res.status(400).json({ success: false, error: 'Invalid player_id or position (must be 1 or 2)' });
    }

    // Verify organizer
    const tournResult = await query(
      'SELECT organizer_id FROM tournaments WHERE id = ?',
      [id]
    );

    if (tournResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    if (tournResult.rows[0].organizer_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Only organizer can add members' });
    }

    // Check if team exists and belongs to tournament
    const teamResult = await query(
      'SELECT id FROM tournament_teams WHERE id = ? AND tournament_id = ?',
      [teamId, id]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }

    // Add member
    await query(
      `INSERT INTO team_members (team_id, player_id, position)
       VALUES (?, ?, ?)`,
      [teamId, player_id, position]
    );

    res.json({ success: true, message: 'Member added successfully' });
  } catch (error: any) {
    console.error('Error adding member:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'Player is already in this team or position is taken' });
    }
    res.status(500).json({ success: false, error: 'Failed to add member' });
  }
});

// Remove member from team
router.delete('/tournaments/:id/teams/:teamId/members/:playerId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id, teamId, playerId } = req.params;

    // Verify organizer
    const tournResult = await query(
      'SELECT organizer_id FROM tournaments WHERE id = ?',
      [id]
    );

    if (tournResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    if (tournResult.rows[0].organizer_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Only organizer can remove members' });
    }

    // Remove member
    const result = await query(
      'DELETE FROM team_members WHERE team_id = ? AND player_id = ?',
      [teamId, playerId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Member not found in team' });
    }

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
});

// Add substitute to team
router.post('/tournaments/:id/teams/:teamId/substitutes', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id, teamId } = req.params;
    const { player_id } = req.body;

    if (!player_id) {
      return res.status(400).json({ success: false, error: 'player_id is required' });
    }

    // Verify organizer
    const tournResult = await query(
      'SELECT organizer_id FROM tournaments WHERE id = ?',
      [id]
    );

    if (tournResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    if (tournResult.rows[0].organizer_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Only organizer can add substitutes' });
    }

    // Add substitute
    const orderResult = await query(
      'SELECT COALESCE(MAX(substitute_order), 0) + 1 AS next_order FROM team_substitutes WHERE team_id = ?',
      [teamId]
    );
    const nextOrder = orderResult.rows[0].next_order;

    await query(
      `INSERT IGNORE INTO team_substitutes (team_id, player_id, substitute_order)
       VALUES (?, ?, ?)`,
      [teamId, player_id, nextOrder]
    );

    res.json({ success: true, message: 'Substitute added successfully' });
  } catch (error) {
    console.error('Error adding substitute:', error);
    res.status(500).json({ success: false, error: 'Failed to add substitute' });
  }
});

// Delete team
router.delete('/tournaments/:id/teams/:teamId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id, teamId } = req.params;

    // Verify organizer
    const tournResult = await query(
      'SELECT organizer_id FROM tournaments WHERE id = ?',
      [id]
    );

    if (tournResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    if (tournResult.rows[0].organizer_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Only organizer can delete teams' });
    }

    // Check if team has matches
    const matchResult = await query(
      'SELECT COUNT(*) as count FROM team_tournament_matches WHERE team_a_id = ? OR team_b_id = ?',
      [teamId]
    );

    if (matchResult.rows[0].count > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete team with matches' });
    }

    // Delete team
    const result = await query(
      'DELETE FROM tournament_teams WHERE id = ? AND tournament_id = ?',
      [teamId, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }

    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ success: false, error: 'Failed to delete team' });
  }
});

// Calculate tiebreakers (OMP, GWP, OGP) for tournament participants
// Call this after a round completes, before generating next round pairings
router.post('/tournaments/:id/calculate-tiebreakers', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    console.log(`\n🎲 [CALCULATE TIEBREAKERS] Starting tiebreaker calculation for tournament ${id}`);

    // Check if user is tournament organizer
    const tournamentResult = await query(
      'SELECT id, creator_id, tournament_mode FROM tournaments WHERE id = ?',
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    const tournament = tournamentResult.rows[0];
    if (tournament.creator_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Only tournament organizer can calculate tiebreakers' });
    }

    // Calculate tiebreakers - use appropriate function based on tournament mode
    let tiebreakersResult;
    if (tournament.tournament_mode === 'team') {
      // For team tournaments, update team tiebreakers
      tiebreakersResult = await query(
        'SELECT updated_count, error_message FROM update_team_tiebreakers(?)',
        [id]
      );
    } else {
      // For individual tournaments, update participant tiebreakers
      tiebreakersResult = await query(
        'SELECT updated_count, error_message FROM update_tournament_tiebreakers(?)',
        [id]
      );
    }

    if (tiebreakersResult.rows.length === 0) {
      return res.status(500).json({ success: false, error: 'Failed to calculate tiebreakers' });
    }

    const { updated_count, error_message } = tiebreakersResult.rows[0];
    
    if (error_message) {
      console.error(`❌ [CALCULATE TIEBREAKERS] Error: ${error_message}`);
      return res.status(500).json({ success: false, error: error_message });
    }

    console.log(`✅ [CALCULATE TIEBREAKERS] Calculated tiebreakers for ${updated_count} ${tournament.tournament_mode === 'team' ? 'teams' : 'participants'}`);
    
    res.json({
      success: true,
      message: `Tiebreakers calculated for ${updated_count} participants`,
      updated_count
    });
  } catch (error) {
    console.error('Error calculating tiebreakers:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate tiebreakers' });
  }
});

// ============================================================================
// MAINTENANCE MODE ENDPOINTS
// ============================================================================

/**
 * Get current maintenance mode status
 * Public endpoint - anyone can check if maintenance is active
 */
router.get('/maintenance-status', async (req, res) => {
  try {
    const result = await query(
      'SELECT setting_value FROM system_settings WHERE setting_key = ?',
      ['maintenance_mode']
    );

    const isMaintenanceMode = result.rows.length > 0 && result.rows[0].setting_value === 'true';
    res.json({ maintenance_mode: isMaintenanceMode });
  } catch (error) {
    console.error('Error fetching maintenance status:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance status' });
  }
});

/**
 * Toggle maintenance mode
 * Admin only - enable/disable maintenance mode and log the change
 */
router.post('/toggle-maintenance', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can toggle maintenance mode' });
    }

    const { enable, reason } = req.body;

    // Validate input
    if (typeof enable !== 'boolean') {
      return res.status(400).json({ error: 'enable parameter must be a boolean' });
    }

    // Update maintenance mode setting
    await query(
      `UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? 
       WHERE setting_key = ?`,
      [enable ? 'true' : 'false', req.userId, 'maintenance_mode']
    );

    // Get admin nickname for logging
    const adminUser = await query('SELECT nickname FROM users_extension WHERE id = ?', [req.userId]);
    const adminNickname = adminUser.rows[0]?.nickname || 'Unknown Admin';

    const action = enable ? 'ENABLED' : 'DISABLED';
    console.log(`✅ [MAINTENANCE MODE] ${action} by ${adminNickname}. Reason: ${reason || 'None provided'}`);

    // Log audit event
    await logAuditEvent({
      event_type: 'MAINTENANCE_MODE_TOGGLE',
      user_id: req.userId,
      username: adminNickname,
      ip_address: getUserIP(req),
      user_agent: getUserAgent(req),
      details: { action, reason: reason || null, enabled: enable }
    });

    res.json({
      success: true,
      maintenance_mode: enable,
      message: `Maintenance mode ${enable ? 'enabled' : 'disabled'}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error toggling maintenance mode:', error);
    res.status(500).json({ error: 'Failed to toggle maintenance mode' });
  }
});

/**
 * Get maintenance mode history/logs via audit log
 * Admin only
 */
router.get('/maintenance-logs', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM users_extension WHERE id = ?', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access maintenance logs' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    // Get maintenance mode toggle events from audit log
    const result = await query(
      `SELECT 
        id,
        event_type,
        user_id,
        username,
        details,
        created_at
       FROM audit_logs
       WHERE event_type = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      ['MAINTENANCE_MODE_TOGGLE', limit]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance logs:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance logs' });
  }
});

export default router;

