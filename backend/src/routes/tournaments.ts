import { Router } from 'express';
import { query } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { activateRound, checkAndCompleteRound } from '../utils/tournament.js';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { 
      name, 
      description, 
      tournament_type, 
      max_participants, 
      round_duration_days,
      auto_advance_round,
      general_rounds,
      final_rounds,
      general_rounds_format,
      final_rounds_format
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
    // At least one round must be configured when max_participants is set
    if (max_participants && max_participants > 0) {
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
    const tournamentTypeLower = tournament_type.toLowerCase();
    
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
      // Pure Elimination: only final_rounds, must be 1-3
      if ((general_rounds || 0) > 0) {
        return res.status(400).json({ error: 'Elimination tournaments should not have general rounds' });
      }
      if ((final_rounds || 0) < 1 || (final_rounds || 0) > 3) {
        return res.status(400).json({ error: 'Elimination tournaments must have between 1 and 3 final rounds' });
      }
    }

    const totalRounds = (general_rounds || 0) + (final_rounds || 0);

    // Create tournament
    const tournamentResult = await query(
      `INSERT INTO tournaments (
        name, description, creator_id, tournament_type, 
        max_participants, round_duration_days, auto_advance_round, 
        total_rounds, general_rounds, final_rounds,
        general_rounds_format, final_rounds_format,
        status, current_round
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        name, 
        description,
        req.userId, 
        tournament_type, 
        max_participants, 
        round_duration_days || 7,
        auto_advance_round || false,
        totalRounds,
        general_rounds || 0,
        final_rounds || 0,
        general_rounds_format || 'bo3',
        final_rounds_format || 'bo5',
        'registration_open',
        0
      ]
    );

    const tournamentId = tournamentResult.rows[0].id;

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

    res.json(result.rows);
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
    console.log('Request to join tournament:', { id, userId: req.userId });

    // Check if tournament exists
    const tournamentResult = await query('SELECT id FROM tournaments WHERE id = $1', [id]);
    if (tournamentResult.rows.length === 0) {
      console.log('Tournament not found:', id);
      return res.status(404).json({ error: 'Tournament not found' });
    }

    // Get user's ELO rating
    const userResult = await query('SELECT elo_rating FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows.length === 0) {
      console.log('User not found:', req.userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Insert as pending participant
    const result = await query(
      `INSERT INTO tournament_participants (tournament_id, user_id, participation_status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [id, req.userId, 'pending']
    );

    console.log('Join request created:', result.rows[0].id);
    res.status(201).json({ 
      id: result.rows[0].id,
      message: 'Join request sent. Waiting for organizer approval.'
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
      'SELECT creator_id FROM tournaments WHERE id = $1',
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournamentResult.rows[0].creator_id !== req.userId) {
      return res.status(403).json({ error: 'Only the tournament creator can accept participants' });
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

    res.json({ 
      id: result.rows[0].id,
      message: 'Participant accepted successfully'
    });
  } catch (error: any) {
    console.error('Accept participant error:', error.message || error);
    res.status(500).json({ error: 'Failed to accept participant', details: error.message });
  }
});

// Reject participant (organizer only)
router.post('/:tournamentId/participants/:participantId/reject', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { tournamentId, participantId } = req.params;

    // Verify the user is the tournament creator
    const tournamentResult = await query(
      'SELECT creator_id FROM tournaments WHERE id = $1',
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournamentResult.rows[0].creator_id !== req.userId) {
      return res.status(403).json({ error: 'Only the tournament creator can reject participants' });
    }

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

    // Verify tournament creator
    const tournamentCheck = await query('SELECT creator_id, status FROM tournaments WHERE id = $1', [id]);
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

    // Update tournament status to registration_closed
    await query(
      `UPDATE tournaments 
       SET status = $1, registration_closed_at = NOW() 
       WHERE id = $2`,
      ['registration_closed', id]
    );

    res.json({ 
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
    
    if (tournament.creator_id !== req.userId) {
      console.log(`[PREPARE] Authorization failed - creator_id: ${tournament.creator_id}, userId: ${req.userId}`);
      return res.status(403).json({ error: 'Only tournament creator can prepare tournament' });
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
    
    // Total rounds requested
    const totalRoundsRequested = (tournament.general_rounds || 0) + (tournament.final_rounds || 0);
    const finalRoundsRequested = tournament.final_rounds || 0;
    
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
    const totalFinalRounds = tournament.final_rounds || 0;
    let totalGeneralRounds = tournament.general_rounds || 0;
    
    // For League tournaments, calculate actual rounds based on format (1=ida, 2=ida y vuelta)
    if (tournamentType === 'league') {
      const leagueFormat = totalGeneralRounds; // 1 or 2
      // Calculate combinations: C(n,2) = n*(n-1)/2
      const matchCombinations = (participantCount * (participantCount - 1)) / 2;
      // Each combination is one "round", and if ida y vuelta, multiply by 2
      totalGeneralRounds = matchCombinations * leagueFormat;
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

    // Add general rounds
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
      } else if (tournamentType === 'elimination') {
        label = `General Round ${i + 1}`;
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

    // Add final rounds with detailed classification
    for (let i = 0; i < totalFinalRounds; i++) {
      let classification = finalRoundClassification;
      let label = 'Final';
      let playersRemaining = elimiationPhaseParticipants;
      let playersAdvancing = 1;
      let roundType = 'final';

      if (tournamentType === 'elimination' || tournamentType === 'swiss_elimination') {
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
      `SELECT creator_id, status, general_rounds, final_rounds, general_rounds_format, final_rounds_format, tournament_type
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
      
      // Calculate maximum rounds needed for elimination tournament
      const maxRoundsNeeded = acceptedParticipants > 0 ? Math.ceil(Math.log2(acceptedParticipants)) : 0;
      
      // Total rounds requested
      const totalRoundsRequested = (tournament.general_rounds || 0) + (tournament.final_rounds || 0);
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

      console.log(`[START] Rounds to create:`, roundsToCreate);

      // Insert generated rounds
      for (const round of roundsToCreate) {
        console.log(`[START] Inserting round ${round.roundNumber} (${round.roundType})`);
        await query(
          `INSERT INTO tournament_rounds (tournament_id, round_number, round_type, match_format, round_status)
           VALUES ($1, $2, $3, $4, 'pending')`,
          [id, round.roundNumber, round.roundType, round.matchFormat]
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

    // Activate first round to generate initial matches
    try {
      console.log(`[START] Attempting to activate round 1 for tournament ${id}`);
      await activateRound(id, 1);
      console.log(`[START] Round 1 activated successfully for tournament ${id}`);
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

    const result = await query(
      `SELECT 
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
        m.id as reported_match_id,
        m.status as reported_match_status
       FROM tournament_matches tm
       LEFT JOIN users u1 ON tm.player1_id = u1.id
       LEFT JOIN users u2 ON tm.player2_id = u2.id
       LEFT JOIN users uw ON tm.winner_id = uw.id
       LEFT JOIN matches m ON tm.match_id = m.id
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

    const result = await query(
      `SELECT 
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
        uw.nickname as winner_nickname
       FROM tournament_round_matches trm
       JOIN tournament_rounds tr ON trm.round_id = tr.id
       LEFT JOIN users u1 ON trm.player1_id = u1.id
       LEFT JOIN users u2 ON trm.player2_id = u2.id
       LEFT JOIN users uw ON trm.winner_id = uw.id
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

    const result = await query(
      `SELECT 
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
        m.winner_faction,
        m.loser_faction,
        m.map
       FROM tournament_matches tm
       JOIN tournament_rounds tr ON tm.round_id = tr.id
       LEFT JOIN users u1 ON tm.player1_id = u1.id
       LEFT JOIN users u2 ON tm.player2_id = u2.id
       LEFT JOIN matches m ON tm.match_id = m.id
       LEFT JOIN users uw ON m.winner_id = uw.id
       LEFT JOIN users ul ON m.loser_id = ul.id
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
    const isPlayer = match.player1_id === req.userId || match.player2_id === req.userId;

    if (!isCreator && !isPlayer) {
      return res.status(403).json({ error: 'You cannot record results for this match' });
    }

    // Update tournament match with result
    const updateResult = await query(
      `UPDATE tournament_matches 
       SET winner_id = $1, match_id = $2, match_status = 'completed', played_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [winner_id, reported_match_id || null, matchId]
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
    if (winner_id !== match.player1_id && winner_id !== match.player2_id) {
      return res.status(400).json({ error: 'Winner must be one of the match players' });
    }

    // Update tournament match with determined winner
    const updateResult = await query(
      `UPDATE tournament_matches 
       SET winner_id = $1, match_status = 'completed', played_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [winner_id, matchId]
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

    console.log(`Tournament organizer ${req.userId} determined winner for match ${matchId}: ${winner_id}`);

    res.json({
      message: 'Match winner determined by organizer (no ELO impact)',
      match: updateResult.rows[0]
    });
  } catch (error: any) {
    console.error('Error determining match winner:', error);
    res.status(500).json({ error: 'Failed to determine match winner', details: error.message });
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
    
    const [rows]: any = await query(
      `SELECT * FROM tournaments WHERE tournament_id = ?`,
      [id]
    );
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    res.json(rows[0]);
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
 * Get tournament standings
 */
router.get('/:id/standings', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { round_id } = req.query;
    
    let sql = `SELECT * FROM tournament_standings WHERE tournament_id = ?`;
    const params: any[] = [id];
    
    if (round_id) {
      sql += ` AND tournament_round_id = ?`;
      params.push(round_id);
    }
    
    sql += ` ORDER BY current_rank ASC`;
    
    const [standings]: any = await query(sql, params);
    
    res.json({ standings: standings || [] });
  } catch (error) {
    console.error('Error fetching standings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tournaments/:id/league-standings
 * Get league standings
 */
router.get('/:id/league-standings', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const [standings]: any = await query(
      `SELECT * FROM league_standings WHERE tournament_id = ? ORDER BY league_position ASC`,
      [id]
    );
    
    res.json({ standings: standings || [] });
  } catch (error) {
    console.error('Error fetching league standings:', error);
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
    
    const [pairings]: any = await query(
      `SELECT * FROM swiss_pairings 
       WHERE tournament_id = ? AND tournament_round_id = ? 
       ORDER BY pairing_number ASC`,
      [id, round_id]
    );
    
    res.json({ pairings: pairings || [] });
  } catch (error) {
    console.error('Error fetching swiss pairings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


