#!/usr/bin/env node
/**
 * Complete test: Swiss + Manual Elimination phase transition
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
  
  // Filter out comments and empty lines, then skip header
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
    
    console.log('\nPlayer Status:');
    result.rows.forEach((row, index) => {
      const status = row.status === 'active' ? 'ACTIVE ✓' : 'ELIMINATED ✗';
      if (row.status === 'active') activeCount++;
      if (row.status === 'eliminated') eliminatedCount++;
      console.log(`  ${index + 1}. ${row.nickname || row.user_id} - ${row.tournament_points} pts - ${status}`);
    });
    
    console.log(`\nSummary: ${activeCount} ACTIVE, ${eliminatedCount} ELIMINATED`);
    
    await pgClient.end();
    return { activeCount, eliminatedCount };
    
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
  console.log(`SWISS-ELIMINATION MIX: COMPLETE TEST`);
  console.log(`${'='.repeat(80)}\n`);

  // Step 1: Run Swiss-only tournament
  console.log('STEP 1: Running Swiss phase (Rounds 1-3)...\n');
  
  let tournamentId = null;
  
  await new Promise((resolve) => {
    const child = spawn('node', [
      path.join(__dirname, 'tournament_full_lifecycle.js')
    ], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        TOURNAMENT_NAME: 'Full Test - Swiss + Elimination',
        TOURNAMENT_TYPE: '4',
        TOURNAMENT_MODE: 'A',
        MAX_ROUNDS: '3'
      }
    });

    child.on('close', async (code) => {
      console.log(`\nSwiss phase completed with exit code: ${code}`);
      
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
          console.log(`\nTournament ID: ${tournamentId}`);
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

  // Step 2: Check status after Swiss
  console.log(`\n${'='.repeat(80)}`);
  console.log('STEP 2: Status after Swiss Rounds');
  console.log(`${'='.repeat(80)}`);
  
  let status = await checkPlayerStatus(tournamentId);
  if (!status || status.activeCount !== 8 || status.eliminatedCount !== 0) {
    console.error(`\n❌ ERROR: Expected 8 active, 0 eliminated after Swiss`);
    return;
  }
  console.log(`✅ Correct: All 8 players still active`);

  // Step 3: Get tournament details (need admin token for next-round)
  console.log(`\n${'='.repeat(80)}`);
  console.log('STEP 3: Activating Round 4 (Semifinals)');
  console.log(`${'='.repeat(80)}\n`);
  
  // Load credentials and login
  let credentials;
  try {
    credentials = loadCredentials();
    console.log(`Loaded ${credentials.length} credential sets`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return;
  }

  if (credentials.length === 0) {
    console.error('ERROR: No credentials available');
    return;
  }

  const adminCreds = credentials[0];
  
  try {
    console.log(`DEBUG: First credential loaded:`);
    console.log(`  nickname: '${adminCreds.nickname}'`);
    console.log(`  password: '${adminCreds.password}'`);
    
    console.log(`Logging in as: ${adminCreds.nickname}`);
    let res = await httpRequest(
      'POST',
      '/api/auth/login',
      { nickname: adminCreds.nickname, password: adminCreds.password }
    );
    
    if (res.status !== 200) {
      console.error(`ERROR: Login failed with status ${res.status}: ${JSON.stringify(res.body)}`);
      return;
    }
    
    const adminToken = res.body.token;
    console.log(`✅ Admin logged in`);
    
    // Activate Round 4
    console.log('Calling next-round endpoint...\n');
    const nextRoundResponse = await httpRequest(
      'POST',
      `/api/tournaments/${tournamentId}/next-round`,
      {},
      { 'Authorization': `Bearer ${adminToken}` }
    );
    
    console.log(`Next round response: ${JSON.stringify(nextRoundResponse, null, 2)}`);
    
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return;
  }

  // Step 4: Check status after Round 4 activation
  await new Promise(r => setTimeout(r, 1000));
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('STEP 4: Status after Round 4 activation');
  console.log(`${'='.repeat(80)}`);
  
  status = await checkPlayerStatus(tournamentId);
  if (!status) {
    console.error('ERROR: Could not check player status');
    return;
  }
  
  if (status.activeCount === 4 && status.eliminatedCount === 4) {
    console.log(`\n✅ CORRECT: selectPlayersForEliminationPhase() executed!`);
    console.log(`   - 4 players advanced to elimination phase`);
    console.log(`   - 4 players eliminated after Swiss rounds`);
  } else {
    console.log(`\n❌ ERROR: Expected 4 active, 4 eliminated`);
    console.log(`   - Got ${status.activeCount} active, ${status.eliminatedCount} eliminated`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('TEST COMPLETE');
  console.log(`${'='.repeat(80)}\n`);
}

runFullTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
