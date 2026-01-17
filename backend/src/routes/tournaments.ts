import { Router } from 'express';
import { query } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activateRound, checkAndCompleteRound, getWinnerAndRunnerUp } from '../utils/tournament.js';
import discordService from '../services/discordService.js';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { 
      name, 
      description, 
      tournament_type, 
      tournament_mode,
      max_participants, 
      round_duration_days,
      auto_advance_round,
      general_rounds,
      final_rounds,
      general_rounds_format,
      final_rounds_format,
      unranked_factions,
      unranked_maps
    } = req.body;

    // Validation
    if (!name || !description || !tournament_type) {
      return res.status(400).json({ error: 'Missing required fields: name, description, tournament_type' });
    }

    // max_participants is now optional - can be set during tournament preparation
    // If provided, must be greater than 0
    if (max_participants !== null && max_participants !== undefined && max_participants <= 0) {
      return res.status(400).json({ error: 'Max participants must be greater than 0 if provided' });
    }

    // Validate round configuration - only validate if max_participants is set
    // At least one round must be configured when max_participants is set (except for elimination which auto-calculates)
    const tournamentTypeLower = tournament_type.toLowerCase();
    
    if (max_participants && max_participants > 0 && tournamentTypeLower !== 'elimination') {
      if ((general_rounds || 0) < 0 || (final_rounds || 0) < 0) {
        return res.status(400).json({ error: 'Round values cannot be negative' });
      }
      if ((general_rounds || 0) + (final_rounds || 0) <= 0) {
        return res.status(400).json({ error: 'At least one round must be configured (general_rounds or final_rounds)' });
      }
    }

    // Validate match formats only if provided
    const validFormats = ['bo1', 'bo3', 'bo5'];
    if (general_rounds_format && !validFormats.includes(general_rounds_format)) {
      return res.status(400).json({ error: 'Invalid general_rounds_format. Must be: bo1, bo3, or bo5' });
    }
    if (final_rounds_format && !validFormats.includes(final_rounds_format)) {
      return res.status(400).json({ error: 'Invalid final_rounds_format. Must be: bo1, bo3, or bo5' });
    }

    // Validate tournament type-specific configurations
    // (already validated tournamentTypeLower is declared above)
    
    if (tournamentTypeLower === 'league') {
      // League: only general_rounds, must be 1 or 2
      if ((final_rounds || 0) > 0) {
        return res.status(400).json({ error: 'League tournaments should not have final rounds' });
      }
      if ((general_rounds || 0) < 1 || (general_rounds || 0) > 2) {
        return res.status(400).json({ error: 'League tournaments must have 1 or 2 general rounds (1=single round-robin, 2=home and away)' });
      }
    } else if (tournamentTypeLower === 'swiss') {
      // Swiss: only general_rounds, can be any number from 1 to 10
      if ((final_rounds || 0) > 0) {
        return res.status(400).json({ error: 'Swiss tournaments should not have final rounds' });
      }
      if ((general_rounds || 0) < 1 || (general_rounds || 0) > 10) {
        return res.status(400).json({ error: 'Swiss tournaments must have between 1 and 10 general rounds' });
      }
    } else if (tournamentTypeLower === 'swiss_elimination') {
      // Swiss-Elimination Mix: both general and final rounds
      // General rounds: 1-10 (Swiss phase)
      // Final rounds: 1-3 (Elimination phase: Quarterfinals, Semifinals, Final)
      if ((general_rounds || 0) < 1 || (general_rounds || 0) > 10) {
        return res.status(400).json({ error: 'Swiss-Elimination Mix must have between 1 and 10 general rounds (Swiss phase)' });
      }
      if ((final_rounds || 0) < 1 || (final_rounds || 0) > 3) {
        return res.status(400).json({ error: 'Swiss-Elimination Mix must have between 1 and 3 final rounds (Elimination phase)' });
      }
    } else if (tournamentTypeLower === 'elimination') {
      // Pure Elimination: system calculates rounds automatically based on participants
      // Only need match formats (general_rounds_format for preliminaries, final_rounds_format for final)
      if (!general_rounds_format || !final_rounds_format) {
        return res.status(400).json({ error: 'Elimination tournaments must specify match formats (general_rounds_format and final_rounds_format)' });
      }
    }

    // Calculate total rounds based on tournament type and participants
    let totalRounds = 0;
    if (tournamentTypeLower === 'elimination' && max_participants && max_participants > 0) {
      // For elimination: calculate rounds needed for all participants
      totalRounds = Math.ceil(Math.log2(max_participants));
    } else if (tournamentTypeLower !== 'elimination') {
      // For other types, use specified rounds
      totalRounds = (general_rounds || 0) + (final_rounds || 0);
    }
    // If elimination without max_participants, total_rounds will be calculated during close-registration

    // Create tournament
    const tournamentResult = await query(
      `INSERT INTO tournaments (
        name, description, creator_id, tournament_type, tournament_mode,
        max_participants, round_duration_days, auto_advance_round, 
        total_rounds, general_rounds, final_rounds,
        general_rounds_format, final_rounds_format,
        status, current_round
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        name, 
        description,
        req.userId, 
        tournament_type,
        tournament_mode || 'ranked',
        max_participants, 
        round_duration_days || 7,
        auto_advance_round || false,
        totalRounds,
        tournamentTypeLower === 'elimination' ? 0 : (general_rounds || 0),
        tournamentTypeLower === 'elimination' ? 0 : (final_rounds || 0),
        general_rounds_format || 'bo3',
        final_rounds_format || 'bo5',
        'registration_open',
        0
      ]
    );

    const tournamentId = tournamentResult.rows[0].id;

    // Add allowed factions and maps for all tournament modes (ranked, unranked, team)
    if (unranked_factions || unranked_maps) {
      try {
        console.log(`Adding assets to tournament ${tournamentId}:`, {
          factions_count: unranked_factions?.length || 0,
          maps_count: unranked_maps?.length || 0,
          factions: unranked_factions,
          maps: unranked_maps
        });

        // Add factions
        if (unranked_factions && Array.isArray(unranked_factions)) {
          for (const faction of unranked_factions) {
            const factionId = faction.id || faction;
            console.log(`Inserting faction ${factionId} into tournament ${tournamentId}`);
            await query(
              `INSERT INTO tournament_unranked_factions (tournament_id, faction_id)
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [tournamentId, factionId]
            );
          }
        }

        // Add maps
        if (unranked_maps && Array.isArray(unranked_maps)) {
          for (const map of unranked_maps) {
            const mapId = map.id || map;
            console.log(`Inserting map ${mapId} into tournament ${tournamentId}`);
            await query(
              `INSERT INTO tournament_unranked_maps (tournament_id, map_id)
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [tournamentId, mapId]
            );
          }
        }
        
        console.log(`Successfully added assets to tournament ${tournamentId}`);
      } catch (assetError) {
        console.error('Error adding tournament assets:', assetError);
        // Don't fail tournament creation if adding assets fails
      }
    }

    // Get organizer nickname
    let organizerNickname = 'Unknown';
    try {
      const userResult = await query('SELECT nickname FROM users WHERE id = $1', [req.userId]);
      if (userResult.rows.length > 0) {
        organizerNickname = userResult.rows[0].nickname;
      }
    } catch (userError) {
      console.warn('Could not fetch organizer nickname:', userError);
    }

    // Create Discord forum thread for the tournament
    try {
      const threadId = await discordService.createTournamentThread(
        tournamentId.toString(),
        name,
        tournament_type,
        organizerNickname,
        description
      );

      // Update tournament with Discord thread ID
      if (threadId) {
        await query(
          'UPDATE tournaments SET discord_thread_id = $1 WHERE id = $2',
          [threadId, tournamentId]
        );

        // Post tournament created message to Discord
        await discordService.postTournamentCreated(
          threadId,
          name,
          tournament_type,
          description,
          organizerNickname,
          max_participants
        );
      }
    } catch (discordError) {
      console.error('Discord integration error:', discordError);
      // Don't fail the tournament creation if Discord fails
    }

    res.status(201).json({ 
      id: tournamentId,
      status: 'registration_open',
      message: 'Tournament created successfully. Registration is now open.' 
    });
  } catch (error: any) {
    console.error('Tournament creation error:', error.message || error);
    console.error('Full error:', error);
    res.status(500).json({ error: 'Failed to create tournament', details: error.message });
  }
});

// Get my tournaments (created by current user) - MUST be before /:id
router.get('/my', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const result = await query(
      `SELECT * FROM tournaments 
       WHERE creator_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    // For each tournament, if status = 'finished', fetch winner and runner-up
    const tournaments = await Promise.all(result.rows.map(async (t: any) => {
      let winner_id = null, winner_nickname = null, runner_up_id = null, runner_up_nickname = null;
      
      if (t.status === 'finished') {
        // Use tournament-type-aware function to get winner and runner-up
        const { winner, runnerUp } = await getWinnerAndRunnerUp(t.id);
        
        if (winner) {
          winner_id = winner.id;
          winner_nickname = winner.nickname;
        }
        if (runnerUp) {
          runner_up_id = runnerUp.id;
          runner_up_nickname = runnerUp.nickname;
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

    res.json(tournaments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch my tournaments' });
  }
});

// Get tournament
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('SELECT * FROM tournaments WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

// Update tournament configuration (organizer only)
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      description,
      max_participants,
      round_duration_days,
      auto_advance_round,
      general_rounds,
      final_rounds,
      general_rounds_format,
      final_rounds_format,
      status,
      started_at
    } = req.body;

    // Verify the user is the tournament creator
    const tournamentResult = await query(
      'SELECT creator_id, status FROM tournaments WHERE id = $1',
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournamentResult.rows[0].creator_id !== req.userId) {
      return res.status(403).json({ error: 'Only the tournament creator can update this tournament' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (max_participants !== undefined) {
      updates.push(`max_participants = $${paramCount}`);
      values.push(max_participants);
      paramCount++;
    }

    if (round_duration_days !== undefined) {
      updates.push(`round_duration_days = $${paramCount}`);
      values.push(round_duration_days);
      paramCount++;
    }

    if (auto_advance_round !== undefined) {
      updates.push(`auto_advance_round = $${paramCount}`);
      values.push(auto_advance_round);
      paramCount++;
    }

    if (general_rounds !== undefined) {
      updates.push(`general_rounds = $${paramCount}`);
      values.push(general_rounds);
      paramCount++;
    }

    if (final_rounds !== undefined) {
      updates.push(`final_rounds = $${paramCount}`);
      values.push(final_rounds);
      paramCount++;
    }

    if (general_rounds_format !== undefined) {
      updates.push(`general_rounds_format = $${paramCount}`);
      values.push(general_rounds_format);
      paramCount++;
    }

    if (final_rounds_format !== undefined) {
      updates.push(`final_rounds_format = $${paramCount}`);
      values.push(final_rounds_format);
      paramCount++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (started_at !== undefined) {
      updates.push(`started_at = $${paramCount}`);
      values.push(started_at);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `
      UPDATE tournaments 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    res.json({
      message: 'Tournament updated successfully',
      tournament: result.rows[0]
    });
  } catch (error: any) {
    console.error('Update tournament error:', error.message || error);
    res.status(500).json({ error: 'Failed to update tournament', details: error.message });
  }
});

// Delete tournament (admin only) - desvinculates matches from tournament but keeps them
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Verify tournament exists
    const tournamentCheck = await query('SELECT id, creator_id FROM tournaments WHERE id = $1', [id]);
    if (tournamentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Desvinculate all matches from tournament (set tournament_id to NULL)
      // Note: matches table has tournament_id column but NO FK constraint, so matches will be preserved
      const matchesResult = await query('UPDATE matches SET tournament_id = NULL WHERE tournament_id = $1 RETURNING id', [id]);
      const desvinculatedMatchesCount = matchesResult.rows.length;

      // Delete tournament_rounds (cascade will handle tournament_round_matches)
      await query('DELETE FROM tournament_rounds WHERE tournament_id = $1', [id]);

      // Delete tournament_participants
      await query('DELETE FROM tournament_participants WHERE tournament_id = $1', [id]);

      // Delete tournament
      await query('DELETE FROM tournaments WHERE id = $1', [id]);

      // Commit transaction
      await query('COMMIT');

      res.json({ 
        message: 'Tournament deleted successfully',
        tournament_id: id,
        details: {
          matches_desvinculated: desvinculatedMatchesCount,
          note: 'Associated matches have been preserved and desvinculated from tournament'
        }
      });
    } catch (innerError) {
      await query('ROLLBACK');
      throw innerError;
    }
  } catch (error: any) {
    console.error('Delete tournament error:', error.message || error);
    res.status(500).json({ error: 'Failed to delete tournament', details: error.message });
  }
});

// Get tournament rounds
router.get('/:id/rounds', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT * FROM tournament_rounds 
       WHERE tournament_id = $1 
       ORDER BY round_number ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tournament rounds' });
  }
});

// Get all tournaments (public view - only approved/in_progress/finished)
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM tournaments 
       WHERE status IN ('approved', 'in_progress', 'finished')
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
});

// Join tournament
router.post('/:id/join', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert participant without elo_rating (it's only in users table)
    const result = await query(
      `INSERT INTO tournament_participants (tournament_id, user_id, participation_status)
       VALUES ($1, $2, 'accepted')
       RETURNING id`,
      [id, req.userId]
    );

    res.status(201).json({ id: result.rows[0].id });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Already joined this tournament' });
    }
    console.error('Join tournament error:', error);
    res.status(500).json({ error: 'Failed to join tournament', details: error.message });
  }
});

// Request to join tournament (creates pending participant)
router.post('/:id/request-join', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { team_name, teammate_name } = req.body;
    console.log('Request to join tournament:', { id, userId: req.userId, team_name, teammate_name });

    // Check if tournament exists and get tournament_mode
    const tournamentResult = await query(
      'SELECT id, discord_thread_id, max_participants, tournament_mode FROM tournaments WHERE id = $1',
      [id]
    );
    if (tournamentResult.rows.length === 0) {
      console.log('Tournament not found:', id);
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tournamentResult.rows[0];
    let teamId: string | null = null;

    // If team tournament, handle team logic
    if (tournament.tournament_mode === 'team') {
      // Team name is required
      if (!team_name) {
        return res.status(400).json({ error: 'Team name required for team tournament' });
      }

      if (team_name.length < 2 || team_name.length > 50) {
        return res.status(400).json({ error: 'Team name must be between 2 and 50 characters' });
      }

      // Get current user's info
      const currentUserResult = await query('SELECT nickname FROM users WHERE id = $1', [req.userId]);
      if (currentUserResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const currentUserNickname = currentUserResult.rows[0].nickname;

      // Check if current user is already in this tournament
      const userAlreadyInResult = await query(
        `SELECT id FROM tournament_participants 
         WHERE tournament_id = $1 AND user_id = $2 AND participation_status IN ('pending', 'unconfirmed', 'accepted')`,
        [id, req.userId]
      );
      if (userAlreadyInResult.rows.length > 0) {
        return res.status(400).json({ error: 'You are already registered in this tournament' });
      }

      // Check if trying to add self as teammate
      if (teammate_name && teammate_name.toLowerCase() === currentUserNickname.toLowerCase()) {
        return res.status(400).json({ error: 'You cannot select yourself as a teammate' });
      }

      let teammateUserId: string | null = null;

      // If teammate provided, validate and get their ID
      if (teammate_name) {
        const teammateResult = await query(
          'SELECT id FROM users WHERE LOWER(nickname) = LOWER($1)',
          [teammate_name]
        );
        if (teammateResult.rows.length === 0) {
          return res.status(400).json({ error: `User "${teammate_name}" not found` });
        }
        teammateUserId = teammateResult.rows[0].id;

        // Check if teammate is already in this tournament
        const existingParticipantResult = await query(
          `SELECT id FROM tournament_participants 
           WHERE tournament_id = $1 AND user_id = $2 AND participation_status IN ('pending', 'unconfirmed', 'accepted')`,
          [id, teammateUserId]
        );
        if (existingParticipantResult.rows.length > 0) {
          return res.status(400).json({ error: `${teammate_name} is already registered in this tournament` });
        }
      }

      // Try to find existing team with this name and exactly 1 member
      const existingTeamResult = await query(
        `SELECT tt.id, COUNT(tp.id) as member_count
         FROM tournament_teams tt
         LEFT JOIN tournament_participants tp ON tt.id = tp.team_id AND tp.participation_status IN ('pending', 'unconfirmed', 'accepted')
         WHERE tt.tournament_id = $1 AND tt.name = $2
         GROUP BY tt.id
         HAVING COUNT(tp.id) = 1`,
        [id, team_name]
      );

      if (existingTeamResult.rows.length > 0) {
        // Join existing team
        teamId = existingTeamResult.rows[0].id;
        console.log('Joining existing team:', { teamId, name: team_name });

        // Current user joins as Position 2
        await query(
          `INSERT INTO tournament_participants (tournament_id, user_id, participation_status, team_id, team_position)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, req.userId, 'pending', teamId, 2]
        );
        console.log('Player joined team at position 2');

        // If teammate provided, add them as Position 1 (unconfirmed - needs their confirmation)
        if (teammateUserId) {
          await query(
            `INSERT INTO tournament_participants (tournament_id, user_id, participation_status, team_id, team_position)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, teammateUserId, 'unconfirmed', teamId, 1]
          );
          console.log('Teammate added to team at position 1 (unconfirmed - awaiting confirmation)');
        }
      } else {
        // Check if team already exists with max members
        const fullTeamResult = await query(
          `SELECT tt.id
           FROM tournament_teams tt
           LEFT JOIN tournament_participants tp ON tt.id = tp.team_id AND tp.participation_status IN ('pending', 'unconfirmed', 'accepted')
           WHERE tt.tournament_id = $1 AND tt.name = $2
           GROUP BY tt.id
           HAVING COUNT(tp.id) >= 2`,
          [id, team_name]
        );

        if (fullTeamResult.rows.length > 0) {
          return res.status(400).json({ error: `Team "${team_name}" is already full (2/2 members)` });
        }

        // Create new team
        const createTeamResult = await query(
          `INSERT INTO tournament_teams (tournament_id, name, created_by)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [id, team_name, req.userId]
        );
        teamId = createTeamResult.rows[0].id;
        console.log('New team created:', { teamId, name: team_name });

        // Insert current user as Position 1
        await query(
          `INSERT INTO tournament_participants (tournament_id, user_id, participation_status, team_id, team_position)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, req.userId, 'pending', teamId, 1]
        );
        console.log('Player 1 added to new team');

        // If teammate provided, insert as Position 2 (unconfirmed - needs their confirmation)
        if (teammateUserId) {
          await query(
            `INSERT INTO tournament_participants (tournament_id, user_id, participation_status, team_id, team_position)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, teammateUserId, 'unconfirmed', teamId, 2]
          );
          console.log('Player 2 (teammate) added as unconfirmed - awaiting confirmation');
        }
      }
    }

    // Get user's ELO rating and nickname
    const userResult = await query('SELECT elo_rating, nickname FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      console.log('User not found:', req.userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // For non-team tournaments, insert as pending participant (existing logic)
    if (tournament.tournament_mode !== 'team') {
      await query(
        `INSERT INTO tournament_participants (tournament_id, user_id, participation_status)
         VALUES ($1, $2, $3)`,
        [id, req.userId, 'pending']
      );
    }

    // Get current participant count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM tournament_participants 
       WHERE tournament_id = $1 AND participation_status IN ('pending', 'unconfirmed', 'accepted')`,
      [id]
    );
    const currentCount = countResult.rows[0]?.count || 0;

    // Post to Discord if thread exists
    if (tournament.discord_thread_id) {
      try {
        let displayName = userResult.rows[0].nickname;
        
        if (tournament.tournament_mode === 'team') {
          if (teammate_name) {
            displayName = `${displayName} & ${teammate_name} (Team: ${team_name})`;
          } else {
            displayName = `${displayName} (Team: ${team_name})`;
          }
        }
        
        await discordService.postPlayerRegistered(
          tournament.discord_thread_id,
          displayName,
          currentCount,
          tournament.max_participants
        );
      } catch (discordError) {
        console.error('Discord notification error:', discordError);
        // Don't fail the request if Discord fails
      }
    }

    res.status(201).json({ 
      team_id: teamId,
      message: tournament.tournament_mode === 'team' 
        ? 'Team created! Both players are pending organizer approval.'
        : 'Join request sent. Waiting for organizer approval.'
    });
  } catch (error: any) {
    console.error('Request-join error:', error.message || error);
    console.error('Full error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Already requested to join this tournament' });
    }
    res.status(500).json({ error: 'Failed to request join tournament', details: error.message });
  }
});

// Accept participant (organizer only)
router.post('/:tournamentId/participants/:participantId/accept', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { tournamentId, participantId } = req.params;

    // Verify the user is the tournament creator
    const tournamentResult = await query(
      'SELECT creator_id, discord_thread_id FROM tournaments WHERE id = $1',
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournamentResult.rows[0].creator_id !== req.userId) {
      return res.status(403).json({ error: 'Only the tournament creator can accept participants' });
    }

    // Get participant info
    const participantResult = await query(
      `SELECT tp.*, u.nickname FROM tournament_participants tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.id = $1 AND tp.tournament_id = $2`,
      [participantId, tournamentId]
    );

    if (participantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    const participant = participantResult.rows[0];

    // Can only accept pending participants
    // Unconfirmed participants must first confirm (change to pending) before organizer can accept
    if (participant.participation_status !== 'pending') {
      return res.status(400).json({ 
        error: `Can only accept pending participants. This participant is ${participant.participation_status}. ` +
               (participant.participation_status === 'unconfirmed' ? 'They must confirm their participation first.' : '')
      });
    }

    // Update participant status to accepted
    const result = await query(
      `UPDATE tournament_participants 
       SET participation_status = $1 
       WHERE id = $2 AND tournament_id = $3
       RETURNING id`,
      ['accepted', participantId, tournamentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Get total accepted participants for Discord message
    const countResult = await query(
      `SELECT COUNT(*) as count FROM tournament_participants 
       WHERE tournament_id = $1 AND participation_status = 'accepted'`,
      [tournamentId]
    );
    const totalAccepted = countResult.rows[0]?.count || 0;

    // Post to Discord if thread exists
    if (tournamentResult.rows[0].discord_thread_id) {
      try {
        await discordService.postPlayerAccepted(
          tournamentResult.rows[0].discord_thread_id,
          participant.nickname,
          totalAccepted
        );
      } catch (discordError) {
        console.error('Discord notification error:', discordError);
        // Don't fail the request if Discord fails
      }
    }

    res.json({ 
      id: result.rows[0].id,
      message: 'Participant accepted successfully'
    });
  } catch (error: any) {
    console.error('Accept participant error:', error.message || error);
    res.status(500).json({ error: 'Failed to accept participant', details: error.message });
  }
});

// Confirm participation (player confirms unconfirmed status - typically second team member)
router.post('/:tournamentId/participants/:participantId/confirm', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { tournamentId, participantId } = req.params;

    // Get participant info
    const participantResult = await query(
      `SELECT tp.*, u.nickname FROM tournament_participants tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.id = $1 AND tp.tournament_id = $2`,
      [participantId, tournamentId]
    );

    if (participantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    const participant = participantResult.rows[0];

    // Only the participant themselves can confirm
    if (participant.user_id !== req.userId) {
      return res.status(403).json({ error: 'You can only confirm your own participation' });
    }

    // Can only confirm if status is unconfirmed
    if (participant.participation_status !== 'unconfirmed') {
      return res.status(400).json({ error: 'Can only confirm unconfirmed participants. Current status: ' + participant.participation_status });
    }

    // Update participant status from unconfirmed to pending
    const result = await query(
      `UPDATE tournament_participants 
       SET participation_status = $1 
       WHERE id = $2 AND tournament_id = $3
       RETURNING id`,
      ['pending', participantId, tournamentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    res.json({ 
      id: result.rows[0].id,
      message: 'Participation confirmed! Waiting for organizer approval.'
    });
  } catch (error: any) {
    console.error('Confirm participant error:', error.message || error);
    res.status(500).json({ error: 'Failed to confirm participation', details: error.message });
  }
});

// Reject participant (organizer only)
router.post('/:tournamentId/participants/:participantId/reject', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { tournamentId, participantId } = req.params;

    // Verify the user is the tournament creator
    const tournamentResult = await query(
      'SELECT creator_id, discord_thread_id FROM tournaments WHERE id = $1',
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournamentResult.rows[0].creator_id !== req.userId) {
      return res.status(403).json({ error: 'Only the tournament creator can reject participants' });
    }

    // Get participant info including nickname
    const participantResult = await query(
      `SELECT tp.*, u.nickname FROM tournament_participants tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.id = $1 AND tp.tournament_id = $2`,
      [participantId, tournamentId]
    );

    if (participantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    const participant = participantResult.rows[0];

    // Update participant status to denied
    const result = await query(
      `UPDATE tournament_participants 
       SET participation_status = $1 
       WHERE id = $2 AND tournament_id = $3
       RETURNING id`,
      ['denied', participantId, tournamentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Post to Discord if thread exists
    if (tournamentResult.rows[0].discord_thread_id) {
      try {
        // Simple notification about rejection
        const embed = {
          title: '❌ Participante Rechazado',
          description: `**${participant.nickname}** ha sido rechazado del torneo.`,
          color: 0xe74c3c,
          footer: {
            text: 'Participante rechazado',
          },
          timestamp: new Date().toISOString(),
        };
        await discordService.publishTournamentMessage(
          tournamentResult.rows[0].discord_thread_id,
          { embeds: [embed] }
        );
      } catch (discordError) {
        console.error('Discord notification error:', discordError);
        // Don't fail the request if Discord fails
      }
    }

    res.json({ 
      id: result.rows[0].id,
      message: 'Participant rejected successfully'
    });
  } catch (error: any) {
    console.error('Reject participant error:', error.message || error);
    res.status(500).json({ error: 'Failed to reject participant', details: error.message });
  }
});

// Get tournament ranking
router.get('/:id/ranking', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT tp.*, u.nickname, u.elo_rating 
       FROM tournament_participants tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.tournament_id = $1
       ORDER BY tp.tournament_points DESC, tp.tournament_wins DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tournament ranking' });
  }
});

// Close registration and prepare tournament
router.post('/:id/close-registration', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { confirm } = req.body; // confirm = true if user confirmed deletion

    // Verify tournament creator
    const tournamentCheck = await query(
      'SELECT creator_id, status, discord_thread_id, name, tournament_type, tournament_mode, max_participants, total_rounds FROM tournaments WHERE id = $1', 
      [id]
    );
    if (tournamentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tournamentCheck.rows[0];
    if (tournament.creator_id !== req.userId) {
      return res.status(403).json({ error: 'Only tournament creator can close registration' });
    }

    if (tournament.status !== 'registration_open') {
      return res.status(400).json({ error: 'Tournament registration is not open' });
    }

    // Check participants based on tournament mode
    let participantCount = 0;
    let incompleteParticipants = false;
    
    if (tournament.tournament_mode === 'team') {
      // For team tournaments: count complete teams (all members accepted)
      const teamsCheckResult = await query(
        `SELECT tt.id, COUNT(tp.id) as member_count, SUM(CASE WHEN tp.participation_status = 'accepted' THEN 1 ELSE 0 END) as accepted_count
         FROM tournament_teams tt
         LEFT JOIN tournament_participants tp ON tt.id = tp.team_id
         WHERE tt.tournament_id = $1
         GROUP BY tt.id`,
        [id]
      );

      // Count complete teams (all members accepted)
      const completeTeams = teamsCheckResult.rows.filter((team: any) => 
        team.member_count === team.accepted_count && team.member_count > 0
      );

      participantCount = completeTeams.length;

      console.log(`[CLOSE_REGISTRATION] Team mode tournament: ${completeTeams.length} complete teams out of ${teamsCheckResult.rows.length} total teams`);

      // For team tournaments, require at least 2 complete teams
      if (participantCount < 2) {
        incompleteParticipants = true;
        // If not confirmed, ask for confirmation
        if (!confirm) {
          return res.status(200).json({ 
            action: 'confirm_delete',
            message: `Team tournaments require at least 2 complete teams. Currently have ${participantCount} complete team(s). Delete tournament?`,
            requiresConfirmation: true
          });
        }
        // If confirmed, proceed to delete tournament
      }
    } else {
      // For 1v1 tournaments: count accepted individual participants
      const participantsCheck = await query(
        'SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = $1 AND participation_status = $2',
        [id, 'accepted']
      );

      participantCount = parseInt(participantsCheck.rows[0].count, 10);

      console.log(`[CLOSE_REGISTRATION] 1v1 tournament: ${participantCount} accepted participants`);

      // For 1v1 tournaments, require at least 2 participants
      if (participantCount < 2) {
        incompleteParticipants = true;
        // If not confirmed, ask for confirmation
        if (!confirm) {
          return res.status(200).json({ 
            action: 'confirm_delete',
            message: `Tournaments require at least 2 participants. Currently have ${participantCount} participant(s). Delete tournament?`,
            requiresConfirmation: true
          });
        }
        // If confirmed, proceed to delete tournament
      }
    }

    // If insufficient participants or incomplete team tournament (after confirmation)
    if (incompleteParticipants) {
      // Delete tournament and all related data
      await query('DELETE FROM tournament_rounds WHERE tournament_id = $1', [id]);
      await query('DELETE FROM tournament_matches WHERE tournament_id = $1', [id]);
      await query('DELETE FROM tournament_round_matches WHERE tournament_id = $1', [id]);
      await query('DELETE FROM matches WHERE tournament_id = $1', [id]);
      await query('DELETE FROM tournament_participants WHERE tournament_id = $1', [id]);
      await query('DELETE FROM tournament_teams WHERE tournament_id = $1', [id]);
      await query('DELETE FROM tournaments WHERE id = $1', [id]);

      return res.status(200).json({ 
        action: 'deleted',
        message: 'Tournament deleted successfully (insufficient participants)'
      });
    }

    // Calculate total_rounds for elimination tournaments if not already set
    let totalRounds = tournament.total_rounds || 0;
    if (tournament.tournament_type.toLowerCase() === 'elimination' && totalRounds === 0) {
      totalRounds = Math.ceil(Math.log2(participantCount));
    }

    // If has participants, close registration normally
    await query(
      `UPDATE tournaments 
       SET status = $1, registration_closed_at = NOW(), total_rounds = $2
       WHERE id = $3`,
      ['registration_closed', totalRounds, id]
    );

    // Post to Discord if thread exists
    if (tournament.discord_thread_id) {
      try {
        await discordService.postRegistrationClosed(
          tournament.discord_thread_id,
          participantCount
        );
      } catch (discordError) {
        console.error('Discord notification error:', discordError);
        // Don't fail the request if Discord fails
      }
    }

    res.json({ 
      action: 'closed',
      message: 'Registration closed successfully',
      next_step: 'Prepare tournament by configuring rounds before starting'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to close registration' });
  }
});

// Prepare tournament (generate rounds)
router.post('/:id/prepare', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    console.log(`[PREPARE] Starting preparation for tournament ${id}`);

    // Verify tournament creator
    const tournamentCheck = await query(
      'SELECT creator_id, status, tournament_type, general_rounds, final_rounds, general_rounds_format, final_rounds_format FROM tournaments WHERE id = $1', 
      [id]
    );
    if (tournamentCheck.rows.length === 0) {
      console.log(`[PREPARE] Tournament ${id} not found`);
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tournamentCheck.rows[0];
    console.log(`[PREPARE] Tournament data:`, tournament);
    
    const tournamentType = tournament.tournament_type?.toLowerCase() || 'elimination';
    console.log(`[PREPARE] Tournament type: ${tournamentType}, current status: ${tournament.status}, total_rounds in DB: ${tournament.total_rounds}`);
    
    if (tournament.creator_id !== req.userId) {
      console.log(`[PREPARE] Authorization failed - creator_id: ${tournament.creator_id}, userId: ${req.userId}`);
      return res.status(403).json({ error: 'Only tournament creator can prepare tournament' });
    }

    // Verify tournament is in correct status
    if (tournament.status !== 'registration_closed') {
      console.log(`[PREPARE] Invalid status: ${tournament.status}, expected: registration_closed`);
      return res.status(400).json({ error: `Tournament must have registration closed before preparing. Current status: ${tournament.status}` });
    }

    if (tournament.status !== 'registration_closed') {
      console.log(`[PREPARE] Invalid status: ${tournament.status}, expected: registration_closed`);
      return res.status(400).json({ error: 'Tournament must be registration_closed before preparation' });
    }

    // Get number of accepted participants
    const participantsResult = await query(
      `SELECT COUNT(*) as count FROM tournament_participants 
       WHERE tournament_id = $1 AND participation_status = 'accepted'`,
      [id]
    );
    const participantCount = participantsResult.rows[0]?.count || 0;
    console.log(`[PREPARE] Participant count: ${participantCount}`);

    // Calculate maximum rounds needed based on tournament type
    // Only elimination formats have a mathematical limit
    let maxRoundsNeeded = 999; // Default: no limit (for Swiss, League)
    
    if (tournamentType === 'elimination') {
      // For pure elimination: N participants need log2(N) rounds
      maxRoundsNeeded = participantCount > 0 ? Math.ceil(Math.log2(participantCount)) : 0;
    } else if (tournamentType === 'swiss_elimination') {
      // For Swiss-Elimination Mix: only final rounds are limited
      // General (Swiss) rounds can be unlimited
      // Final (elimination) rounds need log2(N) rounds
      maxRoundsNeeded = participantCount > 0 ? Math.ceil(Math.log2(participantCount)) : 0;
    }
    // For league and swiss: no mathematical limit
    
    // Total rounds requested (or use pre-calculated total_rounds for elimination)
    let totalRoundsRequested = (tournament.general_rounds || 0) + (tournament.final_rounds || 0);
    const finalRoundsRequested = tournament.final_rounds || 0;
    
    // For elimination tournaments with no explicit round config, use total_rounds if available
    if (tournamentType === 'elimination' && totalRoundsRequested === 0) {
      totalRoundsRequested = tournament.total_rounds || maxRoundsNeeded;
    }
    
    console.log(`[PREPARE] Tournament type: ${tournamentType}, Max rounds allowed: ${maxRoundsNeeded}, Total requested: ${totalRoundsRequested}, Final rounds: ${finalRoundsRequested}`);

    // Validate based on type
    if (tournamentType === 'elimination' && totalRoundsRequested > maxRoundsNeeded) {
      console.log(`[PREPARE] Validation failed: too many rounds for elimination`);
      return res.status(400).json({ 
        error: `Tournament has ${participantCount} participants but requested ${totalRoundsRequested} rounds. Maximum allowed: ${maxRoundsNeeded} rounds for elimination format.`
      });
    } else if (tournamentType === 'swiss_elimination' && finalRoundsRequested > maxRoundsNeeded) {
      console.log(`[PREPARE] Validation failed: too many final rounds for swiss-elimination`);
      return res.status(400).json({ 
        error: `Tournament has ${participantCount} participants but requested ${finalRoundsRequested} final (elimination) rounds. Maximum allowed: ${maxRoundsNeeded} elimination rounds.`
      });
    }

    // Generate tournament rounds based on configuration and tournament type
    const roundsToCreate = [];
    let roundNumber = 1;
    let totalGeneralRounds = tournament.general_rounds || 0;
    let totalFinalRounds = tournament.final_rounds || 0;
    
    // For Elimination tournaments, generate all rounds based on calculated total_rounds
    if (tournamentType === 'elimination') {
      // Use existing total_rounds, or calculate it if not set
      let totalElimRounds = tournament.total_rounds || 0;
      if (totalElimRounds === 0) {
        totalElimRounds = participantCount > 0 ? Math.ceil(Math.log2(participantCount)) : 0;
        console.log(`[PREPARE] Calculated elimination rounds for ${participantCount} participants: ${totalElimRounds}`);
      }
      
      // All elimination rounds use the general_rounds_format except the last one (final) uses final_rounds_format
      for (let i = 0; i < totalElimRounds; i++) {
        const isLastRound = (i === totalElimRounds - 1);
        let label = '';
        let classification = '';
        
        if (totalElimRounds === 1) {
          label = `Final`;
          classification = 'final';
        } else if (totalElimRounds === 2) {
          if (i === 0) {
            label = `Semifinals`;
            classification = 'semifinals';
          } else {
            label = `Final`;
            classification = 'final';
          }
        } else if (totalElimRounds === 3) {
          if (i === 0) {
            label = `Quarterfinals`;
            classification = 'quarterfinals';
          } else if (i === 1) {
            label = `Semifinals`;
            classification = 'semifinals';
          } else {
            label = `Final`;
            classification = 'final';
          }
        } else if (totalElimRounds === 4) {
          if (i === 0) {
            label = `Round of 16`;
            classification = 'round16';
          } else if (i === 1) {
            label = `Quarterfinals`;
            classification = 'quarterfinals';
          } else if (i === 2) {
            label = `Semifinals`;
            classification = 'semifinals';
          } else {
            label = `Final`;
            classification = 'final';
          }
        } else {
          label = `Round ${i + 1}`;
          classification = isLastRound ? 'final' : 'general';
        }
        
        roundsToCreate.push({
          roundNumber: i + 1,
          roundType: isLastRound ? 'final' : 'general',
          matchFormat: isLastRound ? tournament.final_rounds_format : tournament.general_rounds_format,
          label: label,
          classification: classification,
          description: label
        });
      }
      totalGeneralRounds = totalElimRounds - (totalElimRounds > 0 ? 1 : 0); // All but last are "general"
      totalFinalRounds = totalElimRounds > 0 ? 1 : 0; // Last is "final"
    }
    // For League tournaments, calculate actual rounds based on format (1=ida, 2=ida y vuelta)
    else if (tournamentType === 'league') {
      const leagueFormat = totalGeneralRounds; // 1 or 2
      // For round-robin: each player plays each other player once per format iteration
      // Rounds needed = (n-1) * format, where n = number of participants
      // This works for both even and odd number of players
      // With odd players: one "bye" per round, players rotate
      // With even players: all players play each round
      totalGeneralRounds = (participantCount - 1) * leagueFormat;
    }

    // Determine round classification based on tournament type
    let generalRoundClassification = 'standard';
    let finalRoundClassification = 'final';
    let phaseDescription = '';

    if (tournamentType === 'league') {
      generalRoundClassification = 'standard'; // League rounds
      phaseDescription = 'League round';
    } else if (tournamentType === 'swiss') {
      generalRoundClassification = 'swiss'; // Swiss rounds
      phaseDescription = 'Swiss round';
    } else if (tournamentType === 'swiss_elimination') {
      generalRoundClassification = 'general'; // Swiss phase
      finalRoundClassification = 'elimination'; // Elimination phase
      phaseDescription = 'Swiss-Elimination Mix';
    } else if (tournamentType === 'elimination') {
      generalRoundClassification = 'general'; // Elimination can have multiple phases
      finalRoundClassification = 'final';
      phaseDescription = 'Elimination tournament';
    }

    // Add general rounds (skip for pure elimination, already added above)
    if (tournamentType !== 'elimination') {
      for (let i = 0; i < totalGeneralRounds; i++) {
        let classification = generalRoundClassification;
        let label = '';

        if (tournamentType === 'league') {
          const leagueFormat = tournament.general_rounds || 1;
          const phase = leagueFormat === 2 && i >= (totalGeneralRounds / 2) ? 'Vuelta' : 'Ida';
          label = `League Round ${i + 1} (${phase})`;
        } else if (tournamentType === 'swiss') {
          label = `Swiss Round ${i + 1}`;
        } else if (tournamentType === 'swiss_elimination') {
          label = `Swiss Round ${i + 1}`;
          classification = 'general';
        }

        roundsToCreate.push({
          roundNumber,
          roundType: 'general',
          matchFormat: tournament.general_rounds_format || 'bo3',
          classification,
          label,
          description: label,
          playersRemaining: participantCount,
          playersAdvancing: participantCount
        });
        roundNumber++;
      }
    }

    // For Swiss-Elimination Mix, determine how many players advance to elimination phase
    // based on the number of final rounds: 3 rounds = 8 players, 2 rounds = 4 players, 1 round = 2 players
    let elimiationPhaseParticipants = participantCount;
    if (tournamentType === 'swiss_elimination') {
      // Calculate players needed based on final rounds
      // 1 round (Final only): 2 players
      // 2 rounds (Semis + Final): 4 players
      // 3 rounds (Quarters + Semis + Final): 8 players
      // 4 rounds: 16 players, etc.
      elimiationPhaseParticipants = Math.pow(2, totalFinalRounds);
    }

    // Add final rounds with detailed classification (skip for pure elimination, already added above)
    if (tournamentType !== 'elimination') {
      for (let i = 0; i < totalFinalRounds; i++) {
        let classification = finalRoundClassification;
        let label = 'Final';
        let playersRemaining = elimiationPhaseParticipants;
        let playersAdvancing = 1;
        let roundType = 'final';

        if (tournamentType === 'swiss_elimination') {
          // For elimination brackets
          if (totalFinalRounds === 1) {
            classification = 'final';
            label = `Final (${elimiationPhaseParticipants}→1)`;
            playersRemaining = elimiationPhaseParticipants;
            playersAdvancing = 1;
          } else if (totalFinalRounds === 2) {
            if (i === 0) {
              classification = 'semifinals';
              label = `Semifinals (${elimiationPhaseParticipants}→${Math.round(elimiationPhaseParticipants / 2)})`;
              playersRemaining = elimiationPhaseParticipants;
              playersAdvancing = Math.round(elimiationPhaseParticipants / 2);
            } else {
              classification = 'final';
              label = `Final (${Math.round(elimiationPhaseParticipants / 2)}→1)`;
              playersRemaining = Math.round(elimiationPhaseParticipants / 2);
              playersAdvancing = 1;
            }
          } else if (totalFinalRounds === 3) {
            if (i === 0) {
              classification = 'quarterfinals';
              label = `Quarterfinals (${elimiationPhaseParticipants}→${Math.round(elimiationPhaseParticipants / 2)})`;
              playersRemaining = elimiationPhaseParticipants;
              playersAdvancing = Math.round(elimiationPhaseParticipants / 2);
            } else if (i === 1) {
              classification = 'semifinals';
              label = `Semifinals (${Math.round(elimiationPhaseParticipants / 2)}→${Math.round(elimiationPhaseParticipants / 4)})`;
              playersRemaining = Math.round(elimiationPhaseParticipants / 2);
              playersAdvancing = Math.round(elimiationPhaseParticipants / 4);
            } else {
              classification = 'final';
              label = `Final (${Math.round(elimiationPhaseParticipants / 4)}→1)`;
              playersRemaining = Math.round(elimiationPhaseParticipants / 4);
              playersAdvancing = 1;
            }
          }
        }

        roundsToCreate.push({
          roundNumber,
          roundType,
          matchFormat: tournament.final_rounds_format || 'bo5',
          classification,
          label,
          description: label,
          playersRemaining,
          playersAdvancing
        });
        roundNumber++;
      }
    }

    console.log(`[PREPARE] Tournament type: ${tournamentType}, Rounds to create:`, roundsToCreate);

    // Insert generated rounds
    for (const round of roundsToCreate) {
      console.log(`[PREPARE] Inserting round ${round.roundNumber}: ${round.label} [${round.classification}]`);
      const insertResult = await query(
        `INSERT INTO tournament_rounds (tournament_id, round_number, round_type, match_format, round_status, round_phase_label, round_phase_description, round_classification, players_remaining, players_advancing_to_next)
         VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9)`,
        [id, round.roundNumber, round.roundType, round.matchFormat, round.label, round.description, round.classification, round.playersRemaining, round.playersAdvancing]
      );
      console.log(`[PREPARE] Round ${round.roundNumber} inserted successfully`);
    }

    // Update tournament status
    console.log(`[PREPARE] Updating tournament status to prepared`);
    const totalCalculatedRounds = totalGeneralRounds + totalFinalRounds;
    console.log(`[PREPARE] Updating total_rounds to ${totalCalculatedRounds} (${totalGeneralRounds} general + ${totalFinalRounds} final)`);
    await query(
      `UPDATE tournaments 
       SET status = $1, prepared_at = NOW(), current_round = 1, total_rounds = $3
       WHERE id = $2`,
      ['prepared', id, totalCalculatedRounds]
    );
    console.log(`[PREPARE] Tournament status updated`);

    res.json({ 
      message: 'Tournament prepared successfully',
      rounds_created: roundsToCreate.length,
      next_step: 'Start tournament when ready'
    });
  } catch (error) {
    console.error(`[PREPARE] Error preparing tournament:`, error);
    res.status(500).json({ error: 'Failed to prepare tournament', details: String(error) });
  }
});

// Start tournament - activates first round and changes status to in_progress
router.post('/:id/start', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    console.log(`[START] Starting tournament ${id}`);

    // Verify tournament creator
    const tournamentCheck = await query(
      `SELECT creator_id, status, general_rounds, final_rounds, general_rounds_format, final_rounds_format, tournament_type, name, discord_thread_id
       FROM tournaments WHERE id = $1`, 
      [id]
    );
    if (tournamentCheck.rows.length === 0) {
      console.log(`[START] Tournament ${id} not found`);
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tournamentCheck.rows[0];
    console.log(`[START] Tournament data:`, tournament);
    
    if (tournament.creator_id !== req.userId) {
      console.log(`[START] Authorization failed`);
      return res.status(403).json({ error: 'Only tournament creator can start tournament' });
    }

    if (tournament.status !== 'prepared') {
      console.log(`[START] Invalid status: ${tournament.status}, expected: prepared`);
      return res.status(400).json({ error: 'Tournament must be prepared before starting' });
    }

    // Verify participants before starting
    const participantsCheck = await query(
      `SELECT COUNT(*) as accepted_count FROM tournament_participants 
       WHERE tournament_id = $1 AND participation_status = 'accepted'`,
      [id]
    );
    const acceptedParticipants = participantsCheck.rows[0].accepted_count;
    console.log(`[START] Tournament ${id} has ${acceptedParticipants} accepted participants`);
    
    if (acceptedParticipants === 0) {
      return res.status(400).json({ error: 'No accepted participants in tournament' });
    }

    // Check if rounds already exist
    const roundsCheck = await query(
      `SELECT COUNT(*) as round_count FROM tournament_rounds 
       WHERE tournament_id = $1`,
      [id]
    );
    let roundCount = parseInt(roundsCheck.rows[0].round_count) || 0;
    console.log(`[START] Tournament ${id} currently has ${roundCount} rounds`);
    
    // If no rounds exist, create them now
    if (roundCount === 0) {
      console.log(`[START] No rounds found, creating them now`);
      
      // Get tournament type
      const tournamentType = tournament.tournament_type?.toLowerCase() || 'elimination';
      console.log(`[START] Tournament type: ${tournamentType}`);
      
      // Calculate maximum rounds needed for elimination tournament
      const maxRoundsNeeded = acceptedParticipants > 0 ? Math.ceil(Math.log2(acceptedParticipants)) : 0;
      
      // Total rounds requested - for elimination, use total_rounds if available
      let totalRoundsRequested = (tournament.general_rounds || 0) + (tournament.final_rounds || 0);
      if (tournamentType === 'elimination' && totalRoundsRequested === 0) {
        totalRoundsRequested = tournament.total_rounds || maxRoundsNeeded;
      }
      console.log(`[START] Max rounds needed: ${maxRoundsNeeded}, Total requested: ${totalRoundsRequested}`);

      if (totalRoundsRequested > maxRoundsNeeded) {
        console.log(`[START] Validation failed: too many rounds`);
        return res.status(400).json({ 
          error: `Tournament has ${acceptedParticipants} participants but requested ${totalRoundsRequested} rounds. Maximum allowed: ${maxRoundsNeeded} rounds for elimination format.`
        });
      }

      // Generate tournament rounds based on configuration
      const roundsToCreate = [];
      let roundNumber = 1;

      // For pure elimination, generate rounds differently
      if (tournamentType === 'elimination') {
        const totalElimRounds = totalRoundsRequested || maxRoundsNeeded;
        console.log(`[START] Creating ${totalElimRounds} elimination rounds`);
        
        for (let i = 0; i < totalElimRounds; i++) {
          const isLastRound = (i === totalElimRounds - 1);
          let label = '';
          let classification = '';
          
          if (totalElimRounds === 1) {
            label = 'Final';
            classification = 'final';
          } else if (totalElimRounds === 2) {
            if (i === 0) {
              label = 'Semifinals';
              classification = 'semifinals';
            } else {
              label = 'Final';
              classification = 'final';
            }
          } else if (totalElimRounds === 3) {
            if (i === 0) {
              label = 'Quarterfinals';
              classification = 'quarterfinals';
            } else if (i === 1) {
              label = 'Semifinals';
              classification = 'semifinals';
            } else {
              label = 'Final';
              classification = 'final';
            }
          } else if (totalElimRounds === 4) {
            if (i === 0) {
              label = 'Round of 16';
              classification = 'round16';
            } else if (i === 1) {
              label = 'Quarterfinals';
              classification = 'quarterfinals';
            } else if (i === 2) {
              label = 'Semifinals';
              classification = 'semifinals';
            } else {
              label = 'Final';
              classification = 'final';
            }
          } else {
            label = `Round ${i + 1}`;
            classification = isLastRound ? 'final' : 'general';
          }
          
          roundsToCreate.push({
            roundNumber,
            roundType: isLastRound ? 'final' : 'general',
            matchFormat: isLastRound ? (tournament.final_rounds_format || 'bo5') : (tournament.general_rounds_format || 'bo3'),
            label,
            classification,
            description: label
          });
          roundNumber++;
        }
      } else {
        // For other tournament types, use general_rounds and final_rounds
        // Add general rounds
        for (let i = 0; i < (tournament.general_rounds || 0); i++) {
          roundsToCreate.push({
            roundNumber,
            roundType: 'general',
            matchFormat: tournament.general_rounds_format || 'bo3'
          });
          roundNumber++;
        }

        // Add final rounds
        for (let i = 0; i < (tournament.final_rounds || 0); i++) {
          roundsToCreate.push({
            roundNumber,
            roundType: 'final',
            matchFormat: tournament.final_rounds_format || 'bo5'
          });
          roundNumber++;
        }
      }

      console.log(`[START] Rounds to create:`, roundsToCreate);

      // Insert generated rounds
      for (const round of roundsToCreate) {
        console.log(`[START] Inserting round ${round.roundNumber} (${round.roundType}): ${round.label || 'N/A'}`);
        await query(
          `INSERT INTO tournament_rounds (tournament_id, round_number, round_type, match_format, round_status, round_phase_label, round_phase_description, round_classification)
           VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)`,
          [id, round.roundNumber, round.roundType, round.matchFormat, round.label || '', round.description || '', round.classification || '']
        );
        console.log(`[START] Round ${round.roundNumber} inserted successfully`);
      }

      roundCount = roundsToCreate.length;
      console.log(`[START] Created ${roundCount} rounds`);
    }

    // Update tournament status to in_progress
    console.log(`[START] Updating tournament status to in_progress`);
    await query(
      `UPDATE tournaments 
       SET status = $1, started_at = NOW()
       WHERE id = $2`,
      ['in_progress', id]
    );
    console.log(`[START] Tournament ${id} status updated to in_progress`);

    // Post tournament started notification to Discord FIRST
    if (tournament.discord_thread_id) {
      try {
        await discordService.postTournamentStarted(
          tournament.discord_thread_id,
          tournament.name,
          acceptedParticipants,
          roundCount
        );
        console.log(`[START] Posted tournament started notification to Discord`);
      } catch (discordError) {
        console.error('Discord tournament started notification error:', discordError);
        // Don't fail the request if Discord fails
      }
    }

    // Activate first round to generate initial matches
    try {
      console.log(`[START] Attempting to activate round 1 for tournament ${id}`);
      await activateRound(id, 1);
      console.log(`[START] Round 1 activated successfully for tournament ${id}`);

      // Get round details for Discord notification
      const roundDetailsResult = await query(
        `SELECT COUNT(*) as match_count FROM tournament_matches tm
         JOIN tournament_rounds tr ON tm.round_id = tr.id
         WHERE tr.tournament_id = $1 AND tr.round_number = 1`,
        [id]
      );
      const matchesCount = parseInt(roundDetailsResult.rows[0]?.match_count || '0');

      // Post round started notification to Discord
      if (tournament.discord_thread_id) {
        try {
          const estimatedEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          await discordService.postRoundStarted(
            tournament.discord_thread_id,
            1,
            matchesCount,
            estimatedEndDate
          );
          console.log(`[START] Posted round started notification to Discord`);
        } catch (discordErr) {
          console.error('Discord round start notification error:', discordErr);
        }
      }

      // Post matchups notification to Discord
      if (tournament.discord_thread_id) {
        try {
          const matchupsResult = await query(
            `SELECT trm.player1_id, trm.player2_id, u1.nickname as player1_nickname, u2.nickname as player2_nickname
             FROM tournament_round_matches trm
             LEFT JOIN users u1 ON trm.player1_id = u1.id
             LEFT JOIN users u2 ON trm.player2_id = u2.id
             WHERE trm.round_id IN (SELECT id FROM tournament_rounds WHERE tournament_id = $1 AND round_number = 1)`,
            [id]
          );
          
          if (matchupsResult.rows.length > 0) {
            const matchups = matchupsResult.rows.map(m => ({
              player1: m.player1_nickname || 'Unknown',
              player2: m.player2_nickname || 'Unknown'
            }));
            
            await discordService.postMatchups(
              tournament.discord_thread_id,
              1,
              matchups
            );
            console.log(`[START] Posted matchups notification to Discord`);
          }
        } catch (discordErr) {
          console.error('Discord matchups notification error:', discordErr);
        }
      }
    } catch (err) {
      console.error(`[START] Warning: Could not activate first round for tournament ${id}:`, err);
      // Don't fail the tournament start if round activation fails
    }

    res.json({ 
      message: 'Tournament started successfully',
      rounds_count: roundCount,
      status: 'in_progress',
      first_round_activated: true
    });
  } catch (error) {
    console.error('[START] Error starting tournament:', error);
    res.status(500).json({ error: 'Failed to start tournament', details: String(error) });
  }
});

// Get tournament matches for a specific round
router.get('/:tournamentId/rounds/:roundId/matches', async (req, res) => {
  try {
    const { tournamentId, roundId } = req.params;

    // First, get tournament mode
    const tournamentModeResult = await query(
      `SELECT tournament_mode FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentModeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournamentMode = tournamentModeResult.rows[0].tournament_mode || 'ranked';

    // Build dynamic query based on tournament mode
    let selectClause, joinClause;
    
    if (tournamentMode === 'team') {
      // Team mode: get team names from tournament_teams, map from tournament_matches (no factions for team)
      selectClause = `
        tm.id,
        tm.tournament_id,
        tm.round_id,
        tm.player1_id,
        tm.player2_id,
        tm.winner_id,
        tm.match_id,
        tm.match_status,
        tm.played_at,
        tt1.name as player1_nickname,
        tt2.name as player2_nickname,
        tt_winner.name as winner_nickname,
        (CASE WHEN tm.player1_id = tm.winner_id THEN tt2.name ELSE tt1.name END) as loser_nickname,
        tm.map,
        NULL as winner_faction,
        NULL as loser_faction,
        m.id as reported_match_id,
        m.status as reported_match_status,
        TRUE as is_team_mode
      `;
      joinClause = `
        FROM tournament_matches tm
        LEFT JOIN tournament_teams tt1 ON tm.player1_id = tt1.id
        LEFT JOIN tournament_teams tt2 ON tm.player2_id = tt2.id
        LEFT JOIN tournament_teams tt_winner ON tm.winner_id = tt_winner.id
        LEFT JOIN matches m ON tm.match_id = m.id
      `;
    } else if (tournamentMode === 'unranked') {
      // Unranked 1v1: get player names from users, match details from tournament_matches
      selectClause = `
        tm.id,
        tm.tournament_id,
        tm.round_id,
        tm.player1_id,
        tm.player2_id,
        tm.winner_id,
        tm.match_id,
        tm.match_status,
        tm.played_at,
        u1.nickname as player1_nickname,
        u2.nickname as player2_nickname,
        uw.nickname as winner_nickname,
        (CASE WHEN tm.player1_id = tm.winner_id THEN u2.nickname ELSE u1.nickname END) as loser_nickname,
        tm.map,
        tm.winner_faction,
        tm.loser_faction,
        m.id as reported_match_id,
        m.status as reported_match_status,
        FALSE as is_team_mode
      `;
      joinClause = `
        FROM tournament_matches tm
        LEFT JOIN users u1 ON tm.player1_id = u1.id
        LEFT JOIN users u2 ON tm.player2_id = u2.id
        LEFT JOIN users uw ON tm.winner_id = uw.id
        LEFT JOIN matches m ON tm.match_id = m.id
      `;
    } else {
      // Ranked 1v1: get player names from users, match details from matches table
      selectClause = `
        tm.id,
        tm.tournament_id,
        tm.round_id,
        tm.player1_id,
        tm.player2_id,
        tm.winner_id,
        tm.match_id,
        tm.match_status,
        tm.played_at,
        u1.nickname as player1_nickname,
        u2.nickname as player2_nickname,
        uw.nickname as winner_nickname,
        ul.nickname as loser_nickname,
        m.map,
        m.winner_faction,
        m.loser_faction,
        m.id as reported_match_id,
        m.status as reported_match_status,
        FALSE as is_team_mode
      `;
      joinClause = `
        FROM tournament_matches tm
        LEFT JOIN users u1 ON tm.player1_id = u1.id
        LEFT JOIN users u2 ON tm.player2_id = u2.id
        LEFT JOIN users uw ON tm.winner_id = uw.id
        LEFT JOIN matches m ON tm.match_id = m.id
        LEFT JOIN users ul ON m.loser_id = ul.id
      `;
    }

    const result = await query(
      `SELECT ${selectClause}
       ${joinClause}
       WHERE tm.tournament_id = $1 AND tm.round_id = $2
       ORDER BY tm.created_at ASC`,
      [tournamentId, roundId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tournament matches:', error);
    res.status(500).json({ error: 'Failed to fetch tournament matches' });
  }
});

// Get tournament round matches (from tournament_round_matches table)
router.get('/:tournamentId/round-matches', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    // First, get tournament mode
    const tournamentModeResult = await query(
      `SELECT tournament_mode FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentModeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const isTeamMode = tournamentModeResult.rows[0].tournament_mode === 'team';

    // Build dynamic query based on tournament mode
    let selectClause, joinClause;
    
    if (isTeamMode) {
      // Team mode: get team names from tournament_teams
      selectClause = `
        trm.id,
        trm.tournament_id,
        trm.round_id,
        trm.player1_id,
        trm.player2_id,
        trm.winner_id,
        trm.player1_wins,
        trm.player2_wins,
        trm.best_of,
        trm.series_status,
        tr.round_number,
        tr.round_type,
        tt1.name as player1_nickname,
        tt2.name as player2_nickname,
        tt_winner.name as winner_nickname,
        TRUE as is_team_mode
      `;
      joinClause = `
        FROM tournament_round_matches trm
        JOIN tournament_rounds tr ON trm.round_id = tr.id
        LEFT JOIN tournament_teams tt1 ON trm.player1_id = tt1.id
        LEFT JOIN tournament_teams tt2 ON trm.player2_id = tt2.id
        LEFT JOIN tournament_teams tt_winner ON trm.winner_id = tt_winner.id
      `;
    } else {
      // 1v1 mode: get player names from users (original behavior)
      selectClause = `
        trm.id,
        trm.tournament_id,
        trm.round_id,
        trm.player1_id,
        trm.player2_id,
        trm.winner_id,
        trm.player1_wins,
        trm.player2_wins,
        trm.best_of,
        trm.series_status,
        tr.round_number,
        tr.round_type,
        u1.nickname as player1_nickname,
        u2.nickname as player2_nickname,
        uw.nickname as winner_nickname,
        FALSE as is_team_mode
      `;
      joinClause = `
        FROM tournament_round_matches trm
        JOIN tournament_rounds tr ON trm.round_id = tr.id
        LEFT JOIN users u1 ON trm.player1_id = u1.id
        LEFT JOIN users u2 ON trm.player2_id = u2.id
        LEFT JOIN users uw ON trm.winner_id = uw.id
      `;
    }

    const result = await query(
      `SELECT ${selectClause}
       ${joinClause}
       WHERE trm.tournament_id = $1
       ORDER BY tr.round_number ASC, trm.created_at ASC`,
      [tournamentId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tournament round matches:', error);
    res.status(500).json({ error: 'Failed to fetch tournament round matches' });
  }
});

// Get all tournament matches (individual matches from tournament_matches table)
router.get('/:tournamentId/matches', async (req, res) => {
  try {
    const { tournamentId } = req.params;

    // First, get tournament mode
    const tournamentModeResult = await query(
      `SELECT tournament_mode FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentModeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournamentMode = tournamentModeResult.rows[0].tournament_mode || 'ranked';

    // Build dynamic query based on tournament mode
    let selectClause, joinClause;
    
    if (tournamentMode === 'team') {
      // Team mode: get team names from tournament_teams, map from tournament_matches (no factions for team)
      selectClause = `
        tm.id,
        tm.tournament_id,
        tm.round_id,
        tm.player1_id,
        tm.player2_id,
        tm.winner_id,
        tm.match_id,
        tm.match_status,
        tm.played_at,
        tr.round_number,
        tt1.name as player1_nickname,
        tt2.name as player2_nickname,
        tt_winner.name as winner_nickname,
        (CASE WHEN tm.player1_id = tm.winner_id THEN tt2.name ELSE tt1.name END) as loser_nickname,
        m.status as match_status_from_matches,
        tm.map,
        NULL as winner_faction,
        NULL as loser_faction,
        m.winner_comments,
        m.loser_comments,
        m.replay_file_path,
        m.replay_downloads,
        TRUE as is_team_mode
      `;
      joinClause = `
        FROM tournament_matches tm
        JOIN tournament_rounds tr ON tm.round_id = tr.id
        LEFT JOIN tournament_teams tt1 ON tm.player1_id = tt1.id
        LEFT JOIN tournament_teams tt2 ON tm.player2_id = tt2.id
        LEFT JOIN tournament_teams tt_winner ON tm.winner_id = tt_winner.id
        LEFT JOIN matches m ON tm.match_id = m.id
      `;
    } else if (tournamentMode === 'unranked') {
      // Unranked 1v1: get player names from users, match details from tournament_matches
      selectClause = `
        tm.id,
        tm.tournament_id,
        tm.round_id,
        tm.player1_id,
        tm.player2_id,
        tm.winner_id,
        tm.match_id,
        tm.match_status,
        tm.played_at,
        tr.round_number,
        u1.nickname as player1_nickname,
        u2.nickname as player2_nickname,
        uw.nickname as winner_nickname,
        (CASE WHEN tm.player1_id = tm.winner_id THEN u2.nickname ELSE u1.nickname END) as loser_nickname,
        m.status as match_status_from_matches,
        tm.map,
        tm.winner_faction,
        tm.loser_faction,
        m.winner_comments,
        m.loser_comments,
        m.replay_file_path,
        m.replay_downloads,
        FALSE as is_team_mode
      `;
      joinClause = `
        FROM tournament_matches tm
        JOIN tournament_rounds tr ON tm.round_id = tr.id
        LEFT JOIN users u1 ON tm.player1_id = u1.id
        LEFT JOIN users u2 ON tm.player2_id = u2.id
        LEFT JOIN users uw ON tm.winner_id = uw.id
        LEFT JOIN matches m ON tm.match_id = m.id
      `;
    } else {
      // Ranked 1v1: get player names from users, match details from matches table
      selectClause = `
        tm.id,
        tm.tournament_id,
        tm.round_id,
        tm.player1_id,
        tm.player2_id,
        tm.winner_id,
        tm.match_id,
        tm.match_status,
        tm.played_at,
        tr.round_number,
        u1.nickname as player1_nickname,
        u2.nickname as player2_nickname,
        uw.nickname as winner_nickname,
        ul.nickname as loser_nickname,
        m.status as match_status_from_matches,
        m.map,
        m.winner_faction,
        m.loser_faction,
        m.winner_comments,
        m.loser_comments,
        m.replay_file_path,
        m.replay_downloads,
        FALSE as is_team_mode
      `;
      joinClause = `
        FROM tournament_matches tm
        JOIN tournament_rounds tr ON tm.round_id = tr.id
        LEFT JOIN users u1 ON tm.player1_id = u1.id
        LEFT JOIN users u2 ON tm.player2_id = u2.id
        LEFT JOIN matches m ON tm.match_id = m.id
        LEFT JOIN users uw ON m.winner_id = uw.id
        LEFT JOIN users ul ON m.loser_id = ul.id
      `;
    }

    const result = await query(
      `SELECT ${selectClause}
       ${joinClause}
       WHERE tm.tournament_id = $1
       ORDER BY tr.round_number ASC, tm.created_at ASC`,
      [tournamentId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tournament matches:', error);
    res.status(500).json({ error: 'Failed to fetch tournament matches' });
  }
});

    // Record match result for a tournament match
router.post('/:tournamentId/matches/:matchId/result', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { tournamentId, matchId } = req.params;
    const { winner_id, reported_match_id } = req.body;

    // Verify the user is either the tournament creator or one of the players
    const matchResult = await query(
      `SELECT tm.*, t.creator_id, t.tournament_mode FROM tournament_matches tm
       JOIN tournaments t ON tm.tournament_id = t.id
       WHERE tm.id = $1 AND tm.tournament_id = $2`,
      [matchId, tournamentId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];
    const isCreator = match.creator_id === req.userId;
    const tournamentMode = match.tournament_mode;

    let finalWinnerId = winner_id;
    let isPlayer = false;

    if (tournamentMode === 'team') {
      // For team tournaments: validate user is in one of the teams and get their team_id
      const userTeamResult = await query(
        `SELECT tp.team_id FROM tournament_participants tp
         WHERE tp.tournament_id = $1 AND tp.user_id = $2`,
        [tournamentId, req.userId]
      );

      if (userTeamResult.rows.length === 0 && !isCreator) {
        return res.status(403).json({ error: 'You are not a participant in this tournament' });
      }

      if (userTeamResult.rows.length > 0) {
        const userTeamId = userTeamResult.rows[0].team_id;
        isPlayer = match.player1_id === userTeamId || match.player2_id === userTeamId;
        
        if (!isCreator && !isPlayer) {
          return res.status(403).json({ error: 'You cannot record results for this match' });
        }

        // If the user is reporting, use their team_id as the winner
        if (!isCreator && isPlayer) {
          finalWinnerId = userTeamId;
        }
      }
    } else {
      // For non-team tournaments: check if user is one of the players
      isPlayer = match.player1_id === req.userId || match.player2_id === req.userId;

      if (!isCreator && !isPlayer) {
        return res.status(403).json({ error: 'You cannot record results for this match' });
      }
    }

    // Update tournament match with result
    const updateResult = await query(
      `UPDATE tournament_matches 
       SET winner_id = $1, match_id = $2, match_status = 'completed', played_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [finalWinnerId, reported_match_id || null, matchId]
    );

    // NOTE: Best Of series is already updated in /api/matches/report-json
    // We just need to verify the round is complete
    const roundMatchResult = await query(
      `SELECT round_id FROM tournament_matches WHERE id = $1`,
      [matchId]
    );

    if (roundMatchResult.rows.length > 0) {
      const roundId: string = roundMatchResult.rows[0].round_id;
      
      // Get round number to check if round is complete
      const roundNumberResult = await query(
        `SELECT round_number, tournament_id FROM tournament_rounds WHERE id = $1`,
        [roundId]
      );
      if (roundNumberResult.rows.length > 0) {
        const { round_number, tournament_id } = roundNumberResult.rows[0];
        await checkAndCompleteRound(tournament_id, round_number);
      }
    }

    res.json({
      message: 'Match result recorded',
      match: updateResult.rows[0]
    });
  } catch (error: any) {
    console.error('Error recording match result:', error);
    res.status(500).json({ error: 'Failed to record match result', details: error.message });
  }
});

// Organizer determines match winner manually (no ELO impact, tournament result only)
// Handles single matches and automatically completes Best Of series
// Also marks all pending matches of the loser as losses
router.post('/:tournamentId/matches/:matchId/determine-winner', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { tournamentId, matchId } = req.params;
    const { winner_id } = req.body;

    if (!winner_id) {
      return res.status(400).json({ error: 'winner_id is required' });
    }

    // Verify the user is the tournament creator
    const matchResult = await query(
      `SELECT tm.*, t.creator_id FROM tournament_matches tm
       JOIN tournaments t ON tm.tournament_id = t.id
       WHERE tm.id = $1 AND tm.tournament_id = $2`,
      [matchId, tournamentId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];
    const isCreator = match.creator_id === req.userId;

    if (!isCreator) {
      return res.status(403).json({ error: 'Only the tournament organizer can determine match winners' });
    }

    // Verify winner is one of the match players
    if (winner_id !== match.player1_id && match.player2_id) {
      if (winner_id !== match.player2_id) {
        return res.status(400).json({ error: 'Winner must be one of the match players' });
      }
    }

    const loser_id = winner_id === match.player1_id ? match.player2_id : match.player1_id;

    // Get round information
    const roundResult = await query(
      `SELECT round_id FROM tournament_matches WHERE id = $1`,
      [matchId]
    );

    const roundId = roundResult.rows[0].round_id;

    // Get ALL matches of the loser in this round (including the selected one)
    const loserAllMatches = await query(
      `SELECT id, player1_id, player2_id, match_status FROM tournament_matches 
       WHERE round_id = $1 
       AND (player1_id = $2 OR player2_id = $2) 
       ORDER BY created_at`,
      [roundId, loser_id]
    );

    // Include the selected match in the list (it might already be there)
    const loserMatchIds = Array.from(
      new Set([...loserAllMatches.rows.map(m => m.id), matchId])
    );

    // Track matches that are part of series being completed
    const seriesMatchIds = new Set<string>();
    let loserLossCount = 0;

    // Process each match of the loser with unified logic
    for (const loserMatchId of loserMatchIds) {
      const loserMatch = await query(
        `SELECT player1_id, player2_id FROM tournament_matches WHERE id = $1`,
        [loserMatchId]
      );

      if (loserMatch.rows.length === 0) continue;

      const opponent_id = loserMatch.rows[0].player1_id === loser_id 
        ? loserMatch.rows[0].player2_id 
        : loserMatch.rows[0].player1_id;

      // Determine organizer action based on selected match
      const organizer_action = loserMatchId === matchId ? 'organizer_win' : 'organizer_loss';

      // Update the match with winner and organizer_action
      await query(
        `UPDATE tournament_matches 
         SET winner_id = $1, match_status = 'completed', played_at = NOW(),
             organizer_action = $2, updated_at = NOW()
         WHERE id = $3`,
        [opponent_id, organizer_action, loserMatchId]
      );

      // Update tournament_round_matches if this match is part of a series
      const roundMatchForLosersMatch = await query(
        `SELECT trm.id, trm.player1_id, trm.player2_id, trm.player1_wins, trm.player2_wins, 
                trm.wins_required, trm.best_of, trm.series_status
         FROM tournament_round_matches trm
         WHERE trm.id IN (
           SELECT tournament_round_match_id FROM tournament_matches WHERE id = $1
         )`,
        [loserMatchId]
      );

      if (roundMatchForLosersMatch.rows.length > 0) {
        const rmatch = roundMatchForLosersMatch.rows[0];
        let p1_wins = rmatch.player1_wins;
        let p2_wins = rmatch.player2_wins;

        // Update wins based on who won this match
        if (opponent_id === rmatch.player1_id) {
          p1_wins += 1;
        } else {
          p2_wins += 1;
        }

        // Check if series is complete
        const seriesComplete = p1_wins >= rmatch.wins_required || p2_wins >= rmatch.wins_required;
        const newSeriesStatus = seriesComplete ? 'completed' : 'in_progress';
        const newWinnerId = seriesComplete
          ? (p1_wins >= rmatch.wins_required ? rmatch.player1_id : rmatch.player2_id)
          : null;

        // Update tournament_round_matches
        await query(
          `UPDATE tournament_round_matches 
           SET player1_wins = $1, player2_wins = $2, series_status = $3, winner_id = $4, updated_at = NOW()
           WHERE id = $5`,
          [p1_wins, p2_wins, newSeriesStatus, newWinnerId, rmatch.id]
        );

        // If series is complete due to this match, mark remaining pending matches as organizer_win
        if (rmatch.best_of > 1 && seriesComplete) {
          const remainingMatches = await query(
            `SELECT id FROM tournament_matches 
             WHERE tournament_round_match_id = $1 AND match_status = 'pending'
             ORDER BY created_at`,
            [rmatch.id]
          );

          for (const remainingMatch of remainingMatches.rows) {
            seriesMatchIds.add(remainingMatch.id);
            await query(
              `UPDATE tournament_matches 
               SET winner_id = $1, match_status = 'completed', played_at = NOW(),
                   organizer_action = 'organizer_win', updated_at = NOW()
               WHERE id = $2`,
              [newWinnerId, remainingMatch.id]
            );
          }
        }
      }

      loserLossCount++;
    }

    // Update loser's tournament record with losses
    const loserParticipantResult = await query(
      `SELECT id FROM tournament_participants 
       WHERE tournament_id = $1 AND user_id = $2`,
      [tournamentId, loser_id]
    );

    if (loserParticipantResult.rows.length > 0) {
      const loserParticipantId = loserParticipantResult.rows[0].id;
      
      // Add losses for all the loser's matches
      await query(
        `UPDATE tournament_participants 
         SET tournament_losses = tournament_losses + $1 
         WHERE id = $2`,
        [loserLossCount, loserParticipantId]
      );
    }

    // Update winner's tournament record with wins and points
    const winnerParticipantResult = await query(
      `SELECT id FROM tournament_participants 
       WHERE tournament_id = $1 AND user_id = $2`,
      [tournamentId, winner_id]
    );

    if (winnerParticipantResult.rows.length > 0) {
      const winnerParticipantId = winnerParticipantResult.rows[0].id;
      
      // Add wins and points for all matches won (1 point per victory, consistent with normal logic)
      await query(
        `UPDATE tournament_participants 
         SET tournament_wins = tournament_wins + $1, tournament_points = tournament_points + $1 
         WHERE id = $2`,
        [loserLossCount, winnerParticipantId]
      );
    }

    // Check if round is complete
    const roundNumberResult = await query(
      `SELECT round_number, tournament_id FROM tournament_rounds WHERE id = $1`,
      [roundId]
    );
    
    if (roundNumberResult.rows.length > 0) {
      const { round_number, tournament_id } = roundNumberResult.rows[0];
      await checkAndCompleteRound(tournament_id, round_number);
    }

    // Fetch the updated match to return
    const finalMatchResult = await query(
      `SELECT * FROM tournament_matches WHERE id = $1`,
      [matchId]
    );

    console.log(`Tournament organizer ${req.userId} determined winner for match ${matchId}: ${winner_id} (loser: ${loser_id})`);

    res.json({
      message: 'Match winner determined by organizer (no ELO impact). All matches of loser marked as losses.',
      match: finalMatchResult.rows[0]
    });
  } catch (error: any) {
    console.error('Error determining match winner:', error);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    res.status(500).json({ 
      error: 'Failed to determine match winner', 
      details: error.message,
      code: error.code 
    });
  }
});

// Activate next round - moves to the following round and generates new matches
router.post('/:id/next-round', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Verify creator owns this tournament
    const tournamentResult = await query(
      'SELECT id, creator_id, status FROM tournaments WHERE id = $1',
      [id]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournament = tournamentResult.rows[0];

    // Only creator can activate next round
    if (tournament.creator_id !== req.userId) {
      return res.status(403).json({ error: 'Only tournament creator can activate next round' });
    }

    // Tournament must be in progress
    if (tournament.status !== 'in_progress') {
      return res.status(400).json({ error: 'Tournament must be in progress to activate next round' });
    }

    // Find the currently completed round (most recent completed round)
    const activeRoundResult = await query(
      `SELECT round_number FROM tournament_rounds 
       WHERE tournament_id = $1 AND round_status = 'completed'
       ORDER BY round_number DESC LIMIT 1`,
      [id]
    );

    if (activeRoundResult.rows.length === 0) {
      return res.status(400).json({ error: 'No completed round found. Start tournament and complete at least one round first' });
    }

    const currentRoundNum = activeRoundResult.rows[0].round_number;
    const nextRoundNum = currentRoundNum + 1;

    // Find next round record
    const nextRoundResult = await query(
      `SELECT id FROM tournament_rounds 
       WHERE tournament_id = $1 AND round_number = $2`,
      [id, nextRoundNum]
    );

    if (nextRoundResult.rows.length === 0) {
      return res.status(400).json({ error: `No round ${nextRoundNum} configured for this tournament` });
    }

    const nextRoundId = nextRoundResult.rows[0].id;

    // Activate the next round
    await activateRound(id, nextRoundNum);

    console.log(`✅ Activated next round: tournament=${id}, round_number=${nextRoundNum}`);

    // Get tournament info for Discord notification
    const tournamentInfoForNotify = await query(
      'SELECT discord_thread_id FROM tournaments WHERE id = $1',
      [id]
    );

    // Get round details for Discord notification
    const roundDetailsResult2 = await query(
      `SELECT COUNT(*) as match_count FROM tournament_matches tm
       JOIN tournament_rounds tr ON tm.round_id = tr.id
       WHERE tr.tournament_id = $1 AND tr.round_number = $2`,
      [id, nextRoundNum]
    );
    const matchesCount2 = parseInt(roundDetailsResult2.rows[0]?.match_count || '0');

    // Post round started notification to Discord
    if (tournamentInfoForNotify.rows[0]?.discord_thread_id) {
      try {
        const estimatedEndDate2 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await discordService.postRoundStarted(
          tournamentInfoForNotify.rows[0].discord_thread_id,
          nextRoundNum,
          matchesCount2,
          estimatedEndDate2
        );
      } catch (discordErr) {
        console.error('Discord round start notification error:', discordErr);
      }

      // Post matchups notification to Discord
      try {
        const matchupsResult = await query(
          `SELECT trm.player1_id, trm.player2_id, u1.nickname as player1_nickname, u2.nickname as player2_nickname
           FROM tournament_round_matches trm
           LEFT JOIN users u1 ON trm.player1_id = u1.id
           LEFT JOIN users u2 ON trm.player2_id = u2.id
           WHERE trm.round_id = $1`,
          [nextRoundId]
        );
        
        if (matchupsResult.rows.length > 0) {
          const matchups = matchupsResult.rows.map(m => ({
            player1: m.player1_nickname || 'Unknown',
            player2: m.player2_nickname || 'Unknown'
          }));
          
          await discordService.postMatchups(
            tournamentInfoForNotify.rows[0].discord_thread_id,
            nextRoundNum,
            matchups
          );
        }
      } catch (discordErr) {
        console.error('Discord matchups notification error:', discordErr);
      }
    }

    res.json({ 
      message: `Round ${nextRoundNum} activated successfully`,
      round_number: nextRoundNum,
      round_id: nextRoundId
    });
  } catch (error) {
    console.error('Error activating next round:', error);
    res.status(500).json({ error: 'Failed to activate next round', details: String(error) });
  }
});

// ============================================================================
// NEW ENDPOINTS: Tournament Modes Support (Liga, Suizo, Suizo Mixto, Eliminación Mejorada)
// ============================================================================

/**
 * GET /api/tournaments/:id/config
 * Get tournament full configuration including new mode fields
 */
router.get('/:id/config', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const rows = await query(
      `SELECT * FROM tournaments WHERE tournament_id = $1`,
      [id]
    );
    
    if (!rows || !rows.rows || rows.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    res.json(rows.rows[0]);
  } catch (error) {
    console.error('Error fetching tournament config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tournaments/suggestions/by-count
 * Get tournament type suggestions based on participant count
 */
router.get('/suggestions/by-count', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { participant_count } = req.query;
    
    if (!participant_count) {
      return res.status(400).json({ error: 'participant_count query parameter is required' });
    }
    
    const count = Number(participant_count);
    const suggestions: Record<string, any> = {};
    
    // Liga suggestions
    if (count >= 4 && count <= 32) {
      suggestions.league = {
        league_type: count <= 8 ? 'double_round' : 'single_round',
        series_format: count <= 8 ? 'bo1' : 'bo1',
        estimated_matches: count <= 8 
          ? count * (count - 1)  // double round
          : Math.floor(count * (count - 1) / 2),
      };
    }
    
    // Suizo suggestions
    if (count >= 4) {
      const swissRounds = 
        count <= 8 ? 3 :
        count <= 16 ? 4 :
        count <= 32 ? 5 : 6;
      
      suggestions.swiss = {
        swiss_rounds: swissRounds,
        series_format: 'bo1',
        estimated_matches: swissRounds * Math.floor(count / 2),
      };
    }
    
    // Suizo Mixto suggestions
    if (count >= 8) {
      let swissRounds = 0;
      let finalists = 0;
      
      if (count <= 15) {
        swissRounds = 3;
        finalists = 4;
      } else if (count <= 31) {
        swissRounds = 4;
        finalists = 8;
      } else if (count <= 63) {
        swissRounds = 5;
        finalists = 16;
      } else {
        swissRounds = 5;
        finalists = 16;
      }
      
      suggestions.swiss_hybrid = {
        swiss_hybrid_rounds: swissRounds,
        finalists_count: finalists,
        estimated_matches: swissRounds * Math.floor(count / 2) + (finalists - 1),
      };
    }
    
    // Eliminación suggestions
    if (count >= 2) {
      const nearestPowerOf2 = 
        count <= 2 ? 2 :
        count <= 4 ? 4 :
        count <= 8 ? 8 :
        count <= 16 ? 16 :
        count <= 32 ? 32 :
        count <= 64 ? 64 : 128;
      
      suggestions.elimination = {
        elimination_type: 'single',
        finalists_count: nearestPowerOf2,
        series_format_eliminations: count <= 8 ? 'bo1' : 'bo1',
        series_format_final: 'bo3',
        estimated_matches: nearestPowerOf2 - 1,
      };
    }
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating tournament suggestions:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

/**
 * GET /api/tournaments/:id/standings
 * Get tournament standings (PUBLIC - for viewing tournament info)
 * Supports both 1v1 mode (tournament_participants) and team mode (tournament_teams)
 */
router.get('/:id/standings', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tournament mode and type first
    const tournamentModeResult = await query(
      `SELECT tournament_mode, tournament_type FROM tournaments WHERE id = $1`,
      [id]
    );

    if (tournamentModeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const isTournamentTeamMode = tournamentModeResult.rows[0].tournament_mode === 'team';
    const tournamentType = tournamentModeResult.rows[0].tournament_type;
    const isSwissElimination = tournamentType === 'swiss_elimination';

    if (isTournamentTeamMode) {
      // Team mode: return team standings with member user_ids
      let orderBy = 'tt.tournament_ranking IS NULL, tt.tournament_ranking ASC, (tt.tournament_wins - tt.tournament_losses) DESC, tt.omp DESC, tt.gwp DESC, tt.ogp DESC';
      
      // For Swiss-Elimination Mix: Order by current_round (how far they advanced) first
      if (isSwissElimination) {
        orderBy = `
          CASE 
            WHEN tt.status = 'active' THEN 0  -- Active team (winner) comes first
            ELSE 1                              -- Eliminated teams after
          END,
          tt.current_round DESC,  -- Furthest round first
          CASE 
            WHEN tt.status = 'active' THEN 0   -- Among same round, active first
            ELSE 1
          END,
          (tt.tournament_wins - tt.tournament_losses) DESC, 
          tt.omp DESC, 
          tt.gwp DESC, 
          tt.ogp DESC
        `;
      }
      
      const teamStandings = await query(
        `SELECT 
          tt.id,
          tt.name as nickname,
          tt.tournament_wins as tournament_wins,
          tt.tournament_losses as tournament_losses,
          tt.tournament_points as tournament_points,
          tt.tournament_ranking as tournament_ranking,
          tt.current_round as current_round,
          tt.omp,
          tt.gwp,
          tt.ogp,
          tt.status,
          COUNT(DISTINCT tp.user_id) as team_size,
          ARRAY_AGG(DISTINCT tp.user_id) as member_user_ids
         FROM tournament_teams tt
         LEFT JOIN tournament_participants tp ON tp.team_id = tt.id
         WHERE tt.tournament_id = $1
         GROUP BY tt.id
         ORDER BY ${orderBy}`,
        [id]
      );

      res.json({ 
        standings: (teamStandings && teamStandings.rows) ? teamStandings.rows : [],
        mode: 'team'
      });
    } else {
      // 1v1 mode: return player standings
      let orderBy1v1 = 'tp.tournament_points DESC, tp.omp DESC, tp.gwp DESC, tp.ogp DESC';
      
      // For Swiss-Elimination Mix: Order by current_round (how far they advanced) first
      if (isSwissElimination) {
        orderBy1v1 = `
          CASE 
            WHEN tp.status = 'active' THEN 0  -- Active player (winner) comes first
            ELSE 1                              -- Eliminated players after
          END,
          tp.current_round DESC,  -- Furthest round first
          CASE 
            WHEN tp.status = 'active' THEN 0   -- Among same round, active first
            ELSE 1
          END,
          (tp.tournament_wins - tp.tournament_losses) DESC,
          tp.omp DESC, 
          tp.gwp DESC, 
          tp.ogp DESC
        `;
      }
      
      const playerStandings = await query(
        `SELECT tp.*, u.nickname, u.elo_rating
         FROM tournament_participants tp
         LEFT JOIN users u ON tp.user_id = u.id
         WHERE tp.tournament_id = $1 
         ORDER BY ${orderBy1v1}`,
        [id]
      );
      
      res.json({ 
        standings: (playerStandings && playerStandings.rows) ? playerStandings.rows : [],
        mode: '1v1'
      });
    }
  } catch (error) {
    console.error('Error fetching standings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/**
 * GET /api/tournaments/:id/swiss-pairings/:round_id
 * Get Swiss system pairings for a round
 */
router.get('/:id/swiss-pairings/:round_id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id, round_id } = req.params;
    
    const pairings = await query(
      `SELECT * FROM swiss_pairings 
       WHERE tournament_id = $1 AND tournament_round_id = $2 
       ORDER BY pairing_number ASC`,
      [id, round_id]
    );
    
    res.json({ pairings: (pairings && pairings.rows) ? pairings.rows : [] });
  } catch (error) {
    console.error('Error fetching swiss pairings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tournaments/:id/calculate-tiebreakers
 * Calculate Swiss tiebreakers (OMP, GWP, OGP) for tournament participants
 * Only admins or tournament creators can call this endpoint
 */
router.post('/:id/calculate-tiebreakers', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is admin or tournament creator
    const tournamentQuery = await query(
      'SELECT creator_id FROM tournaments WHERE tournament_id = $1',
      [id]
    );
    
    if (!tournamentQuery || !tournamentQuery.rows || tournamentQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const tournament = tournamentQuery.rows[0];
    const userQuery = await query(
      'SELECT is_admin FROM users WHERE user_id = $1',
      [req.userId]
    );
    
    const isAdmin = userQuery && userQuery.rows && userQuery.rows.length > 0 && userQuery.rows[0].is_admin;
    const isCreator = tournament.creator_id === req.userId;
    
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only admins or tournament creators can calculate tiebreakers' });
    }

    // Determine tournament mode to use appropriate function
    const functionName = tournament.tournament_mode === 'team' ? 'update_team_tiebreakers' : 'update_tournament_tiebreakers';
    
    // Execute the stored procedure
    const result = await query(
      `SELECT updated_count, error_message FROM ${functionName}($1)`,
      [id]
    );
    
    if (result && result.rows && result.rows.length > 0 && result.rows[0].error_message) {
      return res.status(400).json({ 
        error: 'Failed to calculate tiebreakers',
        details: result.rows[0].error_message
      });
    }
    
    const updatedCount = result && result.rows && result.rows.length > 0 ? result.rows[0].updated_count : 0;
    
    // Fetch updated participants ordered by tiebreakers
    const participants = await query(
      `SELECT * FROM tournament_participants 
       WHERE tournament_id = $1 
       ORDER BY tournament_points DESC, omp DESC, gwp DESC, ogp DESC`,
      [id]
    );
    
    res.json({
      success: true,
      message: `Tiebreakers calculated for ${updatedCount} participants`,
      updated_count: updatedCount,
      participants: (participants && participants.rows) ? participants.rows : []
    });
  } catch (error) {
    console.error('Error calculating tiebreakers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/leagues/:id/calculate-tiebreakers
 * Calculate League tiebreakers (OMP, GWP, OGP) for tournament participants (league tournaments)
 * Only admins or league creators can call this endpoint
 */
router.post('/leagues/:id/calculate-tiebreakers', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is admin or tournament creator
    const tournamentQuery = await query(
      'SELECT creator_id FROM tournaments WHERE tournament_id = $1',
      [id]
    );
    
    if (!tournamentQuery || !tournamentQuery.rows || tournamentQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament (league) not found' });
    }
    
    const tournament = tournamentQuery.rows[0];
    const userQuery = await query(
      'SELECT is_admin FROM users WHERE user_id = $1',
      [req.userId]
    );
    
    const isAdmin = userQuery && userQuery.rows && userQuery.rows.length > 0 && userQuery.rows[0].is_admin;
    const isCreator = tournament.creator_id === req.userId;
    
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only admins or tournament creators can calculate tiebreakers' });
    }
    
    // Execute the stored procedure
    const result = await query(
      'SELECT updated_count, error_message FROM update_league_tiebreakers($1)',
      [id]
    );
    
    if (result && result.rows && result.rows.length > 0 && result.rows[0].error_message) {
      return res.status(400).json({ 
        error: 'Failed to calculate tiebreakers',
        details: result.rows[0].error_message
      });
    }
    
    const updatedCount = result && result.rows && result.rows.length > 0 ? result.rows[0].updated_count : 0;
    
    // Fetch updated participants ordered by: tournament_points DESC, omp DESC, gwp DESC, ogp DESC
    const participants = await query(
      `SELECT * FROM tournament_participants 
       WHERE tournament_id = $1 
       ORDER BY tournament_points DESC, omp DESC, gwp DESC, ogp DESC`,
      [id]
    );
    
    res.json({
      success: true,
      message: `Tiebreakers calculated for ${updatedCount} participants`,
      updated_count: updatedCount,
      participants: (participants && participants.rows) ? participants.rows : []
    });
  } catch (error) {
    console.error('Error calculating league tiebreakers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


