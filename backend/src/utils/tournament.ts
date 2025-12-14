/**
 * Tournament match generation utilities
 * Generates tournament matches based on tournament type and participants
 */

import { query } from '../config/database.js';

interface Participant {
  id: string;
  user_id: string;
  elo_rating?: number;
}

/**
 * Generates all matches for a tournament round
 * For the first round, matches are generated for all accepted participants
 * For subsequent rounds, matches depend on previous round results
 */
export async function generateRoundMatches(
  tournamentId: string,
  roundId: string,
  roundNumber: number,
  tournamentType: string,
  participants: Participant[]
): Promise<{ matches: any[], count: number }> {
  const matches = [];

  try {
    // If first round, generate matches from all participants
    if (roundNumber === 1) {
      matches.push(...generateFirstRoundMatches(participants, tournamentId, roundId));
    } else {
      // For subsequent rounds, get winners from previous round
      const previousRoundMatches = await query(
        `SELECT winner_id, player1_id, player2_id FROM tournament_matches 
         WHERE round_id = (
           SELECT id FROM tournament_rounds 
           WHERE tournament_id = $1 AND round_number = $2
         )`,
        [tournamentId, roundNumber - 1]
      );

      const winners = previousRoundMatches.rows
        .filter((m: any) => m.winner_id)
        .map((m: any) => ({ user_id: m.winner_id }));

      if (tournamentType.toLowerCase() === 'elimination') {
        matches.push(...generateEliminationMatches(winners, tournamentId, roundId));
      } else {
        matches.push(...generateRoundRobinMatches(winners, tournamentId, roundId));
      }
    }

    // Insert all matches
    for (const match of matches) {
      await query(
        `INSERT INTO tournament_matches (tournament_id, round_id, player1_id, player2_id, match_status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [match.tournament_id, match.round_id, match.player1_id, match.player2_id]
      );
    }

    return { matches, count: matches.length };
  } catch (error) {
    console.error('Error generating round matches:', error);
    throw error;
  }
}

/**
 * Generates first round matches
 * Shuffles participants and pairs them up
 * If odd number, the player with highest ELO advances automatically (bye)
 */
function generateFirstRoundMatches(
  participants: Participant[],
  tournamentId: string,
  roundId: string,
  tournamentRoundMatches: any[] = []
): any[] {
  const matches = [];
  
  // Sort by ELO rating (descending) for consistency when handling byes
  const sorted = [...participants].sort((a, b) => (b.elo_rating || 0) - (a.elo_rating || 0));
  
  // Shuffle while keeping sort for reference
  const shuffled = sorted.sort(() => Math.random() - 0.5);

  // Pair up participants
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    matches.push({
      tournament_id: tournamentId,
      round_id: roundId,
      player1_id: shuffled[i].user_id,
      player2_id: shuffled[i + 1].user_id,
    });
  }

  // If odd number of participants, highest ELO gets a bye (automatic advancement)
  if (shuffled.length % 2 === 1) {
    const byePlayer = sorted[0]; // Highest ELO player
    console.log(`🎯 Odd number of participants (${shuffled.length}). Player ${byePlayer.user_id} (ELO: ${byePlayer.elo_rating}) advances automatically (BYE)`);
    
    // Mark this player for automatic advancement
    // This will be handled in the next round generation
    matches.push({
      tournament_id: tournamentId,
      round_id: roundId,
      player1_id: byePlayer.user_id,
      player2_id: null, // Null indicates bye/automatic advancement
      is_bye: true,
    });
  }

  return matches;
}

/**
 * Generates elimination bracket matches
 * If odd number of remaining players, highest ELO advances automatically (bye)
 */
function generateEliminationMatches(
  winners: any[],
  tournamentId: string,
  roundId: string
): any[] {
  const matches = [];
  
  // Sort by ELO rating (descending) to identify bye candidate
  const sorted = [...winners].sort((a, b) => (b.elo_rating || 0) - (a.elo_rating || 0));
  
  // Shuffle for bracket arrangement
  const shuffled = [...sorted].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    matches.push({
      tournament_id: tournamentId,
      round_id: roundId,
      player1_id: shuffled[i].user_id,
      player2_id: shuffled[i + 1].user_id,
    });
  }

  // If odd number of players, highest ELO gets bye to next round
  if (shuffled.length % 2 === 1) {
    const byePlayer = sorted[0]; // Highest ELO among remaining
    console.log(`🏆 Elimination round with odd players (${shuffled.length}). Player ${byePlayer.user_id} (ELO: ${byePlayer.elo_rating}) advances automatically (BYE)`);
    
    matches.push({
      tournament_id: tournamentId,
      round_id: roundId,
      player1_id: byePlayer.user_id,
      player2_id: null, // Null indicates bye
      is_bye: true,
    });
  }

  return matches;
}

/**
 * Generates round-robin matches
 * Each player plays against each other player (limited to reasonable count)
 */
function generateRoundRobinMatches(
  participants: any[],
  tournamentId: string,
  roundId: string
): any[] {
  const matches = [];
  const maxMatches = 20; // Limit matches per round for practical reasons

  // Generate round-robin pairings, limited by maxMatches
  for (let i = 0; i < participants.length - 1 && matches.length < maxMatches; i++) {
    for (let j = i + 1; j < participants.length && matches.length < maxMatches; j++) {
      matches.push({
        tournament_id: tournamentId,
        round_id: roundId,
        player1_id: participants[i].user_id,
        player2_id: participants[j].user_id,
      });
    }
  }

  return matches;
}

/**
 * Activates a round and generates its matches (for first time only)
 */
export async function activateRound(tournamentId: string, roundNumber: number): Promise<boolean> {
  try {
    // Get the round with format info
    const roundResult = await query(
      `SELECT tr.id, tr.round_status, tr.tournament_id,
              CASE WHEN tr.round_number <= t.general_rounds 
                   THEN t.general_rounds_format 
                   ELSE t.final_rounds_format 
              END as round_format
       FROM tournament_rounds tr
       JOIN tournaments t ON tr.tournament_id = t.id
       WHERE tr.tournament_id = $1 AND tr.round_number = $2`,
      [tournamentId, roundNumber]
    );

    if (roundResult.rows.length === 0) {
      throw new Error('Round not found');
    }

    const round = roundResult.rows[0];

    if (round.round_status !== 'pending') {
      console.warn(`Round ${roundNumber} is already ${round.round_status}`);
      return false;
    }

    // Get tournament info
    const tournamentResult = await query(
      `SELECT tournament_type FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    const tournament = tournamentResult.rows[0];

    // Get accepted participants for first round, or non-eliminated participants from previous rounds
    let participants;
    if (roundNumber === 1) {
      const participantsResult = await query(
        `SELECT tp.id, tp.user_id, u.elo_rating
         FROM tournament_participants tp
         LEFT JOIN users u ON tp.user_id = u.id
         WHERE tp.tournament_id = $1 AND tp.participation_status = 'accepted'`,
        [tournamentId]
      );
      participants = participantsResult.rows;
    } else {
      // For subsequent rounds, only get non-eliminated participants who haven't lost yet
      // Must have been accepted and not eliminated
      const participantsResult = await query(
        `SELECT tp.id, tp.user_id, u.elo_rating
         FROM tournament_participants tp
         LEFT JOIN users u ON tp.user_id = u.id
         WHERE tp.tournament_id = $1 AND tp.participation_status = 'accepted' AND status = 'active'`,
        [tournamentId]
      );
      participants = participantsResult.rows;
    }

    if (participants.length === 0) {
      throw new Error('No participants available for this round');
    }

    // Determine best_of format from round_format (bo1, bo3, bo5)
    const bestOfMap: { [key: string]: 1 | 3 | 5 } = {
      'bo1': 1,
      'bo3': 3,
      'bo5': 5
    };
    const bestOf = bestOfMap[round.round_format] || 3;
    const winsRequired = Math.ceil(bestOf / 2);

    // Generate pairings based on round number
    let pairings;
    if (roundNumber === 1) {
      // First round: pair all participants
      pairings = generateFirstRoundMatches(participants, tournamentId, round.id);
    } else {
      // Subsequent rounds (elimination): pair winners from previous round
      pairings = generateEliminationMatches(participants, tournamentId, round.id);
    }

    for (const pairing of pairings) {
      // Handle bye (automatic advancement for odd player count)
      if (pairing.is_bye || pairing.player2_id === null) {
        console.log(`✅ BYE: Player ${pairing.player1_id} advances automatically to next round`);
        // No need to create matches for byes
        // The player will automatically be included in next round
        continue;
      }

      // Create tournament_round_matches entry
      const tmResult = await query(
        `INSERT INTO tournament_round_matches 
         (tournament_id, round_id, player1_id, player2_id, best_of, wins_required, series_status, matches_scheduled)
         VALUES ($1, $2, $3, $4, $5, $6, 'in_progress', $7)
         RETURNING id`,
        [tournamentId, round.id, pairing.player1_id, pairing.player2_id, bestOf, winsRequired, winsRequired]
      );

      const roundMatchId = tmResult.rows[0].id;

      // Create initial tournament_matches entries (exactly wins_required matches)
      // For Bo3: 2 matches (need 2 wins), for Bo5: 3 matches (need 3 wins)
      const matchesToCreate = winsRequired;
      for (let i = 0; i < matchesToCreate; i++) {
        await query(
          `INSERT INTO tournament_matches 
           (tournament_id, round_id, player1_id, player2_id, match_status, tournament_round_match_id)
           VALUES ($1, $2, $3, $4, 'pending', $5)`,
          [tournamentId, round.id, pairing.player1_id, pairing.player2_id, roundMatchId]
        );
      }

      console.log(`Created ${matchesToCreate} initial matches for round_match ${roundMatchId} (Bo${bestOf}, needs ${winsRequired} wins)`);
    }

    // Update round status to in_progress
    await query(
      `UPDATE tournament_rounds 
       SET round_status = 'in_progress', round_start_date = NOW()
       WHERE id = $1`,
      [round.id]
    );

    console.log(`Round ${roundNumber} activated with ${pairings.length} pairings, best_of: ${bestOf}`);
    return true;
  } catch (error) {
    console.error('Error activating round:', error);
    throw error;
  }
}

/**
 * Checks if a round is complete (all matches have winners)
 */
export async function isRoundComplete(roundId: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN winner_id IS NOT NULL THEN 1 ELSE 0 END) as completed
       FROM tournament_matches 
       WHERE round_id = $1`,
      [roundId]
    );

    const { total, completed } = result.rows[0];
    return total > 0 && total === completed;
  } catch (error) {
    console.error('Error checking round completion:', error);
    return false;
  }
}

/**
 * Marks a round as complete and advances to next round
 */
export async function completeRound(roundId: string, tournamentId: string): Promise<void> {
  try {
    // Get current round number
    const roundResult = await query(
      `SELECT round_number FROM tournament_rounds WHERE id = $1`,
      [roundId]
    );

    if (roundResult.rows.length === 0) {
      throw new Error('Round not found');
    }

    const currentRoundNumber = roundResult.rows[0].round_number;

    // Update current round status
    await query(
      `UPDATE tournament_rounds 
       SET round_status = 'completed', round_end_date = NOW()
       WHERE id = $1`,
      [roundId]
    );

    // Check if there are more rounds
    const nextRoundResult = await query(
      `SELECT id FROM tournament_rounds 
       WHERE tournament_id = $1 AND round_number = $2`,
      [tournamentId, currentRoundNumber + 1]
    );

    if (nextRoundResult.rows.length > 0) {
      // Activate next round automatically if auto_advance_round is true
      const tournamentResult = await query(
        `SELECT auto_advance_round FROM tournaments WHERE id = $1`,
        [tournamentId]
      );

      if (tournamentResult.rows[0].auto_advance_round) {
        await activateRound(tournamentId, currentRoundNumber + 1);
      }
    } else {
      // No more rounds, tournament is finished
      await query(
        `UPDATE tournaments SET status = 'finished', finished_at = NOW() WHERE id = $1`,
        [tournamentId]
      );
    }
  } catch (error) {
    console.error('Error completing round:', error);
    throw error;
  }
}

/**
 * Check if a round is complete (all matches are done with winners)
 * If complete, mark the round as 'completed' and set round_end_date
 * Also creates any missing matches in incomplete series
 */
export async function checkAndCompleteRound(tournamentId: string, roundNumber: number): Promise<boolean> {
  try {
    // Get all matches in this round
    const roundInfo = await query(
      `SELECT id FROM tournament_rounds 
       WHERE tournament_id = $1 AND round_number = $2`,
      [tournamentId, roundNumber]
    );

    if (roundInfo.rows.length === 0) {
      return false;
    }

    const roundId = roundInfo.rows[0].id;

    // Get all round matches (Best Of series pairings) and their status
    const matchesResult = await query(
      `SELECT 
        trm.id, 
        trm.series_status, 
        trm.winner_id,
        trm.player1_id,
        trm.player2_id,
        trm.player1_wins,
        trm.player2_wins,
        trm.wins_required,
        trm.best_of,
        (SELECT COUNT(*) FROM tournament_matches tm WHERE tm.tournament_round_match_id = trm.id AND tm.match_status != 'completed') as pending_matches
       FROM tournament_round_matches trm
       WHERE trm.round_id = $1`,
      [roundId]
    );

    if (matchesResult.rows.length === 0) {
      return false;
    }

    // First, check if there are any incomplete series without pending matches
    // and create missing matches if needed
    for (const match of matchesResult.rows) {
      if (match.series_status === 'in_progress' && parseInt(match.pending_matches) === 0) {
        // Series is incomplete but has no pending matches
        // Check if more matches need to be created
        const totalMatchesPlayed = match.player1_wins + match.player2_wins;
        const maxMatches = match.best_of;
        
        if (totalMatchesPlayed < maxMatches && 
            match.player1_wins < match.wins_required && 
            match.player2_wins < match.wins_required) {
          // Create the next match
          console.log(`Creating missing match for series ${match.id}: current score ${match.player1_wins}-${match.player2_wins}, best_of=${match.best_of}`);
          
          await query(
            `INSERT INTO tournament_matches 
             (tournament_id, round_id, player1_id, player2_id, match_status, tournament_round_match_id)
             VALUES ($1, $2, $3, $4, 'pending', $5)`,
            [tournamentId, roundId, match.player1_id, match.player2_id, match.id]
          );
        }
      }
    }

    // Re-fetch matches after potentially creating new ones
    const updatedMatchesResult = await query(
      `SELECT 
        trm.id, 
        trm.series_status, 
        trm.winner_id,
        (SELECT COUNT(*) FROM tournament_matches tm WHERE tm.tournament_round_match_id = trm.id AND tm.match_status != 'completed') as pending_matches
       FROM tournament_round_matches trm
       WHERE trm.round_id = $1`,
      [roundId]
    );

    // Check conditions for round completion:
    // 1. ALL series must be completed (series_status = 'completed')
    // 2. Each series must have a winner (winner_id IS NOT NULL)
    // 3. NO pending matches in any series (all tournament_matches must be completed or not exist)
    const allComplete = updatedMatchesResult.rows.every((match: any) => {
      const seriesComplete = match.series_status === 'completed';
      const hasWinner = match.winner_id !== null;
      const noPendingMatches = parseInt(match.pending_matches) === 0;
      
      return seriesComplete && hasWinner && noPendingMatches;
    });

    if (allComplete) {
      // Mark round as completed
      await query(
        `UPDATE tournament_rounds 
         SET round_status = 'completed', round_end_date = NOW()
         WHERE id = $1`,
        [roundId]
      );
      console.log(`✅ Round ${roundNumber} marked as completed for tournament ${tournamentId}`);

      // Check if this is the last round
      const totalRoundsResult = await query(
        `SELECT COUNT(*) as total_rounds FROM tournament_rounds WHERE tournament_id = $1`,
        [tournamentId]
      );
      const totalRounds = parseInt(totalRoundsResult.rows[0].total_rounds);

      if (roundNumber === totalRounds) {
        // This is the last round - tournament is finished
        // Get the ranking and declare winner
        const rankingResult = await query(
          `SELECT user_id FROM tournament_participants 
           WHERE tournament_id = $1 
           ORDER BY tournament_points DESC, tournament_wins DESC
           LIMIT 1`,
          [tournamentId]
        );

        if (rankingResult.rows.length > 0) {
          const winnerId = rankingResult.rows[0].user_id;
          await query(
            `UPDATE tournaments SET status = 'finished', finished_at = NOW() WHERE id = $1`,
            [tournamentId]
          );
          console.log(`🏆 Tournament ${tournamentId} finished - Winner: ${winnerId}`);
        }
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking/completing round:', error);
    throw error;
  }
}
