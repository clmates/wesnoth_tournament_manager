import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { hashPassword } from '../utils/auth.js';

import { calculateNewRating, calculateTrend } from '../utils/elo.js';
import { unlockAccount } from '../services/accountLockout.js';
import { logAuditEvent, getUserIP, getUserAgent } from '../middleware/audit.js';
import { notifyAdminUserApproved, notifyAdminUserRejected, notifyUserUnlocked } from '../services/discord.js';

const router = Router();

// Get all users
router.get('/users', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const result = await query(
      `SELECT id, nickname, email, language, discord_id, is_admin, is_active, is_blocked, is_rated, elo_rating, matches_played, total_wins, total_losses, created_at, updated_at 
       FROM users 
       WHERE id != '00000000-0000-0000-0000-000000000000'
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get registration requests
router.get('/registration-requests', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT * FROM registration_requests 
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch registration requests' });
  }
});

// Approve registration
router.post('/registration-requests/:id/approve', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const regResult = await query('SELECT * FROM registration_requests WHERE id = $1', [id]);
    if (regResult.rows.length === 0) {
      return res.status(404).json({ error: 'Registration request not found' });
    }

    const regRequest = regResult.rows[0];
    const passwordHash = await hashPassword(password);

    // New players start with elo_rating = 1400 (FIDE standard, unrated status)
    const userResult = await query(
      `INSERT INTO users (nickname, email, language, discord_id, password_hash, is_active, is_rated, elo_rating, matches_played)
       VALUES ($1, $2, $3, $4, $5, true, false, 1400, 0)
       RETURNING id`,
      [regRequest.nickname, regRequest.email, regRequest.language, regRequest.discord_id, passwordHash]
    );

    await query(
      `UPDATE registration_requests SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 WHERE id = $2`,
      [req.userId, id]
    );

    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log(`New user created: ${regRequest.nickname} (unrated)`);
    res.json({ message: 'Registration approved', userId: userResult.rows[0].id });
  } catch (error) {
    console.error('Error approving registration:', error);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

// Reject registration
router.post('/registration-requests/:id/reject', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query(
      `UPDATE registration_requests SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $1 WHERE id = $2`,
      [req.userId, id]
    );
    res.json({ message: 'Registration rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject registration' });
  }
});

// Block user
router.post('/users/:id/block', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE users SET is_blocked = true WHERE id = $1', [id]);
    res.json({ message: 'User blocked' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock user
router.post('/users/:id/unlock', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const ip = getUserIP(req);

    // Verify user is admin
    const adminCheck = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Only admins can perform this action' });
    }

    // Get user info for logging
    const userInfo = await query('SELECT nickname FROM public.users WHERE id = $1', [id]);
    if (userInfo.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Unlock account
    await unlockAccount(id);

    // Log admin action
    await logAuditEvent({
      event_type: 'ADMIN_ACTION',
      user_id: req.userId,
      ip_address: ip,
      user_agent: getUserAgent(req),
      details: { action: 'unlock_account', target_user_id: id, target_username: userInfo.rows[0].nickname }
    });

    res.json({ message: 'Account unlocked successfully' });
  } catch (error) {
    console.error('Unlock account error:', error);
    res.status(500).json({ error: 'Failed to unlock account' });
  }
});

// Update password policy
router.put('/password-policy', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { min_length, require_uppercase, require_lowercase, require_numbers, require_symbols, previous_passwords_count } = req.body;

    await query(
      `UPDATE password_policy 
       SET min_length = $1, require_uppercase = $2, require_lowercase = $3, 
           require_numbers = $4, require_symbols = $5, previous_passwords_count = $6
       WHERE id = (SELECT id FROM password_policy LIMIT 1)`,
      [min_length, require_uppercase, require_lowercase, require_numbers, require_symbols, previous_passwords_count]
    );

    res.json({ message: 'Password policy updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update password policy' });
  }
});

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

    const createdNewsId = await (async () => {
      let newsId: string | null = null;
      
      for (const lang of languages) {
        const langData = req.body[lang];
        // Skip languages that are not provided (except English which is required)
        if (!langData || !langData.title || !langData.content) {
          continue;
        }

        const result = await query(
          `INSERT INTO public.news (title, content, language_code, author_id, published_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           RETURNING id`,
          [langData.title, langData.content, lang, req.userId]
        );

        if (!newsId) {
          newsId = result.rows[0].id;
        }
      }

      return newsId;
    })();

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

    // Delete existing news for this id in all languages
    await query('DELETE FROM public.news WHERE id = $1', [id]);

    // Re-insert with new data for each language
    for (const lang of languages) {
      const langData = req.body[lang];
      // Skip languages that are not provided (except English which is required)
      if (!langData || !langData.title || !langData.content) {
        continue;
      }

      await query(
        `INSERT INTO public.news (id, title, content, language_code, author_id, published_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [id, langData.title, langData.content, lang, req.userId]
      );
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
    await query('DELETE FROM public.news WHERE id = $1', [id]);
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
       LEFT JOIN users u ON n.author_id = u.id
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
            `INSERT INTO public.faq (id, question, answer, language_code, "order") VALUES ($1, $2, $3, $4, $5)`,
            [faqId, lang.data.question, lang.data.answer, lang.code, lang.data.order ? Number(lang.data.order) : 0]
          );
        } else {
          await query(
            `INSERT INTO public.faq (id, question, answer, language_code, "order") VALUES ($1, $2, $3, $4, $5)`,
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
    await query(`DELETE FROM public.faq WHERE id = $1`, [id]);

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
            `INSERT INTO public.faq (id, question, answer, language_code, "order") VALUES ($1, $2, $3, $4, $5)`,
            [id, lang.data.question, lang.data.answer, lang.code, lang.data.order ? Number(lang.data.order) : 0]
          );
        } else {
          await query(
            `INSERT INTO public.faq (id, question, answer, language_code, "order") VALUES ($1, $2, $3, $4, $5)`,
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
    await query('DELETE FROM public.faq WHERE id = $1', [id]);
    res.json({ message: 'FAQ entry deleted' });
  } catch (error) {
    console.error('FAQ delete error:', error);
    res.status(500).json({ error: 'Failed to delete FAQ entry', details: (error as any).message });
  }
});

// Block user
router.post('/users/:id/block', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE users SET is_blocked = true WHERE id = $1 RETURNING id, nickname, email, is_blocked, is_admin`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock user
router.post('/users/:id/unblock', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('📝 Unblock endpoint called for user ID:', id);
    
    const result = await query(
      `UPDATE users SET is_blocked = false WHERE id = $1 RETURNING id, nickname, email, is_blocked, is_admin`,
      [id]
    );

    if (result.rows.length === 0) {
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('❌ User not found:', id);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('✅ User unblocked:', user.nickname);

    // Get admin nickname for notification
    const adminResult = await query('SELECT nickname FROM users WHERE id = $1', [req.userId]);
    const adminNickname = adminResult.rows[0]?.nickname || 'Admin';

    // Get user discord_id for mention
    const userDiscordResult = await query('SELECT discord_id FROM users WHERE id = $1', [id]);
    const discord_id = userDiscordResult.rows[0]?.discord_id;

    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('📢 About to send Discord notifications for:', { nickname: user.nickname, discord_id });

    // Send Discord notifications
    await notifyAdminUserApproved({
      nickname: user.nickname,
      approvedBy: adminNickname
    });

    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('✅ Admin notification sent');

    await notifyUserUnlocked({
      nickname: user.nickname,
      discord_id
    });

    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('✅ User unlock notification sent');

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Unblock error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Make user admin
router.post('/users/:id/make-admin', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE users SET is_admin = true WHERE id = $1 RETURNING id, nickname, email, is_blocked, is_admin`,
      [id]
    );

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
    const result = await query(
      `UPDATE users SET is_admin = false WHERE id = $1 RETURNING id, nickname, email, is_blocked, is_admin`,
      [id]
    );

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
    await query('DELETE FROM public.users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Force password reset
router.post('/users/:id/force-reset-password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await hashPassword(tempPassword);

    const result = await query(
      `UPDATE users SET password_hash = $1, password_must_change = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, nickname, email`,
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Password reset', tempPassword, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Recalculate all stats from scratch (global replay of all non-cancelled matches)
router.post('/recalculate-all-stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Verify admin status
    const adminResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log(`Starting global stats recalculation by admin ${req.userId}`);

    // CRITICAL: Disable trigger to prevent automatic faction/map stats updates during this process
    // The trigger fires on UPDATE matches, which would cause double-counting
    try {
      await query('DROP TRIGGER IF EXISTS trg_update_faction_map_stats ON matches');
      await query('DROP TRIGGER IF EXISTS trg_update_player_match_stats ON matches');
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Disabled triggers: trg_update_faction_map_stats, trg_update_player_match_stats');
    } catch (error) {
      console.error('Warning: Failed to disable triggers:', error);
    }

    const defaultElo = 1400; // FIDE standard baseline for new users

    // Get ALL non-cancelled matches in chronological order
    const allNonCancelledMatches = await query(
      `SELECT m.id, m.winner_id, m.loser_id, m.created_at
       FROM matches m
       WHERE m.status IN ('confirmed', 'unconfirmed', 'pending', 'disputed')
       ORDER BY m.created_at ASC, m.id ASC`
    );

    // Initialize all users with baseline ELO and zero stats
    const userStates = new Map<string, {
      elo_rating: number;
      matches_played: number;
      total_wins: number;
      total_losses: number;
      trend: string;
    }>();

    const allUsersResult = await query('SELECT id FROM users');
    for (const userRow of allUsersResult.rows) {
      userStates.set(userRow.id, {
        elo_rating: defaultElo,
        matches_played: 0,
        total_wins: 0,
        total_losses: 0,
        trend: '-'
      });
    }

    // Replay ALL non-cancelled matches chronologically to rebuild correct stats
    for (const matchRow of allNonCancelledMatches.rows) {
      const winnerId = matchRow.winner_id;
      const loserId = matchRow.loser_id;

      // Ensure both users exist in state map
      if (!userStates.has(winnerId)) {
        userStates.set(winnerId, { elo_rating: defaultElo, matches_played: 0, total_wins: 0, total_losses: 0, trend: '-' });
      }
      if (!userStates.has(loserId)) {
        userStates.set(loserId, { elo_rating: defaultElo, matches_played: 0, total_wins: 0, total_losses: 0, trend: '-' });
      }

      const winner = userStates.get(winnerId)!;
      const loser = userStates.get(loserId)!;

      // Store before values
      const winnerEloBefore = winner.elo_rating;
      const loserEloBefore = loser.elo_rating;

      // Calculate new ratings
      const winnerNewRating = calculateNewRating(winner.elo_rating, loser.elo_rating, 'win', winner.matches_played);
      const loserNewRating = calculateNewRating(loser.elo_rating, winner.elo_rating, 'loss', loser.matches_played);

      // Update stats
      winner.elo_rating = winnerNewRating;
      loser.elo_rating = loserNewRating;
      winner.matches_played++;
      loser.matches_played++;
      winner.total_wins++;
      loser.total_losses++;
      winner.trend = calculateTrend(winner.trend, true);
      loser.trend = calculateTrend(loser.trend, false);

      // Update the match record with correct before/after ELO values
      await query(
        `UPDATE matches 
         SET winner_elo_before = $1, winner_elo_after = $2, 
             loser_elo_before = $3, loser_elo_after = $4
         WHERE id = $5`,
        [winnerEloBefore, winnerNewRating, loserEloBefore, loserNewRating, matchRow.id]
      );
    }

    // Update all users in the database with their recalculated stats
    for (const [userId, stats] of userStates.entries()) {
      // Determine is_rated status
      // Get current is_rated status from database
      const userCurrentResult = await query('SELECT is_rated FROM users WHERE id = $1', [userId]);
      const isCurrentlyRated = userCurrentResult.rows[0]?.is_rated || false;
      
      let isRated = isCurrentlyRated;
      
      // If rated and ELO falls below 1400, unrate the player
      if (isCurrentlyRated && stats.elo_rating < 1400) {
        isRated = false;
      }
      // If unrated, has 10+ matches, and ELO >= 1400, rate the player
      else if (!isCurrentlyRated && stats.matches_played >= 10 && stats.elo_rating >= 1400) {
        isRated = true;
      }
      
      await query(
        `UPDATE users 
         SET elo_rating = $1, 
             matches_played = $2,
             total_wins = $3,
             total_losses = $4,
             trend = $5,
             is_rated = $6,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $7`,
        [stats.elo_rating, stats.matches_played, stats.total_wins, stats.total_losses, stats.trend, isRated, userId]
      );
    }

    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log(`Global stats recalculation completed: ${allNonCancelledMatches.rows.length} matches replayed, ${userStates.size} users updated`);

    // Re-enable the triggers after all updates are done
    try {
      await query(`
        CREATE TRIGGER trg_update_player_match_stats
        AFTER INSERT OR UPDATE ON matches
        FOR EACH ROW
        EXECUTE FUNCTION update_player_match_statistics();
      `);
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Re-enabled trigger: trg_update_player_match_stats');
    } catch (error) {
      console.error('Warning: Failed to re-enable player match stats trigger:', error);
    }

    try {
      await query(`
        CREATE TRIGGER trg_update_faction_map_stats
        AFTER INSERT OR UPDATE ON matches
        FOR EACH ROW
        EXECUTE FUNCTION update_faction_map_statistics();
      `);
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Re-enabled trigger: trg_update_faction_map_stats');
    } catch (error) {
      console.error('Warning: Failed to re-enable faction/map stats trigger:', error);
    }

    // Recalculate player match statistics (head-to-head, opponent stats, etc.)
    try {
      await query('SELECT recalculate_player_match_statistics()');
      console.log('🟢 Player match statistics recalculated successfully');
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Player match statistics recalculated successfully');
    } catch (error: any) {
      console.error('🔴 ERROR recalculating player match statistics:', error);
      console.error('Error message:', error.message);
      // Don't fail the entire operation if player match stats fail
    }

    // Recalculate faction/map balance statistics
    try {
      const recalcResult = await query('SELECT recalculate_faction_map_statistics()');
      console.log('🟢 Faction/map statistics recalculated successfully');
      console.log('Result:', recalcResult.rows);
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Faction/map statistics recalculated successfully');
      
      // Manage snapshots: delete old ones after last event, create/update AFTER snapshot
      const snapshotResult = await query('SELECT * FROM manage_faction_map_statistics_snapshots()');
      console.log('🟢 Snapshots managed successfully');
      console.log('Snapshot Management:', snapshotResult.rows[0]);
    } catch (error: any) {
      console.error('🔴 ERROR recalculating faction/map statistics:', error);
      console.error('Error message:', error.message);
      console.error('Error code:', error.code);
      // Don't fail the entire operation if balance stats fail
    }

    // Calculate player of the month for the previous month
    try {
      const { calculatePlayerOfMonth } = await import('../jobs/playerOfMonthJob.js');
      console.log('🎯 Recalculating player of month...');
      await calculatePlayerOfMonth();
      console.log('✅ Player of month recalculated successfully');
    } catch (error: any) {
      console.error('⚠️  Warning: Failed to recalculate player of month:', error.message);
      // Don't fail the entire operation if player of month calculation fails
    }

    res.json({
      message: 'Global stats recalculation completed successfully',
      matchesProcessed: allNonCancelledMatches.rows.length,
      usersUpdated: userStates.size
    });
  } catch (error) {
    console.error('Global stats recalculation error:', error);
    res.status(500).json({ error: 'Failed to recalculate stats' });
  }
});

// Get audit logs
router.get('/audit-logs', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const adminCheck = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Only admins can access audit logs' });
    }

    const { eventType, username, ipAddress, daysBack = 7 } = req.query;

    // Build WHERE clause
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramCount = 1;

    // Filter by date range
    whereConditions.push(`created_at >= NOW() - INTERVAL '${parseInt(daysBack as string) || 7} days'`);

    if (eventType) {
      whereConditions.push(`event_type = $${paramCount}`);
      params.push(eventType);
      paramCount++;
    }

    if (username) {
      whereConditions.push(`username ILIKE $${paramCount}`);
      params.push(`%${username}%`);
      paramCount++;
    }

    if (ipAddress) {
      whereConditions.push(`ip_address = $${paramCount}`);
      params.push(ipAddress);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT id, event_type, user_id, username, ip_address, user_agent, details, created_at
       FROM public.audit_logs
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
    const adminCheck = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Only admins can delete audit logs' });
    }

    const { logIds } = req.body;

    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({ error: 'No log IDs provided' });
    }

    // Delete logs with proper parameterized query
    const placeholders = logIds.map((_, i) => `$${i + 1}`).join(',');
    await query(
      `DELETE FROM public.audit_logs WHERE id IN (${placeholders})`,
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
    const adminCheck = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Only admins can delete audit logs' });
    }

    const { daysBack = 30 } = req.body;

    if (daysBack < 1) {
      return res.status(400).json({ error: 'daysBack must be at least 1' });
    }

    // Get count before deletion
    const countBefore = await query(
      `SELECT COUNT(*) as count FROM public.audit_logs 
       WHERE created_at < NOW() - INTERVAL '${daysBack} days'`
    );

    // Delete old logs
    await query(
      `DELETE FROM public.audit_logs 
       WHERE created_at < NOW() - INTERVAL '${daysBack} days'`
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

// ============================================================
// MAPS MANAGEMENT
// ============================================================

// Get all maps
router.get('/maps', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
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
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

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
router.post('/maps', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { name, description, language_code, is_active, is_ranked } = req.body;
    
    if (!name || !language_code) {
      return res.status(400).json({ error: 'Name and language_code are required' });
    }

    // Create map
    const mapResult = await query(`
      INSERT INTO game_maps (name, is_active, is_ranked)
      VALUES ($1, $2, $3)
      RETURNING id, name, is_active, is_ranked, created_at
    `, [name, is_active === undefined ? true : is_active, is_ranked === undefined ? true : is_ranked]);

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
router.patch('/maps/:mapId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { mapId } = req.params;
    const { is_active, is_ranked } = req.body;

    const result = await query(`
      UPDATE game_maps
      SET 
        is_active = COALESCE($1, is_active),
        is_ranked = COALESCE($2, is_ranked)
      WHERE id = $3
      RETURNING id, name, is_active, is_ranked, created_at
    `, [
      is_active !== undefined ? is_active : null,
      is_ranked !== undefined ? is_ranked : null,
      mapId
    ]);

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
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

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
router.delete('/maps/:mapId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

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

// Get all factions
router.get('/factions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
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
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

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
router.post('/factions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { name, description, language_code, is_active, is_ranked } = req.body;
    
    if (!name || !language_code) {
      return res.status(400).json({ error: 'Name and language_code are required' });
    }

    // Create faction
    const factionResult = await query(`
      INSERT INTO factions (name, is_active, is_ranked)
      VALUES ($1, $2, $3)
      RETURNING id, name, is_active, is_ranked, created_at
    `, [name, is_active === undefined ? true : is_active, is_ranked === undefined ? true : is_ranked]);

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
router.patch('/factions/:factionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { factionId } = req.params;
    const { is_active, is_ranked } = req.body;

    const result = await query(`
      UPDATE factions
      SET 
        is_active = COALESCE($1, is_active),
        is_ranked = COALESCE($2, is_ranked)
      WHERE id = $3
      RETURNING id, name, is_active, is_ranked, created_at
    `, [
      is_active !== undefined ? is_active : null,
      is_ranked !== undefined ? is_ranked : null,
      factionId
    ]);

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
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

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
router.delete('/factions/:factionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

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

// ===== RECALCULATE BALANCE EVENT SNAPSHOTS =====
router.post('/admin/recalculate-snapshots', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

    const { eventId, recreateAll } = req.body;

    console.log('🟡 Starting balance event snapshots recalculation');
    console.log('Parameters:', { eventId, recreateAll });

    // Call SQL function to recalculate snapshots
    const winnerResult = await query(
      'SELECT * FROM recalculate_balance_event_snapshots($1, $2)',
      [eventId || null, recreateAll || false]
    );

    console.log('🟢 Winner faction snapshots recalculated');
    console.log('Result:', winnerResult.rows[0]);

    // Also calculate loser faction snapshots
    await query(
      'SELECT * FROM recalculate_balance_event_snapshots_loser($1, $2)',
      [eventId || null, recreateAll || false]
    );

    console.log('🟢 Loser faction snapshots recalculated');

    const result = winnerResult.rows[0];
    res.json({
      success: true,
      message: 'Balance event snapshots recalculated successfully',
      totalEventsProcessed: result.total_events_processed,
      totalSnapshotsCreated: result.total_snapshots_created,
      beforeSnapshots: result.before_snapshots,
      afterSnapshots: result.after_snapshots,
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

// Manually trigger player of month calculation (admin only)
router.post('/calculate-player-of-month', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Verify admin status
    const adminResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
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
      query_str += ` WHERE f.name ILIKE $1`;
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
      'SELECT id FROM factions WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'A faction with this name already exists'
      });
    }

    const result = await query(
      `INSERT INTO factions (name, is_active, is_ranked)
       VALUES ($1, true, false)
       RETURNING id, name, is_ranked, created_at`,
      [name]
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
      'SELECT is_admin FROM public.users WHERE id = $1',
      [req.userId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;

    // Get faction info
    const factionResult = await query(
      'SELECT id, name FROM factions WHERE id = $1 AND is_ranked = false',
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
       WHERE tuf.faction_id = $1
       AND t.status IN ('CREATED', 'REGISTRATION_OPEN', 'STARTED', 'MATCHES_ONGOING')
       ORDER BY t.created_at DESC`,
      [id]
    );

    // Get completed tournaments using this faction
    const completedTournaments = await query(
      `SELECT DISTINCT t.id, t.name, t.status
       FROM tournaments t
       JOIN tournament_unranked_factions tuf ON t.id = tuf.tournament_id
       WHERE tuf.faction_id = $1
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
      'SELECT is_admin FROM public.users WHERE id = $1',
      [req.userId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;

    // Check if faction exists
    const factionResult = await query(
      'SELECT id, name FROM factions WHERE id = $1',
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
       WHERE tuf.faction_id = $1
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
    await query('DELETE FROM factions WHERE id = $1', [id]);

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
      query_str += ` WHERE m.name ILIKE $1`;
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
      'SELECT id FROM game_maps WHERE LOWER(name) = LOWER($1)',
      [name]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'A map with this name already exists'
      });
    }

    const result = await query(
      `INSERT INTO game_maps (name, is_active, is_ranked)
       VALUES ($1, true, false)
       RETURNING id, name, is_ranked, is_active, created_at`,
      [name]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
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
      'SELECT is_admin FROM public.users WHERE id = $1',
      [req.userId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;

    // Get map info
    const mapResult = await query(
      'SELECT id, name FROM game_maps WHERE id = $1 AND is_ranked = false',
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
       WHERE tum.map_id = $1
       AND t.status IN ('CREATED', 'REGISTRATION_OPEN', 'STARTED', 'MATCHES_ONGOING')
       ORDER BY t.created_at DESC`,
      [id]
    );

    // Get completed tournaments using this map
    const completedTournaments = await query(
      `SELECT DISTINCT t.id, t.name, t.status
       FROM tournaments t
       JOIN tournament_unranked_maps tum ON t.id = tum.tournament_id
       WHERE tum.map_id = $1
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
      'SELECT is_admin FROM public.users WHERE id = $1',
      [req.userId]
    );
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { id } = req.params;

    // Check if map exists
    const mapResult = await query(
      'SELECT id, name FROM game_maps WHERE id = $1',
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
       WHERE tum.map_id = $1
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
    await query('DELETE FROM game_maps WHERE id = $1', [id]);

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
       FROM tournaments WHERE id = $1`,
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    const tournament = tournamentResult.rows[0];

    // Check authorization (must be organizer)
    if (tournament.organizer_id !== req.userId) {
      const userResult = await query(
        'SELECT is_admin FROM public.users WHERE id = $1',
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
        'SELECT id FROM factions WHERE id = $1',
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
        'SELECT id FROM game_maps WHERE id = $1',
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
    await query('DELETE FROM tournament_unranked_factions WHERE tournament_id = $1', [id]);
    await query('DELETE FROM tournament_unranked_maps WHERE tournament_id = $1', [id]);

    // Insert new associations
    for (const factionId of faction_ids) {
      await query(
        `INSERT INTO tournament_unranked_factions (tournament_id, faction_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, factionId]
      );
    }

    for (const mapId of map_ids) {
      await query(
        `INSERT INTO tournament_unranked_maps (tournament_id, map_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
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
      'SELECT id, tournament_type, organizer_id FROM tournaments WHERE id = $1',
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
      WHERE t.tournament_id = $1
      GROUP BY t.id
      ORDER BY t.name`,
      [id]
    );

    // Get members for each team
    const teams = await Promise.all(teamsResult.rows.map(async (team) => {
      const membersResult = await query(
        `SELECT u.id, u.nickname, tm.position FROM team_members tm
         JOIN users u ON tm.player_id = u.id
         WHERE tm.team_id = $1
         ORDER BY tm.position`,
        [team.id]
      );

      const substitutesResult = await query(
        `SELECT u.id, u.nickname FROM team_substitutes ts
         JOIN users u ON ts.player_id = u.id
         WHERE ts.team_id = $1
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
      'SELECT id, tournament_type, organizer_id FROM tournaments WHERE id = $1',
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
    const teamResult = await query(
      `INSERT INTO tournament_teams (tournament_id, name, created_by)
       VALUES ($1, $2, $3)
       RETURNING id, name, created_at`,
      [id, name.trim(), req.userId]
    );

    res.json({ success: true, data: teamResult.rows[0], message: 'Team created successfully' });
  } catch (error: any) {
    console.error('Error creating team:', error);
    if (error.code === '23505') {
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
      'SELECT organizer_id FROM tournaments WHERE id = $1',
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
      'SELECT id FROM tournament_teams WHERE id = $1 AND tournament_id = $2',
      [teamId, id]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }

    // Add member
    const memberResult = await query(
      `INSERT INTO team_members (team_id, player_id, position)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [teamId, player_id, position]
    );

    res.json({ success: true, message: 'Member added successfully' });
  } catch (error: any) {
    console.error('Error adding member:', error);
    if (error.code === '23505') {
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
      'SELECT organizer_id FROM tournaments WHERE id = $1',
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
      'DELETE FROM team_members WHERE team_id = $1 AND player_id = $2',
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
      'SELECT organizer_id FROM tournaments WHERE id = $1',
      [id]
    );

    if (tournResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tournament not found' });
    }

    if (tournResult.rows[0].organizer_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Only organizer can add substitutes' });
    }

    // Add substitute
    await query(
      `INSERT INTO team_substitutes (team_id, player_id, substitute_order)
       VALUES ($1, $2, (SELECT COALESCE(MAX(substitute_order), 0) + 1 FROM team_substitutes WHERE team_id = $1))
       ON CONFLICT DO NOTHING`,
      [teamId, player_id]
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
      'SELECT organizer_id FROM tournaments WHERE id = $1',
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
      'SELECT COUNT(*) as count FROM team_tournament_matches WHERE team_a_id = $1 OR team_b_id = $1',
      [teamId]
    );

    if (matchResult.rows[0].count > 0) {
      return res.status(400).json({ success: false, error: 'Cannot delete team with matches' });
    }

    // Delete team
    const result = await query(
      'DELETE FROM tournament_teams WHERE id = $1 AND tournament_id = $2',
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
      'SELECT id, creator_id, tournament_mode FROM tournaments WHERE id = $1',
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
        'SELECT updated_count, error_message FROM update_team_tiebreakers($1)',
        [id]
      );
    } else {
      // For individual tournaments, update participant tiebreakers
      tiebreakersResult = await query(
        'SELECT updated_count, error_message FROM update_tournament_tiebreakers($1)',
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

export default router;

