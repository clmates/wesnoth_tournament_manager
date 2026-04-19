import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { sendDiscordNotification, storeNotificationForUsers } from '../services/discordNotificationService.js';
import { getNotificationService } from '../services/notificationSocketService.js';

const router = Router();

console.log('🔧 Registering tournament scheduling routes');

/**
 * GET /:tournamentId/matches-pending-schedule
 * Get all pending/in_progress matches that can be scheduled for a tournament
 * Participant sees only their matches; organizers see all
 */
router.get('/:tournamentId/matches-pending-schedule', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { tournamentId } = req.params;
    const userId = req.userId;

    if (!userId || !tournamentId) {
      return res.status(400).json({ error: 'Missing userId or tournamentId' });
    }

    // Get tournament info
    const tournamentResult = await query(
      'SELECT id, name, tournament_mode FROM tournaments WHERE id = ?',
      [tournamentId]
    );

    if (!tournamentResult.rows || tournamentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tournamentResult.rows[0];

    // For team tournaments, need to check team membership
    let userTeams: any[] = [];
    if (tournament.tournament_mode === 'team') {
      const teamResult = await query(
        `SELECT t.id FROM tournament_teams t
         WHERE t.tournament_id = ? AND t.id IN (
           SELECT DISTINCT team_id FROM tournament_participants WHERE user_id = ?
         )`,
        [tournamentId, userId]
      );
      userTeams = teamResult.rows || [];
    }

    // Get all pending/in_progress matches for this tournament
    let matches;
    if (tournament.tournament_mode === 'team') {
      const teamIds = userTeams.map((t: any) => t.id);
      if (teamIds.length === 0) {
        return res.json({ matches: [] }); // User has no teams in this tournament
      }

      const matchResult = await query(
        `SELECT 
          trm.id, 
          trm.tournament_id,
          trm.round_id,
          trm.player1_id,
          trm.player2_id,
          trm.best_of,
          trm.series_status,
          trm.scheduled_datetime,
          trm.scheduled_status,
          trm.scheduled_by_player_id,
          trm.scheduled_confirmed_at,
          tr.round_number,
          t1.team_name as team1_name,
          t2.team_name as team2_name
        FROM tournament_round_matches trm
        JOIN tournament_rounds tr ON trm.round_id = tr.id
        JOIN tournament_teams t1 ON trm.player1_id = t1.id
        JOIN tournament_teams t2 ON trm.player2_id = t2.id
        WHERE trm.tournament_id = ?
          AND trm.series_status IN ('pending', 'in_progress')
          AND (trm.player1_id IN (${teamIds.map(() => '?').join(',')}) OR trm.player2_id IN (${teamIds.map(() => '?').join(',')}))
        ORDER BY tr.round_number ASC, trm.created_at ASC`,
        [tournamentId, ...teamIds, ...teamIds]
      );
      matches = matchResult.rows || [];
    } else {
      const matchResult = await query(
        `SELECT 
          trm.id, 
          trm.tournament_id,
          trm.round_id,
          trm.player1_id,
          trm.player2_id,
          trm.best_of,
          trm.series_status,
          trm.scheduled_datetime,
          trm.scheduled_status,
          trm.scheduled_by_player_id,
          trm.scheduled_confirmed_at,
          tr.round_number,
          u1.username as player1_name,
          u2.username as player2_name
        FROM tournament_round_matches trm
        JOIN tournament_rounds tr ON trm.round_id = tr.id
        JOIN users_extension u1 ON trm.player1_id = u1.user_id
        JOIN users_extension u2 ON trm.player2_id = u2.user_id
        WHERE trm.tournament_id = ?
          AND trm.series_status IN ('pending', 'in_progress')
          AND (trm.player1_id = ? OR trm.player2_id = ?)
        ORDER BY tr.round_number ASC, trm.created_at ASC`,
        [tournamentId, userId, userId]
      );
      matches = matchResult.rows || [];
    }

    res.json({ matches });
  } catch (error) {
    console.error('❌ [TOURNAMENT_SCHEDULING] Error fetching pending matches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /:tournamentRoundMatchId/schedule
 * Get current schedule status for a match (public - shows confirmed schedules)
 */
router.get('/:tournamentRoundMatchId/schedule', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { tournamentRoundMatchId } = req.params;
    const userId = req.userId;

    const scheduleResult = await query(
      `SELECT 
        id,
        scheduled_datetime,
        scheduled_status,
        scheduled_by_player_id,
        scheduled_confirmed_at
      FROM tournament_round_matches 
      WHERE id = ?`,
      [tournamentRoundMatchId]
    );

    if (!scheduleResult.rows || scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const schedule = scheduleResult.rows[0];

    // Only show confirmed schedules publicly
    if (schedule.scheduled_status === 'confirmed') {
      res.json({ schedule });
    } else if (userId) {
      // Check if user is participant
      const matchResult = await query(
        'SELECT player1_id, player2_id FROM tournament_round_matches WHERE id = ?',
        [tournamentRoundMatchId]
      );

      if (matchResult.rows && matchResult.rows.length > 0) {
        const m = matchResult.rows[0];
        if (m.player1_id === userId || m.player2_id === userId) {
          // Participant - show proposals
          res.json({ schedule });
        } else {
          // Not participant - only show confirmed
          res.json({ schedule: { scheduled_status: 'no_schedule' } });
        }
      }
    } else {
      // Not authenticated - only show confirmed
      res.json({ schedule: { scheduled_status: 'no_schedule' } });
    }
  } catch (error) {
    console.error('❌ [TOURNAMENT_SCHEDULING] Error fetching schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /:tournamentRoundMatchId/propose-schedule
 * Propose a match schedule (can be counter-proposed by opponent)
 * Body: { scheduled_datetime: ISO string (UTC) }
 */
router.post('/:tournamentRoundMatchId/propose-schedule', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { tournamentRoundMatchId } = req.params;
    const { scheduled_datetime } = req.body;
    const userId = req.userId;

    if (!userId || !tournamentRoundMatchId || !scheduled_datetime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate datetime is a valid ISO string
    const dateObj = new Date(scheduled_datetime);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid datetime format' });
    }

    // Get match details
    const matchResult = await query(
      `SELECT 
        trm.id,
        trm.tournament_id,
        trm.player1_id,
        trm.player2_id,
        trm.series_status,
        trm.scheduled_datetime,
        trm.scheduled_status,
        t.tournament_mode
      FROM tournament_round_matches trm
      JOIN tournaments t ON trm.tournament_id = t.id
      WHERE trm.id = ?`,
      [tournamentRoundMatchId]
    );

    if (!matchResult.rows || matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    // Check if series is already completed
    if (match.series_status === 'completed') {
      return res.status(400).json({ error: 'Series is already completed' });
    }

    // Check if user is a participant
    let isParticipant = false;
    let isPlayer1 = false;
    let opponentId = null;

    if (match.tournament_mode === 'team') {
      // Team tournament - check if user is on one of the teams
      const userTeamResult = await query(
        `SELECT team_id FROM tournament_participants 
        WHERE tournament_id = ? AND user_id = ? 
        LIMIT 1`,
        [match.tournament_id, userId]
      );

      if (!userTeamResult.rows || userTeamResult.rows.length === 0) {
        return res.status(403).json({ error: 'You are not a participant in this match' });
      }

      const userTeamId = userTeamResult.rows[0].team_id;
      if (userTeamId === match.player1_id) {
        isPlayer1 = true;
        isParticipant = true;
        opponentId = match.player2_id;
      } else if (userTeamId === match.player2_id) {
        isPlayer1 = false;
        isParticipant = true;
        opponentId = match.player1_id;
      }
    } else {
      // 1v1 tournament
      if (userId === match.player1_id) {
        isPlayer1 = true;
        isParticipant = true;
        opponentId = match.player2_id;
      } else if (userId === match.player2_id) {
        isPlayer1 = false;
        isParticipant = true;
        opponentId = match.player1_id;
      }
    }

    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this match' });
    }

    // Update schedule
    const newStatus = isPlayer1 ? 'player1_proposed' : 'player2_proposed';
    const now = new Date();

    await query(
      `UPDATE tournament_round_matches 
      SET 
        scheduled_datetime = ?,
        scheduled_status = ?,
        scheduled_by_player_id = ?,
        updated_at = ?
      WHERE id = ?`,
      [scheduled_datetime, newStatus, userId, now, tournamentRoundMatchId]
    );

    // Get opponent name/email for Discord notification
    // For team tournaments, get team members; for 1v1, get opponent user
    let opponentName = 'Opponent';
    let proposerName = 'Player';
    let opponentEmail = null;
    let opponentSocketRecipients: string[] = [];

    if (match.tournament_mode === 'team') {
      // Team tournament - get all members of opponent team
      const teamResult = await query(
        'SELECT team_name FROM tournament_teams WHERE id = ?',
        [opponentId]
      );
      opponentName = teamResult.rows && teamResult.rows.length > 0 ? teamResult.rows[0].team_name : 'Opponent Team';

      // Get proposer team name
      const proposerTeamResult = await query(
        'SELECT team_name FROM tournament_teams WHERE id = ?',
        [isPlayer1 ? match.player1_id : match.player2_id]
      );
      proposerName = proposerTeamResult.rows && proposerTeamResult.rows.length > 0 ? proposerTeamResult.rows[0].team_name : 'Team';

      // Get all users in the opponent team
      const teamMembersResult = await query(
        `SELECT user_id FROM tournament_participants 
        WHERE tournament_id = ? AND team_id = ?`,
        [match.tournament_id, opponentId]
      );

      if (teamMembersResult.rows) {
        opponentSocketRecipients = teamMembersResult.rows.map((row: any) => row.user_id);
      }
    } else {
      // 1v1 tournament
      const opponentResult = await query(
        'SELECT username FROM users_extension WHERE user_id = ?',
        [opponentId]
      );
      opponentName = opponentResult.rows && opponentResult.rows.length > 0 ? opponentResult.rows[0].username : 'Opponent';
      
      const proposerResult = await query(
        'SELECT username FROM users_extension WHERE user_id = ?',
        [userId]
      );
      proposerName = proposerResult.rows && proposerResult.rows.length > 0 ? proposerResult.rows[0].username : 'Player';
      
      // Get email for Discord ping
      const userResult = await query(
        'SELECT user_email FROM phpbb3_users WHERE user_id = ?',
        [opponentId]
      );
      opponentEmail = userResult.rows && userResult.rows.length > 0 ? userResult.rows[0].user_email : null;
      
      // For 1v1, send notification to the opponent user only
      opponentSocketRecipients = [opponentId];
    }

    // Get tournament details for Discord
    const tournamentResult = await query(
      'SELECT tournament_name FROM tournaments WHERE id = ?',
      [match.tournament_id]
    );
    const tournamentName = tournamentResult.rows && tournamentResult.rows.length > 0 ? tournamentResult.rows[0].tournament_name : 'Tournament';

    // Send Discord notification to tournament channel
    const scheduleTimeUTC = new Date(scheduled_datetime).toLocaleString('es-ES', { timeZone: 'UTC' });
    const discordMessage = `🗓️ **Schedule Proposal** - ${tournamentName}\n@${opponentName}\n\n${opponentName}, please confirm or counter-propose:\n**Proposed time:** ${scheduleTimeUTC} UTC`;

    // Send Discord notification to tournament channel
    await sendDiscordNotification(
      discordMessage,
      match.tournament_id,
      'schedule_proposal'
    ).catch(err => console.error('⚠️ Discord notification failed:', err));

    // Store notification in database (fallback for offline users)
    const notificationTitle = `🗓️ Schedule Proposal - ${tournamentName}`;
    const notificationMessage = `${proposerName} proposed schedule: ${scheduleTimeUTC} UTC`;
    
    await storeNotificationForUsers(
      opponentSocketRecipients,
      match.tournament_id,
      tournamentRoundMatchId,
      'schedule_proposal',
      notificationTitle,
      notificationMessage
    ).catch(err => console.error('⚠️ Error storing notifications:', err));

    // Send Socket.IO real-time notification to opponent(s) if they're online
    const notificationService = getNotificationService();
    if (notificationService) {
      opponentSocketRecipients.forEach((userId) => {
        notificationService.notifyUser(userId, {
          type: 'schedule_proposal',
          title: notificationTitle,
          message: notificationMessage,
          matchId: tournamentRoundMatchId,
          action: 'confirm',
          timestamp: new Date().toISOString(),
        });
      });
    }

    res.json({
      success: true,
      message: 'Schedule proposal sent',
      schedule: {
        scheduled_datetime,
        scheduled_status: newStatus,
        scheduled_by_player_id: userId
      }
    });
  } catch (error) {
    console.error('❌ [TOURNAMENT_SCHEDULING] Error proposing schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /:tournamentRoundMatchId/confirm-schedule
 * Confirm a proposed match schedule
 */
router.post('/:tournamentRoundMatchId/confirm-schedule', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { tournamentRoundMatchId } = req.params;
    const userId = req.userId;

    if (!userId || !tournamentRoundMatchId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get match details
    const matchResult = await query(
      `SELECT 
        trm.id,
        trm.tournament_id,
        trm.player1_id,
        trm.player2_id,
        trm.series_status,
        trm.scheduled_datetime,
        trm.scheduled_status,
        trm.scheduled_by_player_id,
        t.tournament_mode
      FROM tournament_round_matches trm
      JOIN tournaments t ON trm.tournament_id = t.id
      WHERE trm.id = ?`,
      [tournamentRoundMatchId]
    );

    if (!matchResult.rows || matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    // Check if user is a participant
    let isParticipant = false;
    let opponentId = null;

    if (match.tournament_mode === 'team') {
      const userTeamResult = await query(
        `SELECT team_id FROM tournament_participants 
        WHERE tournament_id = ? AND user_id = ? 
        LIMIT 1`,
        [match.tournament_id, userId]
      );

      if (!userTeamResult.rows || userTeamResult.rows.length === 0) {
        return res.status(403).json({ error: 'You are not a participant in this match' });
      }

      const userTeamId = userTeamResult.rows[0].team_id;
      if (userTeamId === match.player1_id) {
        isParticipant = true;
        opponentId = match.player2_id;
      } else if (userTeamId === match.player2_id) {
        isParticipant = true;
        opponentId = match.player1_id;
      }
    } else {
      if (userId === match.player1_id) {
        isParticipant = true;
        opponentId = match.player2_id;
      } else if (userId === match.player2_id) {
        isParticipant = true;
        opponentId = match.player1_id;
      }
    }

    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this match' });
    }

    // Check if there's a pending proposal
    if (!match.scheduled_datetime || match.scheduled_status === 'pending') {
      return res.status(400).json({ error: 'No schedule proposal to confirm' });
    }

    // Check if user was the one who proposed (can't confirm own proposal)
    if (match.scheduled_by_player_id === userId) {
      return res.status(400).json({ error: 'You cannot confirm your own proposal' });
    }

    // Update to confirmed
    const now = new Date();
    await query(
      `UPDATE tournament_round_matches 
      SET 
        scheduled_status = 'confirmed',
        scheduled_confirmed_at = ?,
        updated_at = ?
      WHERE id = ?`,
      [now, now, tournamentRoundMatchId]
    );

    // Get opponent name for Discord notification and team members for Socket.IO
    let opponentName = 'Opponent';
    let proposerSocketRecipients: string[] = [];
    let confirmerSocketRecipients: string[] = [];

    const proposerId = match.scheduled_by_player_id;
    const confirmerId = userId;
    const proposerTeamId = proposerId === match.player1_id ? match.player1_id : match.player2_id;
    const confirmerTeamId = confirmerId === match.player1_id ? match.player1_id : match.player2_id;

    if (match.tournament_mode === 'team') {
      // Get proposer team name and members
      const proposerTeamResult = await query(
        'SELECT team_name FROM tournament_teams WHERE id = ?',
        [proposerTeamId]
      );
      opponentName = proposerTeamResult.rows && proposerTeamResult.rows.length > 0 ? proposerTeamResult.rows[0].team_name : 'Opponent Team';

      // Get proposer team members
      const proposerMembersResult = await query(
        `SELECT user_id FROM tournament_participants 
        WHERE tournament_id = ? AND team_id = ?`,
        [match.tournament_id, proposerTeamId]
      );
      if (proposerMembersResult.rows) {
        proposerSocketRecipients = proposerMembersResult.rows.map((row: any) => row.user_id);
      }

      // Get confirmer team members
      const confirmerMembersResult = await query(
        `SELECT user_id FROM tournament_participants 
        WHERE tournament_id = ? AND team_id = ?`,
        [match.tournament_id, confirmerTeamId]
      );
      if (confirmerMembersResult.rows) {
        confirmerSocketRecipients = confirmerMembersResult.rows.map((row: any) => row.user_id);
      }
    } else {
      // 1v1 tournament
      const proposerResult = await query(
        'SELECT username FROM users_extension WHERE user_id = ?',
        [proposerId]
      );
      opponentName = proposerResult.rows && proposerResult.rows.length > 0 ? proposerResult.rows[0].username : 'Opponent';

      proposerSocketRecipients = [proposerId];
      confirmerSocketRecipients = [confirmerId];
    }

    // Get tournament details for Discord
    const tournamentResult = await query(
      'SELECT tournament_name FROM tournaments WHERE id = ?',
      [match.tournament_id]
    );
    const tournamentName = tournamentResult.rows && tournamentResult.rows.length > 0 ? tournamentResult.rows[0].tournament_name : 'Tournament';

    const scheduleTimeUTC = new Date(match.scheduled_datetime).toLocaleString('es-ES', { timeZone: 'UTC' });
    const discordMessage = `✅ **Schedule Confirmed** - ${tournamentName}\nMatch scheduled for: **${scheduleTimeUTC} UTC**`;

    // Send Discord notification to tournament channel
    await sendDiscordNotification(
      discordMessage,
      match.tournament_id,
      'schedule_confirmed'
    ).catch(err => console.error('⚠️ Discord notification failed:', err));

    // Store notification in database (fallback for offline users)
    const notificationTitle = `✅ Schedule Confirmed - ${tournamentName}`;
    const notificationMessage = `Match scheduled for: ${scheduleTimeUTC} UTC`;
    
    // Combine all recipients (both proposer and confirmer teams)
    const allRecipients = [...new Set([...proposerSocketRecipients, ...confirmerSocketRecipients])];
    
    await storeNotificationForUsers(
      allRecipients,
      match.tournament_id,
      tournamentRoundMatchId,
      'schedule_confirmed',
      notificationTitle,
      notificationMessage
    ).catch(err => console.error('⚠️ Error storing notifications:', err));

    // Send Socket.IO real-time notification to all participants if they're online
    const notificationService = getNotificationService();
    if (notificationService) {
      allRecipients.forEach((userId) => {
        notificationService.notifyUser(userId, {
          type: 'schedule_confirmed',
          title: notificationTitle,
          message: notificationMessage,
          matchId: tournamentRoundMatchId,
          action: 'view',
          timestamp: new Date().toISOString(),
        });
      });
    }

    res.json({
      success: true,
      message: 'Schedule confirmed',
      schedule: {
        scheduled_datetime: match.scheduled_datetime,
        scheduled_status: 'confirmed',
        scheduled_confirmed_at: now
      }
    });
  } catch (error) {
    console.error('❌ [TOURNAMENT_SCHEDULING] Error confirming schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /:tournamentRoundMatchId/cancel-schedule
 * Cancel/withdraw a proposed or confirmed schedule
 */
router.post('/:tournamentRoundMatchId/cancel-schedule', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { tournamentRoundMatchId } = req.params;
    const userId = req.userId;

    if (!userId || !tournamentRoundMatchId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get match details
    const matchResult = await query(
      `SELECT 
        trm.id,
        trm.tournament_id,
        trm.player1_id,
        trm.player2_id,
        trm.scheduled_status,
        trm.scheduled_by_player_id,
        t.tournament_mode
      FROM tournament_round_matches trm
      JOIN tournaments t ON trm.tournament_id = t.id
      WHERE trm.id = ?`,
      [tournamentRoundMatchId]
    );

    if (!matchResult.rows || matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    // Check if user is a participant
    let isParticipant = false;

    if (match.tournament_mode === 'team') {
      const userTeamResult = await query(
        `SELECT team_id FROM tournament_participants 
        WHERE tournament_id = ? AND user_id = ? 
        LIMIT 1`,
        [match.tournament_id, userId]
      );

      isParticipant = userTeamResult.rows && userTeamResult.rows.length > 0 && 
        (userTeamResult.rows[0].team_id === match.player1_id || userTeamResult.rows[0].team_id === match.player2_id);
    } else {
      isParticipant = userId === match.player1_id || userId === match.player2_id;
    }

    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant in this match' });
    }

    // Only the person who proposed can cancel
    if (match.scheduled_by_player_id !== userId) {
      return res.status(403).json({ error: 'Only the person who proposed the schedule can cancel it' });
    }

    // Cancel the schedule
    const now = new Date();
    await query(
      `UPDATE tournament_round_matches 
      SET 
        scheduled_datetime = NULL,
        scheduled_status = 'pending',
        scheduled_by_player_id = NULL,
        scheduled_confirmed_at = NULL,
        updated_at = ?
      WHERE id = ?`,
      [now, tournamentRoundMatchId]
    );

    res.json({
      success: true,
      message: 'Schedule cancelled'
    });
  } catch (error) {
    console.error('❌ [TOURNAMENT_SCHEDULING] Error cancelling schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
