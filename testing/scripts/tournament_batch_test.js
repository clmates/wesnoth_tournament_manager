#!/usr/bin/env node
/**
 * Enhanced Tournament Batch Testing Script
 * Creates distinct tournaments for each type with sequential numbering
 * Runs each tournament to completion with clear identification
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_HOST = process.env.TEST_BASE_HOST || 'localhost';
const BASE_PORT = process.env.TEST_BASE_PORT || 3000;
const BASE_URL = `http://${BASE_HOST}:${BASE_PORT}`;

const CREDENTIALS_PATH = path.join(__dirname, './test_credentials.csv');

// =====================
// HTTP Utilities
// =====================

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

// =====================
// Test Data
// =====================

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Credentials file not found: ${CREDENTIALS_PATH}`);
  }
  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line && !line.startsWith('#'));
  return lines.map(line => {
    const [nickname, password] = line.split(',').map(s => s.trim());
    return { nickname, password };
  });
}

// =====================
// Test Execution
// =====================

const TOURNAMENT_CONFIGS = [
  {
    type: 'elimination',
    typeName: 'Elimination',
    config: {
      name: 'Elimination Tournament 001',
      description: 'Pure elimination bracket - 8 players, 3 rounds (Quarters/Semis/Final)',
      tournament_type: 'elimination',
      general_rounds: 0,
      final_rounds: 3
    },
    players: 8
  },
  {
    type: 'league',
    typeName: 'League',
    config: {
      name: 'League Tournament 001',
      description: 'League format - 6 players, 2 rounds (ida y vuelta)',
      tournament_type: 'league',
      general_rounds: 2,
      final_rounds: 0
    },
    players: 6
  },
  {
    type: 'swiss',
    typeName: 'Swiss',
    config: {
      name: 'Swiss Tournament 001',
      description: 'Swiss system - 8 players, 3 rounds',
      tournament_type: 'swiss',
      general_rounds: 3,
      final_rounds: 0
    },
    players: 8
  },
  {
    type: 'swiss_elimination',
    typeName: 'Swiss-Elimination Mix',
    config: {
      name: 'Swiss-Elimination Mix Tournament 001',
      description: 'Swiss phase (2 rounds) then Elimination (3 rounds)',
      tournament_type: 'swiss_elimination',
      general_rounds: 2,
      final_rounds: 3
    },
    players: 8
  }
];

async function runTournamentTest(config, credentials) {
  const adminCreds = credentials[0];
  const testUsers = credentials.slice(1, config.players + 1);

  console.log(`\n${'='.repeat(90)}`);
  console.log(`🏆 TOURNAMENT TEST: ${config.config.name}`);
  console.log(`   Type: ${config.typeName}`);
  console.log(`   Players: ${config.players}`);
  console.log(`   Config: ${config.config.general_rounds} general + ${config.config.final_rounds} final rounds`);
  console.log(`${'='.repeat(90)}`);

  let adminToken, tournamentId, participantIds = [];

  try {
    // Step 1: Login admin
    console.log('\n[1/7] Logging in as admin...');
    let res = await httpRequest('POST', '/api/auth/login', {
      nickname: adminCreds.nickname,
      password: adminCreds.password
    });
    if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
    adminToken = res.body.token;
    console.log(`     ✓ Admin logged in`);

    // Step 2: Create tournament
    console.log('\n[2/7] Creating tournament...');
    res = await httpRequest('POST', '/api/tournaments', config.config, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (res.status !== 201) throw new Error(`Tournament creation failed: ${JSON.stringify(res.body)}`);
    tournamentId = res.body.id;
    console.log(`     ✓ Tournament created: ${tournamentId}`);

    // Step 3: Enroll players
    console.log('\n[3/7] Enrolling players...');
    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const loginRes = await httpRequest('POST', '/api/auth/login', {
        nickname: user.nickname,
        password: user.password
      });
      if (loginRes.status !== 200) throw new Error(`Login failed for ${user.nickname}`);
      
      const token = loginRes.body.token;
      const joinRes = await httpRequest('POST', `/api/tournaments/${tournamentId}/join`, {}, {
        'Authorization': `Bearer ${token}`
      });
      if (joinRes.status !== 201) throw new Error(`Join failed for ${user.nickname}`);
      participantIds.push(joinRes.body.id);
      console.log(`     ✓ ${user.nickname} enrolled`);
    }

    // Step 4: Close registration
    console.log('\n[4/7] Closing registration...');
    res = await httpRequest('POST', `/api/tournaments/${tournamentId}/close-registration`, {}, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (res.status !== 200) throw new Error(`Close registration failed: ${JSON.stringify(res.body)}`);
    console.log(`     ✓ Registration closed`);

    // Step 5: Prepare tournament
    console.log('\n[5/7] Preparing tournament...');
    res = await httpRequest('POST', `/api/tournaments/${tournamentId}/prepare`, {}, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (res.status !== 200) throw new Error(`Prepare failed: ${JSON.stringify(res.body)}`);
    console.log(`     ✓ Tournament prepared`);

    // Step 6: Start tournament
    console.log('\n[6/7] Starting tournament...');
    res = await httpRequest('POST', `/api/tournaments/${tournamentId}/start`, {}, {
      'Authorization': `Bearer ${adminToken}`
    });
    if (res.status !== 200) throw new Error(`Start failed: ${JSON.stringify(res.body)}`);
    console.log(`     ✓ Tournament started`);

    // Step 7: Play all rounds
    console.log('\n[7/7] Playing all rounds...');
    let roundNum = 1;
    let maxRounds = config.config.general_rounds + config.config.final_rounds;
    let tournamentFinished = false;

    while (roundNum <= maxRounds && !tournamentFinished) {
      // Get tournament status
      const statusRes = await httpRequest('GET', `/api/tournaments/${tournamentId}`);
      if (statusRes.body.status === 'finished') {
        console.log(`     ✓ Tournament finished after round ${roundNum - 1}`);
        tournamentFinished = true;
        break;
      }

      // Get rounds
      const roundsRes = await httpRequest('GET', `/api/tournaments/${tournamentId}/rounds`);
      const currentRound = roundsRes.body.find(r => r.round_number === roundNum);
      
      if (!currentRound) {
        console.log(`     ✓ No more rounds to play`);
        break;
      }

      const roundType = currentRound.round_type || 'GENERAL';
      let roundLabel = `Round ${roundNum}`;
      
      if (config.typeName === 'Elimination' || (config.typeName === 'Swiss-Elimination Mix' && roundNum > config.config.general_rounds)) {
        const remaining = config.players / Math.pow(2, roundNum - (config.typeName === 'Swiss-Elimination Mix' ? config.config.general_rounds : 0));
        const nextRemaining = remaining / 2;
        roundLabel += ` [${roundType} (${Math.round(remaining)}→${Math.round(nextRemaining)})]`;
      } else {
        roundLabel += ` [${roundType}]`;
      }

      console.log(`\n     Round ${roundNum}: Getting matches for ${roundLabel}...`);

      // Get matches for this round
      const matchesRes = await httpRequest('GET', `/api/tournaments/${tournamentId}/rounds/${currentRound.id}/matches`);
      const matches = matchesRes.body || [];

      console.log(`     Found ${matches.length} matches`);

      // Report all matches
      for (const match of matches) {
        // Determine winner randomly
        const winnerId = Math.random() > 0.5 ? match.player1_id : match.player2_id;
        const winnerNickname = testUsers.find(u => u.nickname === winnerId)?.nickname || winnerId;
        
        const reportRes = await httpRequest('POST', `/api/tournaments/${tournamentId}/matches/${match.id}/report`, {
          winner_id: winnerId,
          match_comment: `Match completed in ${roundLabel}`
        }, {
          'Authorization': `Bearer ${adminToken}`
        });

        if (reportRes.status !== 200) {
          console.log(`     ✗ Failed to report match ${match.id}: ${JSON.stringify(reportRes.body)}`);
        } else {
          console.log(`     ✓ Match reported - Winner: ${winnerNickname}`);
        }
      }

      // Advance round
      const advanceRes = await httpRequest('POST', `/api/tournaments/${tournamentId}/rounds/${currentRound.id}/advance`, {}, {
        'Authorization': `Bearer ${adminToken}`
      });

      if (advanceRes.status === 200) {
        console.log(`     ✓ Advancing to next round...`);
      } else if (advanceRes.body.message && advanceRes.body.message.includes('finished')) {
        console.log(`     ✓ Tournament completed!`);
        tournamentFinished = true;
      } else {
        console.log(`     ⚠ Could not advance round: ${JSON.stringify(advanceRes.body)}`);
      }

      roundNum++;
    }

    // Final status
    const finalRes = await httpRequest('GET', `/api/tournaments/${tournamentId}`);
    console.log(`\n     📊 Final Status: ${finalRes.body.status.toUpperCase()}`);

    console.log(`\n✅ ${config.config.name} - COMPLETED SUCCESSFULLY\n`);
    return true;

  } catch (error) {
    console.error(`\n❌ ${config.config.name} - FAILED`);
    console.error(`   Error: ${error.message}\n`);
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                  TOURNAMENT BATCH TEST - ALL TYPES TO COMPLETION                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════╝');

  const credentials = loadCredentials();
  const results = {};

  for (const config of TOURNAMENT_CONFIGS) {
    const success = await runTournamentTest(config, credentials);
    results[config.config.name] = success ? '✅ PASS' : '❌ FAIL';
    await new Promise(r => setTimeout(r, 1000)); // Delay between tournaments
  }

  console.log('\n╔════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              FINAL SUMMARY                                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════╝\n');

  for (const [name, result] of Object.entries(results)) {
    console.log(`  ${result}  ${name}`);
  }

  const allPassed = Object.values(results).every(r => r.includes('PASS'));
  console.log(`\n  ${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
