/**
 * replayConfirmationService.ts
 *
 * Centralized service for handling replay confirmation across both endpoints:
 * - POST /api/replays/:replayId/confirm-winner (user confirms)
 * - POST /api/matches/:id/report-confidence-1-replay (match confirmation)
 *
 * Ensures both flows handle:
 * 1. Faction assignment validation for team tournaments
 * 2. Auto-creation of next match in BO3/BO5 series when needed
 * 3. Round completion checking
 */

import { query } from '../config/database.js';

export interface ReplayConfirmationInput {
  tournamentRoundMatchId?: string;
  tournamentMatchId?: string;
  winnerName: string;
  parseSummary: any;
  matchType: string;
}

export interface ValidatedFactions {
  winnerFaction: string;
  loserFaction: string;
}

/**
 * Validate and correct faction assignment for team tournaments.
 * For team tournaments, factions should come from the team's detectedTeams,
 * not from side numbers in the replay.
 *
 * Important: This function looks up tournament_match by tournament_round_match_id if tournament_match_id is not provided.
 */
export async function validateAndCorrectFactions(
  input: ReplayConfirmationInput,
  initialWinnerFaction: string,
  initialLoserFaction: string
): Promise<ValidatedFactions> {
  let winnerFaction = initialWinnerFaction;
  let loserFaction = initialLoserFaction;

  console.log(`📋 [FACTIONS] Initial: winner=${winnerFaction}, loser=${loserFaction}`);

  // Only validate for team tournaments with detected teams
  if (
    input.matchType === 'tournament_unranked' &&
    input.parseSummary?.detectedTeams &&
    (input.tournamentMatchId || input.tournamentRoundMatchId)
  ) {
    try {
      let tournamentMatchId = input.tournamentMatchId;

      // If we only have tournament_round_match_id, look up the latest tournament_match
      if (!tournamentMatchId && input.tournamentRoundMatchId) {
        const tmLookupResult = await query(
          `SELECT id FROM tournament_matches 
           WHERE tournament_round_match_id = ? AND winner_id IS NOT NULL
           ORDER BY created_at DESC LIMIT 1`,
          [input.tournamentRoundMatchId]
        );
        if (tmLookupResult.rows.length > 0) {
          tournamentMatchId = tmLookupResult.rows[0].id;
        }
      }

      if (tournamentMatchId) {
        // Get tournament_match to know player1_id and player2_id (which are team IDs)
        const tmResult = await query(
          `SELECT player1_id, player2_id, winner_id FROM tournament_matches WHERE id = ?`,
          [tournamentMatchId]
        );

        if (tmResult.rows.length > 0) {
          const tm = tmResult.rows[0];
          const detectedTeams = input.parseSummary.detectedTeams as Record<string, any>;

          // Determine which team is winner and which is loser
          const winningTeamId = tm.winner_id;
          const losingTeamId = winningTeamId === tm.player1_id ? tm.player2_id : tm.player1_id;

          console.log(`🎯 [FACTIONS] Team tournament: winner_team=${winningTeamId}, loser_team=${losingTeamId}`);

          // Get factions for the winning and losing teams
          if (detectedTeams[winningTeamId]?.factions) {
            winnerFaction = detectedTeams[winningTeamId].factions.join(', ');
            console.log(`✅ [FACTIONS] Winner factions from team: ${winnerFaction}`);
          }

          if (detectedTeams[losingTeamId]?.factions) {
            loserFaction = detectedTeams[losingTeamId].factions.join(', ');
            console.log(`✅ [FACTIONS] Loser factions from team: ${loserFaction}`);
          }
        }
      }
    } catch (err) {
      console.error('⚠️  [FACTIONS] Error validating team tournament factions:', err);
    }
  }

  return { winnerFaction, loserFaction };
}

/**
 * Handle post-confirmation logic: create next match in BO3, check round completion.
 * This runs after a match is confirmed (either through /report-confidence-1-replay or /confirm-winner).
 *
 * Note: If the winnerId passed is already a team UUID (from matches.ts when tournamentMode='team'),
 * it will be used as-is. If it's a player name (from replays.ts), this function maps it to team UUID.
 */
export async function handlePostConfirmation(
  tournamentRoundMatchId: string,
  winnerId: string,
  parseSummary: any,
  matchType: string
): Promise<void> {
  try {
    if (!tournamentRoundMatchId) {
      return; // Not a tournament match
    }

    const { updateTournamentRoundMatch } = await import('./matchCreationService.js');

    // Determine the winner ID to pass to updateTournamentRoundMatch
    let winnerIdForUpdate = winnerId;

    // For team tournaments, if winnerId is a player name, map it to team ID
    if (matchType === 'tournament_unranked' && parseSummary?.detectedTeams) {
      // Check if winnerId looks like a player name (lowercase, not UUID format)
      const isLikelyPlayerName = !winnerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      if (isLikelyPlayerName) {
        const detectedTeams = parseSummary.detectedTeams as Record<string, any>;

        // Find which team the winner player belongs to
        for (const [teamId, teamData] of Object.entries(detectedTeams)) {
          const members = (teamData as any).members || [];
          if (members.some((m: string) => m.toLowerCase() === winnerId.toLowerCase())) {
            winnerIdForUpdate = teamId;
            console.log(`🎯 [POST-CONFIRM] Mapped winner player ${winnerId} to team ${teamId}`);
            break;
          }
        }
      }
    }

    console.log(`🎯 [POST-CONFIRM] Calling updateTournamentRoundMatch with winner=${winnerIdForUpdate}`);
    const seriesResult = await updateTournamentRoundMatch(tournamentRoundMatchId, winnerIdForUpdate);
    console.log(`🎯 [POST-CONFIRM] updateTournamentRoundMatch returned:`, seriesResult);

    // If series is not complete and we need another match, create it (e.g., 1-1 in BO3)
    if (seriesResult.shouldCreateNextMatch && seriesResult.tournamentId && seriesResult.roundId) {
      try {
        const { createNextMatchInSeries } = await import('../utils/bestOf.js');
        const newMatchId = await createNextMatchInSeries(
          tournamentRoundMatchId,
          seriesResult.tournamentId,
          seriesResult.roundId
        );
        if (newMatchId) {
          console.log(`🎯 [POST-CONFIRM] Created next match in series: ${newMatchId}`);
        }
      } catch (nextMatchErr) {
        console.error('⚠️  [POST-CONFIRM] Error creating next match:', nextMatchErr);
      }
    }

    // If series is complete, check if round is complete
    if (seriesResult.seriesCompleted && seriesResult.tournamentId) {
      try {
        const rnResult = await query(
          `SELECT round_number FROM tournament_rounds WHERE id = ?`,
          [seriesResult.roundId]
        );
        const roundNumber = (rnResult as any).rows?.[0]?.round_number;
        if (roundNumber) {
          const { checkAndCompleteRound } = await import('../utils/tournament.js');
          await checkAndCompleteRound(seriesResult.tournamentId, roundNumber);
        }
      } catch (roundErr) {
        console.error('⚠️  [POST-CONFIRM] Error checking round completion:', roundErr);
      }
    }
  } catch (err) {
    console.error('❌ [POST-CONFIRM] Error in post-confirmation handling:', err);
    // Don't throw - let the match creation succeed even if post-confirmation fails
  }
}
