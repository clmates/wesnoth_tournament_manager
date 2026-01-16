/**
 * Tournament match generation utilities
 * Generates tournament matches based on tournament type and participants
 */



import { query } from '../config/database.js';
import discordService from '../services/discordService.js';

interface Participant {
  id: string;
  user_id: string;
  elo_rating?: number;
}

/**
 * Select top players for elimination phase in Swiss-Elimination Mix
 * This function is called before activating the first elimination round
 * It calculates how many players should advance based on elimination rounds
 * and marks the rest as eliminated
 */
export async function selectPlayersForEliminationPhase(
  tournamentId: string,
  finalRounds: number
): Promise<boolean> {
  try {
    // Calculate how many players should advance to elimination
    // With N final rounds in elimination format:
    // - 1 final round: 2 players
    // - 2 final rounds: 4 players
    // - 3 final rounds: 8 players
    const playersToAdvance = Math.pow(2, finalRounds);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 [SELECT_PLAYERS] STARTING PLAYER SELECTION FOR ELIMINATION PHASE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Tournament ID: ${tournamentId}`);
    console.log(`Final Rounds: ${finalRounds}`);
    console.log(`Players to Advance: ${playersToAdvance}`);
    
    // Get the top N players by tournament points, wins, Swiss tiebreakers, and ELO
    const topPlayersResult = await query(
      `SELECT tp.user_id FROM tournament_participants tp
       LEFT JOIN users u ON tp.user_id = u.id
       WHERE tp.tournament_id = $1 AND tp.participation_status = 'accepted'
       ORDER BY tp.tournament_points DESC, tp.tournament_wins DESC, tp.omp DESC, tp.gwp DESC, tp.ogp DESC, u.elo_rating DESC, tp.user_id
       LIMIT $2`,
      [tournamentId, playersToAdvance]
    );

    if (topPlayersResult.rows.length === 0) {
      console.log(`❌ [SELECT_PLAYERS] No players found to advance to elimination phase`);
      return false;
    }

    const topPlayerIds = topPlayersResult.rows.map((row: any) => row.user_id);
    console.log(`✅ [SELECT_PLAYERS] Top ${topPlayerIds.length} players advancing: ${topPlayerIds.join(', ')}`);
    
    // First, explicitly mark advancing players as 'active'
    console.log(`\n[SELECT_PLAYERS] Updating status for advancing players...`);
    const activateResult = await query(
      `UPDATE tournament_participants
       SET status = 'active'
       WHERE tournament_id = $1 
       AND participation_status = 'accepted'
       AND user_id IN (${topPlayerIds.map((_, i) => `$${i + 2}`).join(',')})`,
      [tournamentId, ...topPlayerIds]
    );
    console.log(`✅ [SELECT_PLAYERS] Updated ${activateResult.rowCount} advancing players to ACTIVE`);
    
    // Then mark all other players as eliminated - use NOT IN for clarity
    console.log(`\n[SELECT_PLAYERS] Updating status for eliminated players...`);
    const result = await query(
      `UPDATE tournament_participants
       SET status = 'eliminated'
       WHERE tournament_id = $1 
       AND participation_status = 'accepted'
       AND user_id NOT IN (${topPlayerIds.map((_, i) => `$${i + 2}`).join(',')})`,
      [tournamentId, ...topPlayerIds]
    );
    console.log(`🚫 [SELECT_PLAYERS] Updated ${result.rowCount} eliminated players`);
    
    // Verify the update
    const verifyResult = await query(
      `SELECT status, COUNT(*) as count FROM tournament_participants
       WHERE tournament_id = $1
       GROUP BY status`,
      [tournamentId]
    );
    
    console.log(`\n[SELECT_PLAYERS] Verification - Final status distribution:`);
    verifyResult.rows.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count} players`);
    });
    
    console.log(`${'='.repeat(80)}\n`);
    
    // Calculate tiebreakers for Swiss phase completion
    console.log(`\n🎲 [TIEBREAKERS] Calculating Swiss tiebreakers (OMP, GWP, OGP)...`);
    try {
      const tiebreakersResult = await query(
        'SELECT updated_count, error_message FROM update_tournament_tiebreakers($1)',
        [tournamentId]
      );
      
      if (tiebreakersResult.rows.length > 0) {
        const { updated_count, error_message } = tiebreakersResult.rows[0];
        if (error_message) {
          console.error(`❌ [TIEBREAKERS] Error: ${error_message}`);
        } else {
          console.log(`✅ [TIEBREAKERS] Calculated tiebreakers for ${updated_count} participants`);
        }
      }
    } catch (tiebreakersErr) {
      console.error('[TIEBREAKERS] Error calculating tiebreakers:', tiebreakersErr);
      // Don't fail the tournament if tiebreakers calculation fails
    }
    
    return true;
  } catch (error) {
    console.error('[SELECT_PLAYERS] Error selecting players for elimination phase:', error);
    return false;
  }
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
  tournamentMode: string = 'ranked',
  tournamentRoundMatches: any[] = []
): any[] {
  const matches = [];
  
  // Sort by ELO rating (descending) for consistency when handling byes
  const sorted = [...participants].sort((a, b) => (b.elo_rating || 0) - (a.elo_rating || 0));
  
  // Shuffle while keeping sort for reference
  const shuffled = sorted.sort(() => Math.random() - 0.5);

  // Pair up participants
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    // For team tournaments, shuffled[i].user_id contains the team_id
    // For 1v1 tournaments, shuffled[i].user_id contains the user_id
    // ARCHITECTURE NOTE (Option B): In team mode, player_id1/2 columns store team_id, not user_id
    // This is intentional and documented - it allows reusing existing match infrastructure
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
    console.log(`🎯 Odd number of participants (${shuffled.length}). ${tournamentMode === 'team' ? 'Team' : 'Player'} ${byePlayer.user_id} (ELO: ${byePlayer.elo_rating}) advances automatically (BYE)`);
    
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
 * For team mode: player_id1/2 contain team_id (Option B architecture)
 */
function generateEliminationMatches(
  winners: any[],
  tournamentId: string,
  roundId: string,
  tournamentMode: string = 'ranked'
): any[] {
  const matches = [];
  
  // Sort by ELO rating (descending) to identify bye candidate
  const sorted = [...winners].sort((a, b) => (b.elo_rating || 0) - (a.elo_rating || 0));
  
  // Shuffle for bracket arrangement
  const shuffled = [...sorted].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    // ARCHITECTURE NOTE (Option B): In team mode, player_id1/2 columns store team_id
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
    console.log(`🏆 Elimination round with odd players (${shuffled.length}). ${tournamentMode === 'team' ? 'Team' : 'Player'} ${byePlayer.user_id} (ELO: ${byePlayer.elo_rating}) advances automatically (BYE)`);
    
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
 * For team mode: player_id1/2 contain team_id (Option B architecture)
 */
function generateRoundRobinMatches(
  participants: any[],
  tournamentId: string,
  roundId: string,
  tournamentMode: string = 'ranked'
): any[] {
  const matches = [];
  const maxMatches = 20; // Limit matches per round for practical reasons

  // Generate round-robin pairings, limited by maxMatches
  for (let i = 0; i < participants.length - 1 && matches.length < maxMatches; i++) {
    for (let j = i + 1; j < participants.length && matches.length < maxMatches; j++) {
      // ARCHITECTURE NOTE (Option B): In team mode, player_id1/2 columns store team_id
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
 * Generates Swiss system matches
 * Pairs players based on their current score and tiebreakers (OMP, GWP, OGP)
 * Avoids re-pairings when possible
 * For team mode: player_id1/2 contain team_id (Option B architecture)
 */
async function generateSwissMatches(
  participants: any[],
  tournamentId: string,
  roundId: string,
  roundNumber: number,
  tournamentMode: string = 'ranked'
): Promise<any[]> {
  const matches: any[] = [];

  if (participants.length < 2) {
    return matches;
  }

  try {
    // Get player standings with scores and tiebreakers (ELO from users table)
    const standingsResult = await query(
      `SELECT 
        tp.user_id,
        tp.tournament_wins,
        tp.tournament_losses,
        u.elo_rating,
        tp.omp,
        tp.gwp,
        tp.ogp
       FROM tournament_participants tp
       LEFT JOIN users u ON tp.user_id = u.id
       WHERE tp.tournament_id = $1 AND tp.user_id = ANY($2)
       ORDER BY 
         (tp.tournament_wins - tp.tournament_losses) DESC,
         tp.omp DESC,
         tp.gwp DESC,
         tp.ogp DESC,
         u.elo_rating DESC`,
      [tournamentId, participants.map(p => p.user_id)]
    );

    const standings = standingsResult.rows;
    console.log(`\n🎲 [SWISS PAIRINGS] Round ${roundNumber}: ${standings.length} players`);
    standings.forEach(p => {
      const score = (p.tournament_wins - p.tournament_losses);
      console.log(`  Player ${p.user_id}: ${p.tournament_wins}-${p.tournament_losses} (OMP:${p.omp} GWP:${p.gwp} OGP:${p.ogp} ELO:${p.elo_rating})`);
    });

    // Group by score
    const scoreGroups: { [key: string]: any[] } = {};
    standings.forEach(player => {
      const score = (player.tournament_wins - player.tournament_losses).toString();
      if (!scoreGroups[score]) {
        scoreGroups[score] = [];
      }
      scoreGroups[score].push(player);
    });

    console.log(`\n[SCORE GROUPS]:`);
    Object.keys(scoreGroups).sort((a, b) => parseInt(b) - parseInt(a)).forEach(score => {
      console.log(`  Score ${score}: ${scoreGroups[score].length} players`);
    });

    // Get history of pairings to avoid re-matches
    const pairingHistoryResult = await query(
      `SELECT DISTINCT 
        LEAST(player1_id, player2_id) as player_a,
        GREATEST(player1_id, player2_id) as player_b
       FROM tournament_matches
       WHERE tournament_id = $1 AND player1_id IS NOT NULL AND player2_id IS NOT NULL`,
      [tournamentId]
    );

    const previousPairings = new Set(
      pairingHistoryResult.rows.map(row => `${row.player_a}|${row.player_b}`)
    );

    console.log(`\n[PREVIOUS PAIRINGS]: ${previousPairings.size} historical pairings found`);

    // Pair within each score group
    const paired = new Set<string>();
    
    for (const score of Object.keys(scoreGroups).sort((a, b) => parseInt(b) - parseInt(a))) {
      const group = scoreGroups[score];
      console.log(`\n[PAIRING GROUP] Score ${score}:`);

      const available = group.filter(p => !paired.has(p.user_id));
      
      for (let i = 0; i < available.length - 1; i++) {
        // Skip if already paired
        if (paired.has(available[i].user_id)) continue;

        let paired_with = null;

        // Try to pair with next player without creating a re-match
        for (let j = i + 1; j < available.length; j++) {
          if (paired.has(available[j].user_id)) continue;

          const pairing_key = `${Math.min(available[i].user_id, available[j].user_id)}|${Math.max(available[i].user_id, available[j].user_id)}`;
          
          // If this pairing hasn't happened before, use it
          if (!previousPairings.has(pairing_key)) {
            paired_with = available[j];
            console.log(`  ✅ Pair ${available[i].user_id} vs ${available[j].user_id} (new pairing)`);
            break;
          } else {
            console.log(`  ⚠️  Avoid ${available[i].user_id} vs ${available[j].user_id} (re-match)`);
          }
        }

        // If no new pairing found, use the first available (re-match necessary)
        if (!paired_with) {
          for (let j = i + 1; j < available.length; j++) {
            if (!paired.has(available[j].user_id)) {
              paired_with = available[j];
              console.log(`  ⚠️  Pair ${available[i].user_id} vs ${available[j].user_id} (unavoidable re-match)`);
              break;
            }
          }
        }

        if (paired_with) {
          matches.push({
            tournament_id: tournamentId,
            round_id: roundId,
            player1_id: available[i].user_id,
            player2_id: paired_with.user_id,
          });
          paired.add(available[i].user_id);
          paired.add(paired_with.user_id);
        }
      }
    }

    // Handle odd player: best remaining gets bye
    const unpaired = standings.find(p => !paired.has(p.user_id));
    if (unpaired) {
      console.log(`\n✅ BYE: Player ${unpaired.user_id} (${unpaired.tournament_wins}-${unpaired.tournament_losses}) advances automatically`);
      matches.push({
        tournament_id: tournamentId,
        round_id: roundId,
        player1_id: unpaired.user_id,
        player2_id: null,
        is_bye: true,
      });
    }

    console.log(`\n[SWISS PAIRINGS RESULT] Generated ${matches.length} pairings`);
    return matches;
  } catch (error) {
    console.error('❌ Error in generateSwissMatches:', error);
    throw error;
  }
}

/**
 * Generates League matches
 * All participants play each round, new pairings each time
 */
function generateLeagueMatches(
  participants: any[],
  tournamentId: string,
  roundId: string,
  tournamentMode: string = 'ranked'
): any[] {
  const matches: any[] = [];

  if (participants.length < 2) {
    return matches;
  }

  // Generate new random pairings for each round
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    // ARCHITECTURE NOTE (Option B): In team mode, player_id1/2 columns store team_id
    matches.push({
      tournament_id: tournamentId,
      round_id: roundId,
      player1_id: shuffled[i].user_id,
      player2_id: shuffled[i + 1].user_id,
    });
  }

  // If odd number, highest ELO gets bye
  if (shuffled.length % 2 === 1) {
    const sorted = [...participants].sort((a, b) => (b.elo_rating || 0) - (a.elo_rating || 0));
    const byePlayer = sorted[0];
    console.log(`🎯 League Round: ${tournamentMode === 'team' ? 'Team' : 'Player'} ${byePlayer.user_id} (ELO: ${byePlayer.elo_rating}) advances automatically (BYE)`);
    matches.push({
      tournament_id: tournamentId,
      round_id: roundId,
      player1_id: byePlayer.user_id,
      player2_id: null,
      is_bye: true,
    });
  }

  return matches;
}

/**
 * Activates a round and generates its matches (for first time only)
 */
export async function activateRound(tournamentId: string, roundNumber: number): Promise<boolean> {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎯 [ACTIVATE_ROUND] Starting activation for tournament=${tournamentId}, round_number=${roundNumber}`);
    console.log(`${'='.repeat(80)}`);
    
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
    console.log(`[ACTIVATE_ROUND] Round found: status=${round.round_status}, format=${round.round_format}`);

    if (round.round_status !== 'pending') {
      console.warn(`Round ${roundNumber} is already ${round.round_status}`);
      return false;
    }

    // Get tournament info (including tournament_mode for team tournament handling)
    const tournamentResult = await query(
      `SELECT tournament_type, tournament_mode FROM tournaments WHERE id = $1`,
      [tournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      throw new Error('Tournament not found');
    }

    const tournament = tournamentResult.rows[0];

    // Check if this is transitioning from Swiss to Elimination phase
    if (roundNumber > 1) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔄 [ACTIVATE_ROUND] Checking for Swiss→Elimination transition`);
      console.log(`${'='.repeat(80)}`);
      console.log(`Tournament ID: ${tournamentId}`);
      console.log(`Round Number: ${roundNumber}`);
      console.log(`Tournament Type: ${tournament.tournament_type}`);
      
      const tournamentType = tournament.tournament_type?.toLowerCase() || 'elimination';
      const roundTypeResult = await query(
        `SELECT round_type FROM tournament_rounds WHERE id = $1`,
        [round.id]
      );
      const roundType = roundTypeResult.rows[0]?.round_type?.toLowerCase() || 'general';
      
      console.log(`Round Type from DB: ${roundTypeResult.rows[0]?.round_type}`);
      console.log(`Round Type (lowercase): ${roundType}`);
      console.log(`Is elimination phase? ${roundType !== 'general'}`);
      
      // If we're activating the first elimination round in a swiss_elimination tournament,
      // we need to select players if not already done
      if (tournamentType === 'swiss_elimination' && roundType !== 'general') {
        console.log(`\n✅ [ACTIVATE_ROUND] Detected Swiss-Elimination Mix entering elimination phase`);
        
        const tournamentInfo = await query(
          `SELECT general_rounds, final_rounds FROM tournaments WHERE id = $1`,
          [tournamentId]
        );
        const { general_rounds, final_rounds } = tournamentInfo.rows[0];
        
        console.log(`General Rounds (Swiss phase): ${general_rounds}`);
        console.log(`Final Rounds (Elimination phase): ${final_rounds}`);
        console.log(`Players to advance: ${Math.pow(2, final_rounds)}`);
        
        // Check if players have already been selected (should have at least some eliminated)
        const eliminatedCount = await query(
          `SELECT COUNT(*) as count FROM tournament_participants 
           WHERE tournament_id = $1 AND status = 'eliminated'`,
          [tournamentId]
        );
        
        const elimCount = eliminatedCount.rows[0].count;
        console.log(`Currently eliminated players: ${elimCount}`);
        
        // If no players are eliminated yet, run the selection
        if (elimCount === 0) {
          console.log(`\n⚠️  [ACTIVATE_ROUND] No eliminated players detected. Running selectPlayersForEliminationPhase()...`);
          await selectPlayersForEliminationPhase(tournamentId, final_rounds);
          console.log(`✅ [ACTIVATE_ROUND] selectPlayersForEliminationPhase() completed`);
        } else {
          console.log(`\n⏭️  [ACTIVATE_ROUND] Already have ${elimCount} eliminated players, skipping selection`);
        }
      } else {
        console.log(`\n⏭️  [ACTIVATE_ROUND] NOT a Swiss-Elimination transition. Conditions:`, {
          isSWISSEL: tournamentType === 'swiss_elimination',
          isELIM: roundType !== 'general'
        });
      }
    }

    // Get accepted participants for first round, or based on tournament type for subsequent rounds
    let participants;
    const isteamMode = tournament.tournament_mode === 'team';
    
    if (roundNumber === 1) {
      if (isteamMode) {
        // Team tournament: get teams instead of individual players
        // ARCHITECTURE NOTE (Option B): We'll use team.id as if it were user_id for pairing functions
        // The team_id will be stored in player_id1/2 columns of tournament_matches
        const teamsResult = await query(
          `SELECT tt.id as user_id, tt.team_elo as elo_rating
           FROM tournament_teams tt
           WHERE tt.tournament_id = $1 AND tt.status = 'active'`,
          [tournamentId]
        );
        participants = teamsResult.rows;
        console.log(`[ACTIVATE_ROUND] Team mode: ${participants.length} teams for first round`);
      } else {
        // 1v1 tournament: get individual players
        const participantsResult = await query(
          `SELECT tp.id, tp.user_id, u.elo_rating
           FROM tournament_participants tp
           LEFT JOIN users u ON tp.user_id = u.id
           WHERE tp.tournament_id = $1 AND tp.participation_status = 'accepted'`,
          [tournamentId]
        );
        participants = participantsResult.rows;
      }
    } else {
      // For subsequent rounds, behavior depends on tournament type AND round type
      const tournamentType = tournament.tournament_type?.toLowerCase() || 'elimination';
      
      // Get the round type - must query it since it wasn't in the initial round fetch
      const roundTypeResult = await query(
        `SELECT round_type FROM tournament_rounds WHERE id = $1`,
        [round.id]
      );
      const roundType = roundTypeResult.rows[0]?.round_type?.toLowerCase() || 'general';
      
      console.log(`\n[GET_PARTICIPANTS] Round Type check: "${roundType}" (not 'general'? ${roundType !== 'general'})`);
      
      if (isteamMode) {
        // Team tournament: subsequent rounds
        if (tournamentType === 'elimination') {
          // Team elimination: only get active teams
          const teamsResult = await query(
            `SELECT tt.id as user_id, tt.team_elo as elo_rating
             FROM tournament_teams tt
             WHERE tt.tournament_id = $1 AND tt.status = 'active'`,
            [tournamentId]
          );
          participants = teamsResult.rows;
          console.log(`[GET_PARTICIPANTS] Team mode elimination: ${participants.length} active teams`);
        } else {
          // Team swiss/league: all active teams
          const teamsResult = await query(
            `SELECT tt.id as user_id, tt.team_elo as elo_rating
             FROM tournament_teams tt
             WHERE tt.tournament_id = $1 AND tt.status = 'active'`,
            [tournamentId]
          );
          participants = teamsResult.rows;
          console.log(`[GET_PARTICIPANTS] Team mode swiss/league: ${participants.length} active teams`);
        }
      } else if (tournamentType === 'elimination') {
        // 1v1 Elimination: only get non-eliminated participants (status = 'active')
        const participantsResult = await query(
          `SELECT tp.id, tp.user_id, u.elo_rating
           FROM tournament_participants tp
           LEFT JOIN users u ON tp.user_id = u.id
           WHERE tp.tournament_id = $1 AND tp.participation_status = 'accepted' AND status = 'active'`,
          [tournamentId]
        );
        participants = participantsResult.rows;
        console.log(`[GET_PARTICIPANTS] Elimination round: ${participants.length} active participants`);
      } else if (tournamentType === 'swiss_elimination' && roundType !== 'general') {
        // Swiss-Elimination Mix in elimination rounds (not Swiss): only get non-eliminated participants (status = 'active')
        console.log(`[GET_PARTICIPANTS] Swiss-Elimination Mix - ELIMINATION PHASE (roundType="${roundType}")`);
        const participantsResult = await query(
          `SELECT tp.id, tp.user_id, u.elo_rating
           FROM tournament_participants tp
           LEFT JOIN users u ON tp.user_id = u.id
           WHERE tp.tournament_id = $1 AND tp.participation_status = 'accepted' AND status = 'active'`,
          [tournamentId]
        );
        participants = participantsResult.rows;
        console.log(`[GET_PARTICIPANTS] Found ${participants.length} active participants for elimination round`);
        console.log(`[GET_PARTICIPANTS] Players: ${participants.map(p => p.user_id).join(', ')}`);
      } else {
        // 1v1 Swiss, League, Swiss-Elimination (general rounds): all accepted participants continue
        console.log(`[GET_PARTICIPANTS] Swiss/League round (tournamentType="${tournamentType}", roundType="${roundType}")`);
        const participantsResult = await query(
          `SELECT tp.id, tp.user_id, u.elo_rating
           FROM tournament_participants tp
           LEFT JOIN users u ON tp.user_id = u.id
           WHERE tp.tournament_id = $1 AND tp.participation_status = 'accepted'`,
          [tournamentId]
        );
        participants = participantsResult.rows;
        console.log(`[GET_PARTICIPANTS] Swiss/League round: ${participants.length} total participants`);
      }
    }

    if (participants.length === 0) {
      const errorMsg = `No participants available for round ${roundNumber}`;
      console.error(`[ACTIVATE_ROUND] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Determine best_of format from round_format (bo1, bo3, bo5)
    const bestOfMap: { [key: string]: 1 | 3 | 5 } = {
      'bo1': 1,
      'bo3': 3,
      'bo5': 5
    };
    const bestOf = bestOfMap[round.round_format] || 3;
    const winsRequired = Math.ceil(bestOf / 2);

    console.log(`[ACTIVATE_ROUND] Retrieved ${participants.length} participants for round ${roundNumber}`);
    console.log(`[ACTIVATE_ROUND] Best Of format: ${bestOf} (wins required: ${winsRequired})`);

    // Generate pairings based on round number and tournament type
    let pairings;
    if (roundNumber === 1) {
      // First round: pair all participants
      pairings = generateFirstRoundMatches(participants, tournamentId, round.id, tournament.tournament_mode);
    } else {
      // Subsequent rounds: depends on tournament type AND round type
      const tournamentType = tournament.tournament_type?.toLowerCase() || 'elimination';
      
      // Get the round type to determine if we're in final phase
      const roundTypeResult = await query(
        `SELECT round_type FROM tournament_rounds WHERE id = $1`,
        [round.id]
      );
      const roundType = roundTypeResult.rows[0]?.round_type?.toLowerCase() || 'general';
      
      console.log(`\n[GENERATE_PAIRINGS] Round ${roundNumber}:`);
      console.log(`  Tournament Type: ${tournamentType}`);
      console.log(`  Round Type: ${roundType}`);
      console.log(`  Participants: ${participants.length}`);
      
      if (tournamentType === 'elimination') {
        // Elimination: pair winners from previous round
        console.log(`  → Using ELIMINATION pairings`);
        pairings = generateEliminationMatches(participants, tournamentId, round.id, tournament.tournament_mode);
      } else if (tournamentType === 'swiss_elimination' && roundType !== 'general') {
        // Swiss-Elimination Mix in final phase (not Swiss): use elimination pairings
        console.log(`  → Using ELIMINATION pairings (Swiss-Elimination final phase)`);
        pairings = generateEliminationMatches(participants, tournamentId, round.id, tournament.tournament_mode);
      } else if (tournamentType === 'swiss' || tournamentType === 'swiss_elimination') {
        // Swiss: use Swiss pairing system for all participants still in tournament
        console.log(`  → Using SWISS pairings`);
        pairings = await generateSwissMatches(participants, tournamentId, round.id, roundNumber, tournament.tournament_mode);
      } else {
        // League: all participants play each other
        console.log(`  → Using LEAGUE pairings`);
        pairings = generateLeagueMatches(participants, tournamentId, round.id, tournament.tournament_mode);
      }
      
      console.log(`  Generated ${pairings.length} total pairings`);
      const byeCount = pairings.filter(p => p.is_bye || p.player2_id === null).length;
      const matchCount = pairings.length - byeCount;
      console.log(`  → ${matchCount} actual matches, ${byeCount} byes`);
    }

    console.log(`[ACTIVATE_ROUND] Processing ${pairings.length} pairings...`);
    let matchesCreated = 0;
    let byesProcessed = 0;

    for (const pairing of pairings) {
      // Handle bye (automatic advancement for odd player count)
      if (pairing.is_bye || pairing.player2_id === null) {
        console.log(`✅ BYE: ${tournament.tournament_mode === 'team' ? 'Team' : 'Player'} ${pairing.player1_id} advances automatically to next round`);
        byesProcessed++;
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
      matchesCreated++;
    }

    console.log(`[ACTIVATE_ROUND] Summary: Created ${matchesCreated} series, ${byesProcessed} byes`);

    // Update round status to in_progress
    await query(
      `UPDATE tournament_rounds 
       SET round_status = 'in_progress', round_start_date = NOW()
       WHERE id = $1`,
      [round.id]
    );

    // For team tournaments: update current_round and recalculate rankings
    if (isteamMode) {
      await updateTeamCurrentRound(tournamentId, roundNumber);
      await recalculateTeamRankings(tournamentId);
    }

    console.log(`✅ [ACTIVATE_ROUND] Round ${roundNumber} successfully activated with ${pairings.length} pairings (${matchesCreated} matches + ${byesProcessed} byes), best_of: ${bestOf}`);
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

      // Notify Discord of tournament finish
      try {
        const tournamentResult = await query(
          `SELECT name, discord_thread_id FROM tournaments WHERE id = $1`,
          [tournamentId]
        );

        if (tournamentResult.rows.length > 0 && tournamentResult.rows[0].discord_thread_id) {
          // Get winner and runner up
          const rankingResult = await query(
            `SELECT tp.user_id, u.nickname, tp.tournament_points, tp.tournament_wins
             FROM tournament_participants tp
             LEFT JOIN users u ON tp.user_id = u.id
             WHERE tp.tournament_id = $1 AND tp.participation_status = 'accepted'
             ORDER BY tp.tournament_points DESC, tp.tournament_wins DESC
             LIMIT 2`,
            [tournamentId]
          );

          if (rankingResult.rows.length > 0) {
            const winner = rankingResult.rows[0];
            const runnerUp = rankingResult.rows.length > 1 ? rankingResult.rows[1] : null;

            await discordService.postTournamentFinished(
              tournamentResult.rows[0].discord_thread_id,
              tournamentResult.rows[0].name,
              winner.nickname || 'Unknown',
              runnerUp ? runnerUp.nickname : 'N/A'
            );
          }
        }
      } catch (discordErr) {
        console.error('Discord tournament finished notification error:', discordErr);
        // Don't fail the tournament completion if Discord fails
      }
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
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 [CHECK_COMPLETE_ROUND] Checking if Round ${roundNumber} is complete`);
    console.log(`   Tournament: ${tournamentId}`);
    console.log(`${'='.repeat(80)}`);
    
    // Get all matches in this round
    const roundInfo = await query(
      `SELECT id FROM tournament_rounds 
       WHERE tournament_id = $1 AND round_number = $2`,
      [tournamentId, roundNumber]
    );

    if (roundInfo.rows.length === 0) {
      console.log(`❌ No round found`);
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

      // Check if this is the last Swiss round in a Swiss-Elimination Mix tournament
      const currentRoundInfo = await query(
        `SELECT tr.round_type, t.tournament_type, t.general_rounds, t.final_rounds
         FROM tournament_rounds tr
         JOIN tournaments t ON tr.tournament_id = t.id
         WHERE tr.id = $1`,
        [roundId]
      );

      if (currentRoundInfo.rows.length > 0) {
        const { round_type, tournament_type, general_rounds, final_rounds } = currentRoundInfo.rows[0];
        
        console.log(`\n📋 [DEBUG] Round completion check:`);
        console.log(`   Round Type: ${round_type}`);
        console.log(`   Tournament Type: ${tournament_type}`);
        console.log(`   Round Number: ${roundNumber} / ${general_rounds}`);
        console.log(`   Check 1 - Type is swiss_elimination? ${tournament_type === 'swiss_elimination'}`);
        console.log(`   Check 2 - Round type is general? ${round_type === 'general'}`);
        console.log(`   Check 3 - Is last Swiss round? ${roundNumber === general_rounds}`);
        
        // Only execute if:
        // 1. Tournament type is 'swiss_elimination'
        // 2. Current round type is 'general' (Swiss phase)
        // 3. This is the last Swiss round (roundNumber === general_rounds)
        if (tournament_type === 'swiss_elimination' && round_type === 'general' && roundNumber === general_rounds) {
          console.log(`\n✅ [SWISS_ELIMINATION] Completed last Swiss round (Round ${roundNumber}/${general_rounds})`);
          console.log(`📊 [SWISS_ELIMINATION] Now selecting top ${Math.pow(2, final_rounds)} players for elimination phase...`);
          
          // Execute player selection for elimination phase
          await selectPlayersForEliminationPhase(tournamentId, final_rounds);
        } else {
          console.log(`\n⏭️  [SWISS_ELIMINATION] Not executing selectPlayersForEliminationPhase() - conditions not met`);
        }
      }

      // Check if this is the last round
      const totalRoundsResult = await query(
        `SELECT COUNT(*) as total_rounds FROM tournament_rounds WHERE tournament_id = $1`,
        [tournamentId]
      );
      const totalRounds = parseInt(totalRoundsResult.rows[0].total_rounds);

      if (roundNumber === totalRounds) {
        // This is the last round - tournament is about to finish
        
        // FIRST: Calculate tiebreakers BEFORE marking as finished
        // This ensures rankings are properly ordered by OMP/GWP/OGP for correct winner selection
        console.log(`\n🎲 [TIEBREAKERS] Calculating tournament tiebreakers (OMP, GWP, OGP) BEFORE finishing...`);
        try {
          const tiebreakersResult = await query(
            'SELECT updated_count, error_message FROM update_tournament_tiebreakers($1)',
            [tournamentId]
          );
          
          if (tiebreakersResult.rows.length > 0) {
            const { updated_count, error_message } = tiebreakersResult.rows[0];
            if (error_message) {
              console.error(`❌ [TIEBREAKERS] Error: ${error_message}`);
            } else {
              console.log(`✅ [TIEBREAKERS] Calculated tiebreakers for ${updated_count} participants`);
            }
          }
        } catch (tiebreakersErr) {
          console.error('[TIEBREAKERS] Error calculating tiebreakers:', tiebreakersErr);
          // Don't fail the tournament finish if tiebreakers calculation fails
        }

        // THEN: Get ranking with proper tiebreaker ordering
        const rankingResult = await query(
          `SELECT user_id FROM tournament_participants 
           WHERE tournament_id = $1 
           ORDER BY tournament_points DESC, omp DESC, gwp DESC, ogp DESC
           LIMIT 1`,
          [tournamentId]
        );

        if (rankingResult.rows.length > 0) {
          const winnerId = rankingResult.rows[0].user_id;
          
          // NOW mark as finished
          await query(
            `UPDATE tournaments SET status = 'finished', finished_at = NOW() WHERE id = $1`,
            [tournamentId]
          );
          console.log(`🏆 Tournament ${tournamentId} finished - Winner: ${winnerId}`);

          // Notify Discord of tournament finish
          try {
            const tournamentResult = await query(
              `SELECT name, discord_thread_id FROM tournaments WHERE id = $1`,
              [tournamentId]
            );

            if (tournamentResult.rows.length > 0 && tournamentResult.rows[0].discord_thread_id) {
              // Get detailed ranking with nicknames for winner and runner-up
              const detailedRankingResult = await query(
                `SELECT tp.user_id, u.nickname, tp.tournament_points, tp.tournament_wins
                 FROM tournament_participants tp
                 LEFT JOIN users u ON tp.user_id = u.id
                 WHERE tp.tournament_id = $1 AND tp.participation_status = 'accepted'
                 ORDER BY tp.tournament_points DESC, tp.tournament_wins DESC
                 LIMIT 2`,
                [tournamentId]
              );

              if (detailedRankingResult.rows.length > 0) {
                const winner = detailedRankingResult.rows[0];
                const runnerUp = detailedRankingResult.rows.length > 1 ? detailedRankingResult.rows[1] : null;

                await discordService.postTournamentFinished(
                  tournamentResult.rows[0].discord_thread_id,
                  tournamentResult.rows[0].name,
                  winner.nickname || 'Unknown',
                  runnerUp ? runnerUp.nickname : 'N/A'
                );
              }
            }
          } catch (discordErr) {
            console.error('Discord tournament finished notification error:', discordErr);
            // Don't fail the tournament completion if Discord fails
          }
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

/**
 * Calculate and update tournament rankings for team mode
 * Ranks teams based on: wins-losses difference, then OMP, GWP, OGP, ELO
 * Updates tournament_ranking column for UI display
 */
export async function recalculateTeamRankings(tournamentId: string): Promise<void> {
  try {
    console.log(`\n📊 [TEAM_RANKINGS] Recalculating rankings for tournament ${tournamentId}`);

    // Get all active teams ranked by performance
    const teamsResult = await query(
      `SELECT 
        tt.id,
        tt.name,
        tt.tournament_wins,
        tt.tournament_losses,
        tt.tournament_points,
        tt.omp,
        tt.gwp,
        tt.ogp
       FROM tournament_teams tt
       WHERE tt.tournament_id = $1 AND tt.status = 'active'
       ORDER BY 
         (tt.tournament_wins - tt.tournament_losses) DESC,
         tt.omp DESC,
         tt.gwp DESC,
         tt.ogp DESC`,
      [tournamentId]
    );

    const teams = teamsResult.rows;
    console.log(`Found ${teams.length} active teams for ranking`);

    // Update ranking for each team
    for (let i = 0; i < teams.length; i++) {
      const ranking = i + 1;
      await query(
        `UPDATE tournament_teams SET tournament_ranking = $1 WHERE id = $2`,
        [ranking, teams[i].id]
      );
      console.log(`  Team ${teams[i].team_name}: Rank #${ranking} (${teams[i].tournament_wins}W-${teams[i].tournament_losses}L)`);
    }

    console.log(`✅ Team rankings updated for tournament ${tournamentId}`);
  } catch (error) {
    console.error('Error recalculating team rankings:', error);
    throw error;
  }
}

/**
 * Update current_round for team when advancing to next round
 * Called when a new round is activated
 */
export async function updateTeamCurrentRound(tournamentId: string, roundNumber: number): Promise<void> {
  try {
    console.log(`\n🔄 [TEAM_ROUND] Updating current_round to ${roundNumber} for tournament ${tournamentId}`);

    // For round 1, all teams start in round 1
    // For subsequent rounds, only active teams are updated
    if (roundNumber === 1) {
      await query(
        `UPDATE tournament_teams SET current_round = $1 WHERE tournament_id = $2`,
        [roundNumber, tournamentId]
      );
      console.log(`✅ All teams set to current_round = ${roundNumber}`);
    } else {
      // Only update active teams (eliminated teams stay at their elimination round)
      await query(
        `UPDATE tournament_teams SET current_round = $1 WHERE tournament_id = $2 AND status = 'active'`,
        [roundNumber, tournamentId]
      );
      console.log(`✅ Active teams updated to current_round = ${roundNumber}`);
    }
  } catch (error) {
    console.error('Error updating team current_round:', error);
    throw error;
  }
}

