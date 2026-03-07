#!/usr/bin/env node

import { Client } from 'pg';

const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'wesnoth_tournament',
  user: 'postgres',
  password: 'postgres',
};

async function checkTournamentData(tournamentId) {
  const client = new Client(DB_CONFIG);
  await client.connect();

  try {
    console.log('\n📊 CHECKING TOURNAMENT DATA FOR:', tournamentId);
    console.log('='.repeat(80));

    // Get tournament basic info
    const tournamentRes = await client.query(
      'SELECT id, name, status FROM tournaments WHERE id = $1',
      [tournamentId]
    );

    if (tournamentRes.rows.length === 0) {
      console.log('❌ Tournament not found');
      process.exit(1);
    }

    const tournament = tournamentRes.rows[0];
    console.log(`\n✓ Tournament: ${tournament.name} (${tournament.id})`);
    console.log(`  Status: ${tournament.status}`);

    // Get tournament rounds
    const roundsRes = await client.query(
      `SELECT id, tournament_id, round_number, round_status, round_start_date, round_end_date 
       FROM tournament_rounds 
       WHERE tournament_id = $1 
       ORDER BY round_number`,
      [tournamentId]
    );

    console.log(`\n📋 TOURNAMENT ROUNDS (${roundsRes.rows.length}):`);
    console.log('─'.repeat(80));
    roundsRes.rows.forEach((round) => {
      const endDate = round.round_end_date ? new Date(round.round_end_date).toISOString() : 'N/A';
      console.log(`  Round #${round.round_number}:`);
      console.log(`    - Status: ${round.round_status}`);
      console.log(`    - Start: ${round.round_start_date ? new Date(round.round_start_date).toISOString() : 'N/A'}`);
      console.log(`    - End: ${endDate} ${round.round_end_date ? '✓' : '✗'}`);
    });

    // Get tournament participants with stats
    const participantsRes = await client.query(
      `SELECT user_id, tournament_wins, tournament_losses, tournament_points, tournament_ranking
       FROM tournament_participants 
       WHERE tournament_id = $1
       ORDER BY tournament_ranking NULLS LAST`,
      [tournamentId]
    );

    console.log(`\n👥 TOURNAMENT PARTICIPANTS (${participantsRes.rows.length}):`);
    console.log('─'.repeat(80));
    participantsRes.rows.forEach((p, idx) => {
      console.log(`  ${idx + 1}. User ${p.user_id.substring(0, 8)}...`);
      console.log(`     - Wins: ${p.tournament_wins || 0}, Losses: ${p.tournament_losses || 0}, Points: ${p.tournament_points || 0}`);
      console.log(`     - Ranking: ${p.tournament_ranking || 'N/A'}`);
    });

    // Get tournament round matches
    const matchesRes = await client.query(
      `SELECT trm.id, trm.round_id, trm.player1_id, trm.player2_id, trm.winner_id
       FROM tournament_round_matches trm
       WHERE trm.round_id IN (SELECT id FROM tournament_rounds WHERE tournament_id = $1)
       ORDER BY trm.round_id, trm.id`,
      [tournamentId]
    );

    console.log(`\n⚔️  TOURNAMENT ROUND MATCHES (${matchesRes.rows.length}):`);
    console.log('─'.repeat(80));
    let currentRoundId = null;
    matchesRes.rows.forEach((match) => {
      if (match.round_id !== currentRoundId) {
        currentRoundId = match.round_id;
        const roundNum = roundsRes.rows.find(r => r.id === match.round_id)?.round_number;
        console.log(`  Round ${roundNum}:`);
      }
      const winner = match.winner_id ? match.winner_id.substring(0, 8) + '...' : 'PENDING';
      console.log(`    - ${match.player1_id.substring(0, 8)}... vs ${match.player2_id.substring(0, 8)}... → Winner: ${winner}`);
    });

    console.log('\n' + '='.repeat(80));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Get tournament ID from args or use last one
const args = process.argv.slice(2);
let tournamentId = args[0];

if (!tournamentId) {
  // Find the most recent tournament
  const client = new Client(DB_CONFIG);
  await client.connect();
  const res = await client.query(
    `SELECT id FROM tournaments WHERE name LIKE 'Auto Tournament%' ORDER BY created_at DESC LIMIT 1`
  );
  await client.end();

  if (res.rows.length === 0) {
    console.error('No tournaments found');
    process.exit(1);
  }

  tournamentId = res.rows[0].id;
  console.log('Using latest tournament:', tournamentId);
}

await checkTournamentData(tournamentId);
