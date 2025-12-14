#!/usr/bin/env node
/**
 * Debug Round 4 match generation
 */

const { Client } = require('pg');

async function debug() {
  const pgClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'wesnoth_tournament'
  });

  try {
    await pgClient.connect();
    
    console.log('\n' + '='.repeat(80));
    console.log('DEBUGGING SWISS-ELIMINATION MIX TOURNAMENT');
    console.log('='.repeat(80) + '\n');
    
    // Get the latest Swiss-Elimination tournament
    const tournResult = await pgClient.query(
      `SELECT id, tournament_type, general_rounds, final_rounds FROM tournaments 
       WHERE tournament_type = 'swiss_elimination' 
       ORDER BY created_at DESC 
       LIMIT 1`
    );
    
    if (tournResult.rows.length === 0) {
      console.log('No Swiss-Elimination tournament found');
      return;
    }
    
    const tournament = tournResult.rows[0];
    console.log(`Tournament: ${tournament.id}`);
    console.log(`  Type: ${tournament.tournament_type}`);
    console.log(`  General Rounds: ${tournament.general_rounds}`);
    console.log(`  Final Rounds: ${tournament.final_rounds}\n`);
    
    // Check Round 4 details
    const round4Result = await pgClient.query(
      `SELECT * FROM tournament_rounds 
       WHERE tournament_id = $1 AND round_number = 4`,
      [tournament.id]
    );
    
    if (round4Result.rows.length === 0) {
      console.log('Round 4 not found');
      return;
    }
    
    const round4 = round4Result.rows[0];
    console.log(`Round 4:`);
    console.log(`  ID: ${round4.id}`);
    console.log(`  Type: ${round4.round_type}`);
    console.log(`  Status: ${round4.round_status}\n`);
    
    // Check tournament_round_matches for Round 4
    const trm4Result = await pgClient.query(
      `SELECT id, player1_id, player2_id, best_of, wins_required FROM tournament_round_matches 
       WHERE round_id = $1`,
      [round4.id]
    );
    
    console.log(`Tournament Round Matches (Round 4): ${trm4Result.rows.length}`);
    trm4Result.rows.forEach((trm, i) => {
      console.log(`  ${i+1}. TRM ${trm.id}`);
      console.log(`     Players: ${trm.player1_id} vs ${trm.player2_id}`);
      console.log(`     Best Of: ${trm.best_of}, Wins Required: ${trm.wins_required}`);
    });
    
    // Check tournament_matches for Round 4
    const tm4Result = await pgClient.query(
      `SELECT id, player1_id, player2_id, match_status FROM tournament_matches 
       WHERE round_id = $1`,
      [round4.id]
    );
    
    console.log(`\nTournament Matches (Round 4): ${tm4Result.rows.length}`);
    tm4Result.rows.forEach((tm, i) => {
      console.log(`  ${i+1}. Match ${tm.id}`);
      console.log(`     Players: ${tm.player1_id} vs ${tm.player2_id}`);
      console.log(`     Status: ${tm.match_status}`);
    });
    
    // Check which players are active/eliminated
    const playersResult = await pgClient.query(
      `SELECT u.nickname, tp.status, tp.tournament_points, tp.tournament_wins
       FROM tournament_participants tp
       LEFT JOIN users u ON tp.user_id = u.id
       WHERE tp.tournament_id = $1
       ORDER BY tp.tournament_points DESC, tp.tournament_wins DESC`,
      [tournament.id]
    );
    
    console.log(`\nPlayer Status:`);
    playersResult.rows.forEach((p, i) => {
      const status = p.status === 'active' ? 'ACTIVE ✓' : 'ELIMINATED ✗';
      console.log(`  ${i+1}. ${p.nickname} - ${p.tournament_points} pts - ${status}`);
    });
    
    await pgClient.end();
    
  } catch (error) {
    console.error('ERROR:', error.message);
    try {
      await pgClient.end();
    } catch (e) {}
  }
}

debug();
