#!/usr/bin/env node
/**
 * Complete Swiss-Elimination Mix tournament test
 * Runs full tournament: Swiss phase + Elimination phase with match verification
 */

const http = require('http');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BASE_HOST = process.env.TEST_BASE_HOST || 'localhost';
const BASE_PORT = process.env.TEST_BASE_PORT || 3000;
const CREDENTIALS_PATH = path.join(__dirname, './test_credentials.csv');

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Credentials file not found: ${CREDENTIALS_PATH}`);
  }
  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const lines = content.trim().split('\n');
  
  const credLines = lines
    .filter(line => line && !line.startsWith('#') && !line.includes('nickname,password'))
    .map(line => {
      const [nickname, password] = line.split(',').map(s => s.trim());
      return { nickname, password };
    })
    .filter(cred => cred.nickname && cred.password);
  
  return credLines;
}

function httpRequest(method, pathname, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: { error: body } });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function checkPlayerStatus(tournamentId) {
  const pgClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '<password>',
    database: 'wesnoth_tournament'
  });

  try {
    await pgClient.connect();
    
    const result = await pgClient.query(
      `SELECT 
        tp.user_id, 
        tp.status,
        tp.tournament_points,
        tp.tournament_wins,
        u.nickname
       FROM tournament_participants tp
       LEFT JOIN users u ON tp.user_id = u.id
       WHERE tp.tournament_id = $1
       ORDER BY tp.tournament_points DESC, tp.tournament_wins DESC`,
      [tournamentId]
    );
    
    let activeCount = 0;
    let eliminatedCount = 0;
    
    result.rows.forEach((row) => {
      if (row.status === 'active') activeCount++;
      if (row.status === 'eliminated') eliminatedCount++;
    });
    
    await pgClient.end();
    return { rows: result.rows, activeCount, eliminatedCount };
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    try {
      await pgClient.end();
    } catch (e) {}
    return null;
  }
}

async function checkRoundMatches(tournamentId, roundNumber) {
  const pgClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '<password>',
    database: 'wesnoth_tournament'
  });

  try {
    await pgClient.connect();
    
    const result = await pgClient.query(
      `SELECT m.id, m.player1_id, m.player2_id, m.winner_id, r.round_type
       FROM tournament_matches m
       JOIN tournament_rounds r ON m.round_id = r.id
       WHERE r.tournament_id = $1 AND r.round_number = $2
       ORDER BY m.created_at`,
      [tournamentId, roundNumber]
    );
    
    await pgClient.end();
    return result.rows;
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    try {
      await pgClient.end();
    } catch (e) {}
    return null;
  }
}

async function runFullTest() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SWISS-ELIMINATION MIX: COMPLETE TOURNAMENT TEST`);
  console.log(`${'='.repeat(80)}\n`);

  // Step 1: Run full tournament
  console.log('STEP 1: Running complete tournament (Swiss + Elimination with auto-advancement)...\n');
  
  let tournamentId = null;
  
  await new Promise((resolve) => {
    const child = spawn('node', [
      path.join(__dirname, 'tournament_full_lifecycle.js')
    ], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        TOURNAMENT_NAME: 'Full Test - Swiss-Elimination Complete',
        TOURNAMENT_TYPE: '4',
        TOURNAMENT_MODE: 'A'
      }
    });

    child.on('close', async (code) => {
      console.log(`\nTournament completed with exit code: ${code}`);
      
      // Get tournament ID
      const pgClient = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: '<password>',
        database: 'wesnoth_tournament'
      });

      try {
        await pgClient.connect();
        const result = await pgClient.query(
          `SELECT id FROM tournaments 
           WHERE tournament_type = 'swiss_elimination' 
           ORDER BY created_at DESC 
           LIMIT 1`
        );
        
        if (result.rows.length > 0) {
          tournamentId = result.rows[0].id;
          console.log(`Tournament ID: ${tournamentId}`);
        }
        
        await pgClient.end();
      } catch (error) {
        console.error(`Error getting tournament ID: ${error.message}`);
      }
      
      resolve();
    });
  });

  if (!tournamentId) {
    console.error('ERROR: Could not get tournament ID');
    return;
  }

  // Step 2: Check final player status
  console.log(`\n${'='.repeat(80)}`);
  console.log('STEP 2: Final Player Status');
  console.log(`${'='.repeat(80)}\n`);
  
  let status = await checkPlayerStatus(tournamentId);
  if (!status) {
    console.error('ERROR: Could not check player status');
    return;
  }

  console.log('Final Rankings:');
  status.rows.forEach((row, index) => {
    const statusStr = row.status === 'active' ? 'ACTIVE ✓' : 'ELIMINATED ✗';
    console.log(`  ${index + 1}. ${row.nickname || row.user_id} - ${row.tournament_points} pts - ${statusStr}`);
  });
  
  console.log(`\nSummary: ${status.activeCount} ACTIVE, ${status.eliminatedCount} ELIMINATED`);

  // Step 3: Check match counts for each round
  console.log(`\n${'='.repeat(80)}`);
  console.log('STEP 3: Match Verification by Round');
  console.log(`${'='.repeat(80)}\n`);

  let expectedMatches = {
    1: { expected: 4, name: 'Swiss Round 1', type: 'general' },
    2: { expected: 4, name: 'Swiss Round 2', type: 'general' },
    3: { expected: 4, name: 'Swiss Round 3', type: 'general' },
    4: { expected: 2, name: 'Semifinals', type: 'final' },
    5: { expected: 1, name: 'Final', type: 'final' }
  };

  let allCorrect = true;
  
  for (let roundNum = 1; roundNum <= 5; roundNum++) {
    const expected = expectedMatches[roundNum];
    const matches = await checkRoundMatches(tournamentId, roundNum);
    
    if (!matches) {
      console.log(`Round ${roundNum} [${expected.name}]: ERROR - Could not fetch matches`);
      allCorrect = false;
      continue;
    }

    const matchCount = matches.length;
    const isCorrect = matchCount === expected.expected;
    const status_emoji = isCorrect ? '✅' : '❌';
    
    console.log(`Round ${roundNum} [${expected.name}]:`);
    console.log(`  Type: ${expected.type}`);
    console.log(`  Expected: ${expected.expected} matches`);
    console.log(`  Got: ${matchCount} matches ${status_emoji}`);
    
    if (!isCorrect) {
      allCorrect = false;
    }
  }

  // Final summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('FINAL RESULT');
  console.log(`${'='.repeat(80)}`);
  
  if (allCorrect && status.activeCount === 1 && status.eliminatedCount === 7) {
    console.log(`\n🎉 ✅ COMPLETE SUCCESS! 🎉`);
    console.log(`   ✓ Swiss phase: 4 matches per round (3 rounds)`);
    console.log(`   ✓ Semifinals: 2 matches (4→2)`);
    console.log(`   ✓ Final: 1 match (2→1)`);
    console.log(`   ✓ Tournament winner determined (1 active, 7 eliminated)\n`);
  } else {
    console.log(`\n⚠️ Issues found:`);
    if (!allCorrect) {
      console.log(`   - Match counts don't match expected values`);
    }
    if (status.activeCount !== 1 || status.eliminatedCount !== 7) {
      console.log(`   - Final player status incorrect (expected 1 active, 7 eliminated)`);
    }
    console.log();
  }
}

runFullTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
