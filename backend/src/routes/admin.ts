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
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Disabled trigger: trg_update_faction_map_stats');
    } catch (error) {
      console.error('Warning: Failed to disable trigger:', error);
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

    // Re-enable the trigger after all updates are done
    try {
      await query(`
        CREATE TRIGGER trg_update_faction_map_stats
        AFTER INSERT OR UPDATE ON matches
        FOR EACH ROW
        EXECUTE FUNCTION update_faction_map_statistics();
      `);
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Re-enabled trigger: trg_update_faction_map_stats');
    } catch (error) {
      console.error('Warning: Failed to re-enable trigger:', error);
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
router.patch('/maps/:mapId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

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
router.patch('/factions/:factionId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Check if user is admin
    const userResult = await query('SELECT is_admin FROM public.users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Only admins can access this resource' });
    }

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
    const now = new Date();
    // Get the first day of the previous month (last month's player)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Convert to YYYY-MM-DD format for PostgreSQL DATE comparison
    const monthYearStr = prevMonthStart.toISOString().split('T')[0];
    
    console.log(`📊 GET player-of-month - Looking for month_year: ${monthYearStr}`);

    const result = await query(
      `SELECT player_id, nickname, elo_rating, ranking_position, elo_gained, positions_gained, month_year, calculated_at
       FROM player_of_month
       WHERE month_year = $1::DATE`,
      [monthYearStr]
    );

    console.log(`📊 Query returned: ${result.rows.length} rows`);
    if (result.rows.length > 0) {
      console.log(`📊 Found player: ${result.rows[0].nickname}`);
    } else {
      // Debug: show what's in the table
      const allResult = await query(`SELECT month_year, nickname FROM player_of_month ORDER BY month_year DESC`);
      console.log(`📊 Available months in table: ${allResult.rows.map(r => `${r.nickname} (${r.month_year})`).join(', ')}`);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No player of month data available' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching player of month:', error);
    res.status(500).json({
      error: 'Failed to fetch player of month',
      details: (error as any).message
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

export default router;

