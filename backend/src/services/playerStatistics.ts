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
  loserEloChange: number,
  finalWinnerRating: number,
  finalLoserRating: number
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
      opponentEloAfter: finalLoserRating, // Store opponent's final ELO rating for H2H only
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
      opponentEloAfter: finalWinnerRating, // Store opponent's final ELO rating for H2H only
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
 * Uses explicit SQL statements for clarity and debugging
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
    // === EXPLICIT UPDATE STATEMENT ===
    let updateSql: string;
    let updateParams: any[];

    if (opponentEloAfter !== undefined && opponentId) {
      // H2H records: include last_elo_against_me
      updateSql = `UPDATE player_match_statistics
        SET total_games = total_games + 1,
            ${isWin ? 'wins = wins + 1' : 'losses = losses + 1'},
            winrate = ROUND(100.0 * ${isWin ? '(wins + 1)' : 'wins'} / (total_games + 1), 2),
            last_elo_against_me = $5
        WHERE player_id = $1
          AND opponent_id = $2
          AND map_id IS NULL
          AND faction_id IS NULL
          AND opponent_faction_id IS NULL`;
      updateParams = [playerId, opponentId, mapId, factionId, opponentEloAfter];
    } else if (mapId && !opponentId && !factionId) {
      // Per-Map records: no opponent, no faction
      updateSql = `UPDATE player_match_statistics
        SET total_games = total_games + 1,
            ${isWin ? 'wins = wins + 1' : 'losses = losses + 1'},
            winrate = ROUND(100.0 * ${isWin ? '(wins + 1)' : 'wins'} / (total_games + 1), 2)
        WHERE player_id = $1
          AND opponent_id IS NULL
          AND map_id = $3
          AND faction_id IS NULL
          AND opponent_faction_id IS NULL`;
      updateParams = [playerId, opponentId, mapId, factionId];
    } else if (factionId && !opponentId && !mapId) {
      // Per-Faction records: no opponent, no map
      updateSql = `UPDATE player_match_statistics
        SET total_games = total_games + 1,
            ${isWin ? 'wins = wins + 1' : 'losses = losses + 1'},
            winrate = ROUND(100.0 * ${isWin ? '(wins + 1)' : 'wins'} / (total_games + 1), 2)
        WHERE player_id = $1
          AND opponent_id IS NULL
          AND map_id IS NULL
          AND faction_id = $4
          AND opponent_faction_id IS NULL`;
      updateParams = [playerId, opponentId, mapId, factionId];
    } else {
      // Global records: no opponent, no map, no faction
      updateSql = `UPDATE player_match_statistics
        SET total_games = total_games + 1,
            ${isWin ? 'wins = wins + 1' : 'losses = losses + 1'},
            winrate = ROUND(100.0 * ${isWin ? '(wins + 1)' : 'wins'} / (total_games + 1), 2)
        WHERE player_id = $1
          AND opponent_id IS NULL
          AND map_id IS NULL
          AND faction_id IS NULL
          AND opponent_faction_id IS NULL`;
      updateParams = [playerId, opponentId, mapId, factionId];
    }

    console.log(`   [DEBUG] UPDATE SQL: ${updateSql}`);
    console.log(`   [DEBUG] Params: ${JSON.stringify(updateParams)}`);

    const updateResult = await query(updateSql, updateParams);

    if (updateResult.rowCount! > 0) {
      console.log(
        `   ✓ [${dimensionName}] UPDATE: +1 game, ${isWin ? '+1 win' : '+1 loss'} (rows: ${updateResult.rowCount})`
      );
      return;
    }

    // === EXPLICIT INSERT STATEMENT ===
    const insertId = uuidv4();
    let insertSql: string;
    let insertParams: any[];

    if (opponentEloAfter !== undefined && opponentId) {
      // H2H records: include last_elo_against_me
      insertSql = `INSERT INTO player_match_statistics (
        id, player_id, opponent_id, map_id, faction_id, opponent_faction_id,
        total_games, wins, losses, winrate, last_elo_against_me, last_match_date
      ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $10, CURRENT_TIMESTAMP)`;
      insertParams = [
        insertId,
        playerId,
        opponentId,
        mapId,
        factionId,
        opponentFactionId,
        isWin ? 1 : 0,
        isWin ? 0 : 1,
        isWin ? 100.0 : 0.0,
        opponentEloAfter,
      ];
    } else {
      // Global/Map/Faction records: no last_elo_against_me
      insertSql = `INSERT INTO player_match_statistics (
        id, player_id, opponent_id, map_id, faction_id, opponent_faction_id,
        total_games, wins, losses, winrate, last_match_date
      ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, $9, CURRENT_TIMESTAMP)`;
      insertParams = [
        insertId,
        playerId,
        opponentId,
        mapId,
        factionId,
        opponentFactionId,
        isWin ? 1 : 0,
        isWin ? 0 : 1,
        isWin ? 100.0 : 0.0,
      ];
    }

    console.log(`   [DEBUG] INSERT SQL: ${insertSql}`);
    console.log(`   [DEBUG] Params: ${JSON.stringify(insertParams)}`);

    await query(insertSql, insertParams);
    console.log(
      `   ✓ [${dimensionName}] INSERT: new record created, ${isWin ? '1 win' : '1 loss'}`
    );
  } catch (error) {
    console.error(`❌ [${dimensionName}] Error:`, error);
    throw error;
  }
}
