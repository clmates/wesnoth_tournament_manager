import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Update player match statistics for all 8 dimensions
 * Called after a ranked match is reported
 * 
 * Dimensions:
 * 1. Winner Global (no opponent, no map, no faction)
 * 2. Loser Global (no opponent, no map, no faction)
 * 3. H2H Winner Aggregated (opponent set, no map, no faction)
 * 4. H2H Loser Aggregated (opponent set, no map, no faction)
 * 5. Winner Per-Map (no opponent, map set, no faction)
 * 6. Loser Per-Map (no opponent, map set, no faction)
 * 7. Winner Per-Faction (no opponent, no map, faction set)
 * 8. Loser Per-Faction (no opponent, no map, faction set)
 */
export async function updatePlayerStatistics(
  winnerId: string,
  loserId: string,
  mapName: string,
  winnerFactionName: string,
  loserFactionName: string,
  winnerEloChange: number,
  loserEloChange: number
): Promise<void> {
  console.log('🔄 [STATS] Starting player statistics update...');
  console.log(`   Winner: ${winnerId}, Loser: ${loserId}`);
  console.log(`   Map: ${mapName}, Factions: ${winnerFactionName} vs ${loserFactionName}`);

  try {
    // Get map ID
    const mapResult = await query(
      'SELECT id FROM game_maps WHERE name = $1 LIMIT 1',
      [mapName]
    );
    if (mapResult.rows.length === 0) {
      console.error(`❌ [STATS] Map not found: ${mapName}`);
      return;
    }
    const mapId = mapResult.rows[0].id;
    console.log(`   ✓ Map ID: ${mapId}`);

    // Get faction IDs
    const winnerFactionResult = await query(
      'SELECT id FROM factions WHERE name = $1 LIMIT 1',
      [winnerFactionName]
    );
    const loserFactionResult = await query(
      'SELECT id FROM factions WHERE name = $1 LIMIT 1',
      [loserFactionName]
    );

    if (winnerFactionResult.rows.length === 0 || loserFactionResult.rows.length === 0) {
      console.error(`❌ [STATS] Faction not found: ${winnerFactionName} or ${loserFactionName}`);
      return;
    }

    const winnerFactionId = winnerFactionResult.rows[0].id;
    const loserFactionId = loserFactionResult.rows[0].id;
    console.log(`   ✓ Winner faction ID: ${winnerFactionId}, Loser faction ID: ${loserFactionId}`);

    // === DIMENSION 1: WINNER GLOBAL ===
    await updateOrInsertStat({
      playerId: winnerId,
      opponentId: null,
      mapId: null,
      factionId: null,
      opponentFactionId: null,
      isWin: true,
      eloChange: winnerEloChange,
      dimensionName: 'Winner Global',
    });

    // === DIMENSION 2: LOSER GLOBAL ===
    await updateOrInsertStat({
      playerId: loserId,
      opponentId: null,
      mapId: null,
      factionId: null,
      opponentFactionId: null,
      isWin: false,
      eloChange: loserEloChange,
      dimensionName: 'Loser Global',
    });

    // === DIMENSION 3: H2H AGGREGATED (WINNER PERSPECTIVE) ===
    await updateOrInsertStat({
      playerId: winnerId,
      opponentId: loserId,
      mapId: null,
      factionId: null,
      opponentFactionId: null,
      isWin: true,
      eloChange: winnerEloChange,
      dimensionName: 'H2H Aggregated (Winner)',
      opponentEloAfter: loserEloChange, // Store opponent's ELO after
    });

    // === DIMENSION 4: H2H AGGREGATED (LOSER PERSPECTIVE) ===
    await updateOrInsertStat({
      playerId: loserId,
      opponentId: winnerId,
      mapId: null,
      factionId: null,
      opponentFactionId: null,
      isWin: false,
      eloChange: loserEloChange,
      dimensionName: 'H2H Aggregated (Loser)',
      opponentEloAfter: winnerEloChange, // Store opponent's ELO after
    });

    // === DIMENSION 5: WINNER PER-MAP ===
    await updateOrInsertStat({
      playerId: winnerId,
      opponentId: null,
      mapId: mapId,
      factionId: null,
      opponentFactionId: null,
      isWin: true,
      eloChange: winnerEloChange,
      dimensionName: 'Winner Per-Map',
    });

    // === DIMENSION 6: LOSER PER-MAP ===
    await updateOrInsertStat({
      playerId: loserId,
      opponentId: null,
      mapId: mapId,
      factionId: null,
      opponentFactionId: null,
      isWin: false,
      eloChange: loserEloChange,
      dimensionName: 'Loser Per-Map',
    });

    // === DIMENSION 7: WINNER PER-FACTION ===
    await updateOrInsertStat({
      playerId: winnerId,
      opponentId: null,
      mapId: null,
      factionId: winnerFactionId,
      opponentFactionId: null,
      isWin: true,
      eloChange: winnerEloChange,
      dimensionName: 'Winner Per-Faction',
    });

    // === DIMENSION 8: LOSER PER-FACTION ===
    await updateOrInsertStat({
      playerId: loserId,
      opponentId: null,
      mapId: null,
      factionId: loserFactionId,
      opponentFactionId: null,
      isWin: false,
      eloChange: loserEloChange,
      dimensionName: 'Loser Per-Faction',
    });

    console.log('✅ [STATS] Player statistics update completed successfully');
  } catch (error) {
    console.error('❌ [STATS] Error updating player statistics:', error);
    throw error;
  }
}

/**
 * Helper function to UPDATE or INSERT a single stats record
 */
async function updateOrInsertStat(params: {
  playerId: string;
  opponentId: string | null;
  mapId: string | null;
  factionId: string | null;
  opponentFactionId: string | null;
  isWin: boolean;
  eloChange: number;
  dimensionName: string;
  opponentEloAfter?: number;
}): Promise<void> {
  const {
    playerId,
    opponentId,
    mapId,
    factionId,
    opponentFactionId,
    isWin,
    eloChange,
    dimensionName,
    opponentEloAfter,
  } = params;

  try {
    // Build query with proper parameter indices
    let queryParams: any[] = [eloChange, playerId, opponentId, mapId, factionId];
    if (opponentEloAfter !== undefined) {
      queryParams.push(opponentEloAfter);
    }

    const updateSql = `UPDATE player_match_statistics
       SET total_games = total_games + 1,
           ${isWin ? 'wins = wins + 1' : 'losses = losses + 1'},
           winrate = ROUND(100.0 * ${isWin ? 'wins + 1' : 'wins'} / (total_games + 1), 2),
           avg_elo_change = ROUND((avg_elo_change * total_games + $1) / (total_games + 1), 2)
           ${opponentEloAfter !== undefined ? ', last_elo_against_me = $6' : ''}
       WHERE player_id = $2
         AND (opponent_id = $3 OR ($3 IS NULL AND opponent_id IS NULL))
         AND (map_id = $4 OR ($4 IS NULL AND map_id IS NULL))
         AND (faction_id = $5 OR ($5 IS NULL AND faction_id IS NULL))
         AND opponent_faction_id IS NULL`;

    const updateResult = await query(updateSql, queryParams);

    if (updateResult.rowCount! > 0) {
      console.log(
        `   ✓ [${dimensionName}] UPDATE: +1 game, ${isWin ? '+1 win' : '+1 loss'}, avg_elo_change updated (rows: ${updateResult.rowCount})`
      );
    } else {
      // INSERT if UPDATE didn't match
      const insertId = uuidv4();
      await query(
        `INSERT INTO player_match_statistics (
           id, player_id, opponent_id, map_id, faction_id, opponent_faction_id,
           total_games, wins, losses, winrate, avg_elo_change, 
           last_elo_against_me, last_match_date
         ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
        [
          insertId,
          playerId,
          opponentId,
          mapId,
          factionId,
          opponentFactionId,
          isWin ? 1 : 0,
          isWin ? 0 : 1,
          isWin ? 100.0 : 0.0,
          eloChange,
          opponentEloAfter || null,
        ]
      );
      console.log(
        `   ✓ [${dimensionName}] INSERT: new record created (${insertId}), ${isWin ? '1 win' : '1 loss'}`
      );
    }
  } catch (error) {
    console.error(`❌ [${dimensionName}] Error:`, error);
    throw error;
  }
}
