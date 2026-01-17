import { query } from '../config/database.js';

// Best Of series management utilities

export function getWinsRequired(bestOf: 1 | 3 | 5): number {
  switch (bestOf) {
    case 1:
      return 1;
    case 3:
      return 2;
    case 5:
      return 3;
    default:
      return 1;
  }
}

export interface BestOfMatch {
  player1_wins: number;
  player2_wins: number;
  series_status: 'in_progress' | 'completed';
  winner_id: string | null;
}

export function updateBestOfSeriesLocal(
  currentState: BestOfMatch,
  winnerId: string,
  player1Id: string,
  player2Id: string,
  winsRequired: number
): BestOfMatch {
  const isPlayer1Winner = winnerId === player1Id;
  
  const updatedState = {
    ...currentState,
    player1_wins: isPlayer1Winner ? currentState.player1_wins + 1 : currentState.player1_wins,
    player2_wins: !isPlayer1Winner ? currentState.player2_wins + 1 : currentState.player2_wins,
  };

  // Check if series is complete
  if (updatedState.player1_wins >= winsRequired) {
    updatedState.series_status = 'completed';
    updatedState.winner_id = player1Id;
  } else if (updatedState.player2_wins >= winsRequired) {
    updatedState.series_status = 'completed';
    updatedState.winner_id = player2Id;
  }

  return updatedState;
}

export function shouldCreateNextMatch(
  player1Wins: number,
  player2Wins: number,
  winsRequired: number,
  matchesScheduled: number,
  bestOf: 1 | 3 | 5
): boolean {
  // Series is already complete
  if (player1Wins >= winsRequired || player2Wins >= winsRequired) {
    return false;
  }

  // Check if there are still matches available to schedule
  // For bo1: max 1 match, bo3: max 3 matches, bo5: max 5 matches
  if (matchesScheduled >= bestOf) {
    return false;
  }

  return true;
}

/**
 * Update Best Of series state in database when a match is reported
 * Increments the winner's wins counter and updates series status if complete
 */
export async function updateBestOfSeriesDB(
  tournamentRoundMatchId: string,
  winnerId: string
): Promise<{ seriesComplete: boolean; winner: string | null; shouldCreateNextMatch: boolean }> {
  try {
    // Get current series state
    const seriesResult = await query(
      `SELECT player1_id, player2_id, player1_wins, player2_wins, wins_required, best_of
       FROM tournament_round_matches
       WHERE id = $1`,
      [tournamentRoundMatchId]
    );

    if (seriesResult.rows.length === 0) {
      throw new Error(`tournament_round_matches ${tournamentRoundMatchId} not found`);
    }

    const series = seriesResult.rows[0];
    const isPlayer1Winner = series.player1_id === winnerId;
    const newPlayer1Wins = isPlayer1Winner ? series.player1_wins + 1 : series.player1_wins;
    const newPlayer2Wins = isPlayer1Winner ? series.player2_wins : series.player2_wins + 1;

    // Check if series is complete
    const seriesComplete = newPlayer1Wins >= series.wins_required || newPlayer2Wins >= series.wins_required;
    const seriesWinnerId = newPlayer1Wins >= series.wins_required ? series.player1_id : (newPlayer2Wins >= series.wins_required ? series.player2_id : null);
    const seriesLoserId = seriesComplete ? (seriesWinnerId === series.player1_id ? series.player2_id : series.player1_id) : null;

    // Determine if we should create the next match (only if series not complete and we haven't reached max matches)
    let createNextMatch = false;
    if (!seriesComplete && newPlayer1Wins + newPlayer2Wins < series.best_of) {
      createNextMatch = true;
    }

    // Update tournament_round_matches with new win counts
    await query(
      `UPDATE tournament_round_matches
       SET player1_wins = $1, 
           player2_wins = $2,
           series_status = $3,
           winner_id = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [newPlayer1Wins, newPlayer2Wins, seriesComplete ? 'completed' : 'in_progress', seriesWinnerId, tournamentRoundMatchId]
    );

    // If series is now complete, mark the loser as eliminated (conditionally based on tournament type and round type)
    if (seriesComplete && seriesLoserId) {
      // Get tournament_id, tournament_type, tournament_mode and round_type from the round
      const roundResult = await query(
        `SELECT tr.tournament_id, t.tournament_type, t.tournament_mode, tr.round_type
         FROM tournament_round_matches trm
         JOIN tournament_rounds tr ON trm.round_id = tr.id
         JOIN tournaments t ON tr.tournament_id = t.id
         WHERE trm.id = $1`,
        [tournamentRoundMatchId]
      );

      if (roundResult.rows.length > 0) {
        const { tournament_id, tournament_type, tournament_mode, round_type } = roundResult.rows[0];

        // Determine if we should eliminate the loser
        let shouldEliminate = false;
        
        if (tournament_type === 'elimination') {
          // Pure elimination: always eliminate
          shouldEliminate = true;
        } else if (tournament_type === 'swiss_elimination' && round_type === 'final') {
          // Swiss-Elimination Mix: only eliminate during final (elimination) rounds
          shouldEliminate = true;
        }
        // For league, swiss: never eliminate (shouldEliminate stays false)
        // For swiss_elimination during general rounds: never eliminate

        if (shouldEliminate) {
          // For team mode tournaments, mark the team as eliminated
          if (tournament_mode === 'team') {
            await query(
              `UPDATE tournament_teams
               SET status = 'eliminated'
               WHERE tournament_id = $1 AND id = $2`,
              [tournament_id, seriesLoserId]
            );
            console.log(`[bestOf] 🚫 Team ${seriesLoserId} eliminated from tournament ${tournament_id}`);
          } else {
            // For 1v1 tournaments, mark the player as eliminated
            await query(
              `UPDATE tournament_participants
               SET status = 'eliminated'
               WHERE tournament_id = $1 AND user_id = $2`,
              [tournament_id, seriesLoserId]
            );
            console.log(`[bestOf] 🚫 Player ${seriesLoserId} eliminated from tournament ${tournament_id}`);
          }
        } else {
          // For other formats/rounds: keep players active
          console.log(`[bestOf] ✅ Player/Team ${seriesLoserId} stays in tournament (${tournament_type}, ${round_type} round)`);
        }
      }
    }

    // If series is now complete, check if the entire round is complete
    if (seriesComplete) {
      console.log(`[bestOf] Series ${tournamentRoundMatchId} is now complete. Checking if round is complete...`);
      
      // Get round_id for this series
      const roundResult = await query(
        `SELECT round_id FROM tournament_round_matches WHERE id = $1`,
        [tournamentRoundMatchId]
      );
      
      if (roundResult.rows.length > 0) {
        const roundId = roundResult.rows[0].round_id;
        
        // Check if ALL series in this round are completed
        const allSeriesResult = await query(
          `SELECT COUNT(*) as total, 
                  SUM(CASE WHEN series_status = 'completed' THEN 1 ELSE 0 END) as completed
           FROM tournament_round_matches
           WHERE round_id = $1`,
          [roundId]
        );
        
        const { total, completed } = allSeriesResult.rows[0];
        console.log(`[bestOf] Round ${roundId}: ${completed}/${total} series completed`);
        
        if (parseInt(completed) === parseInt(total) && parseInt(total) > 0) {
          // All series in this round are complete, mark the round as completed
          await query(
            `UPDATE tournament_rounds 
             SET round_status = 'completed', round_end_date = NOW()
             WHERE id = $1`,
            [roundId]
          );
          console.log(`[bestOf] ✅ Round ${roundId} is now COMPLETE!`);
        }
      }
    }

    return { seriesComplete, winner: seriesWinnerId, shouldCreateNextMatch: createNextMatch };
  } catch (error) {
    console.error('Error updating Best Of series:', error);
    throw error;
  }
}

/**
 * Create next match in a Best Of series if needed
 */
export async function createNextMatchInSeries(
  tournamentRoundMatchId: string,
  tournamentId: string,
  roundId: string
): Promise<string | null> {
  try {
    // Get series info
    const seriesResult = await query(
      `SELECT player1_id, player2_id, player1_wins, player2_wins, wins_required, best_of, matches_scheduled
       FROM tournament_round_matches
       WHERE id = $1`,
      [tournamentRoundMatchId]
    );

    if (seriesResult.rows.length === 0) {
      throw new Error(`tournament_round_matches ${tournamentRoundMatchId} not found`);
    }

    const series = seriesResult.rows[0];

    // IMPORTANT: Check if there are unreported matches in this series
    // If there are pending/unreported matches, DON'T create the next one yet
    const unreportedMatchesResult = await query(
      `SELECT COUNT(*) as unreported_count FROM tournament_matches
       WHERE tournament_round_match_id = $1 AND match_status = 'pending'`,
      [tournamentRoundMatchId]
    );

    const unreportedMatches = parseInt(unreportedMatchesResult.rows[0].unreported_count) || 0;
    console.log(`[createNextMatchInSeries] Series ${tournamentRoundMatchId}: unreported_matches=${unreportedMatches}`);

    if (unreportedMatches > 0) {
      console.log(`[createNextMatchInSeries] Cannot create next match - there are ${unreportedMatches} unreported matches in this series`);
      return null;
    }

    // Check if we should create a match
    const totalMatchesPlayed = series.player1_wins + series.player2_wins;
    if (totalMatchesPlayed >= series.best_of || (series.player1_wins >= series.wins_required || series.player2_wins >= series.wins_required)) {
      // Series is complete or we've played enough matches
      console.log(`[createNextMatchInSeries] Series ${tournamentRoundMatchId} is complete or max matches reached`);
      return null;
    }

    // Create the new match
    const matchResult = await query(
      `INSERT INTO tournament_matches (
        tournament_id, round_id, player1_id, player2_id, tournament_round_match_id, match_status
      ) VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [tournamentId, roundId, series.player1_id, series.player2_id, tournamentRoundMatchId]
    );

    const newMatchId = matchResult.rows[0].id;

    // Increment matches_scheduled counter
    await query(
      `UPDATE tournament_round_matches
       SET matches_scheduled = matches_scheduled + 1
       WHERE id = $1`,
      [tournamentRoundMatchId]
    );

    console.log(`Created next match ${newMatchId} for tournament_round_matches ${tournamentRoundMatchId}`);
    return newMatchId;
  } catch (error) {
    console.error('Error creating next match:', error);
    throw error;
  }
}
