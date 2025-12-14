#!/usr/bin/env node
/**
 * Debug Swiss-Elimination Mix - Swiss rounds only
 * Executes only the Swiss phase (3 rounds) and pauses before elimination
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Client } = require('pg');

const BASE_HOST = process.env.TEST_BASE_HOST || 'localhost';
const BASE_PORT = process.env.TEST_BASE_PORT || 3000;
const BASE_URL = `http://${BASE_HOST}:${BASE_PORT}`;

const RESULTS_DIR = path.join(__dirname, '..', 'results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

const timestampNow = () => {
  const d = new Date();
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${YYYY}${MM}${DD}_${hh}${mm}${ss}`;
};

const debugLogFile = path.join(RESULTS_DIR, `debug_swiss_only_${timestampNow()}.log`);

function appendDebugLog(line) {
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(debugLogFile, `[${timestamp}] ${line}\n`);
    console.log(`[${timestamp}] ${line}`);
  } catch (err) {
    console.error(`Failed to write debug log:`, err.message);
  }
}

async function checkPlayerStatus(tournamentId) {
  const pgClient = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'wesnoth_tournament'
  });

  try {
    await pgClient.connect();
    
    appendDebugLog('\n' + '='.repeat(80));
    appendDebugLog('AFTER SWISS ROUNDS - PLAYER STATUS CHECK');
    appendDebugLog('='.repeat(80));
    
    // Get all participants with their status
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
    
    appendDebugLog(`\nTotal Participants: ${result.rows.length}`);
    appendDebugLog(`\nPlayer Rankings (after 3 Swiss rounds):`);
    appendDebugLog('-'.repeat(80));
    
    let activeCount = 0;
    let eliminatedCount = 0;
    
    result.rows.forEach((row, index) => {
      const status = row.status === 'active' ? 'ACTIVE ✓' : 'ELIMINATED ✗';
      if (row.status === 'active') activeCount++;
      if (row.status === 'eliminated') eliminatedCount++;
      
      appendDebugLog(`${index + 1}. ${row.nickname || row.user_id} - Points: ${row.tournament_points}, Wins: ${row.tournament_wins} - ${status}`);
    });
    
    appendDebugLog('-'.repeat(80));
    appendDebugLog(`\nSummary:`);
    appendDebugLog(`  Active Players: ${activeCount}`);
    appendDebugLog(`  Eliminated Players: ${eliminatedCount}`);
    appendDebugLog(`  ALL should be ACTIVE (8) at this point - Elimination phase hasn't started yet!`);
    
    if (activeCount === 8 && eliminatedCount === 0) {
      appendDebugLog(`✅ CORRECT: All 8 players are still active after Swiss rounds`);
    } else {
      appendDebugLog(`❌ ERROR: After Swiss rounds, all 8 should be active but found ${activeCount} active, ${eliminatedCount} eliminated`);
    }
    
    // Get tournament status
    const tourResult = await pgClient.query(
      `SELECT status, general_rounds, final_rounds FROM tournaments WHERE id = $1`,
      [tournamentId]
    );
    
    if (tourResult.rows.length > 0) {
      const tour = tourResult.rows[0];
      appendDebugLog(`\nTournament Status: ${tour.status}`);
      appendDebugLog(`General Rounds (Swiss): ${tour.general_rounds}`);
      appendDebugLog(`Final Rounds (Elimination): ${tour.final_rounds}`);
    }
    
    // Get round status
    const roundsResult = await pgClient.query(
      `SELECT round_number, round_type, round_status FROM tournament_rounds 
       WHERE tournament_id = $1 
       ORDER BY round_number`,
      [tournamentId]
    );
    
    appendDebugLog(`\nRound Status:`);
    roundsResult.rows.forEach(row => {
      appendDebugLog(`  Round ${row.round_number}: Type='${row.round_type}', Status='${row.round_status}'`);
    });
    
    await pgClient.end();
    return activeCount === 8 && eliminatedCount === 0;
    
  } catch (error) {
    appendDebugLog(`ERROR checking player status: ${error.message}`);
    try {
      await pgClient.end();
    } catch (e) {}
    return false;
  }
}

async function makeHttpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runSwissPhaseOnly() {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`DEBUG: Swiss-Elimination Mix - Swiss Phase Only`);
    console.log(`${'='.repeat(80)}\n`);
    
    appendDebugLog('Starting Swiss-Elimination Mix tournament - Swiss phase only');
    
    // Run the full lifecycle but we'll manually control stopping after Swiss
    const child = spawn('node', [
      path.join(__dirname, 'tournament_full_lifecycle.js')
    ], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        TOURNAMENT_NAME: 'Debug Swiss-Only Test',
        TOURNAMENT_TYPE: '4',
        TOURNAMENT_MODE: 'A',
        MAX_ROUNDS: '3'
      }
    });

    child.on('close', async (code) => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Tournament test completed with exit code: ${code}`);
      console.log(`${'='.repeat(80)}\n`);
      
      appendDebugLog(`\nTournament test completed with exit code: ${code}`);
      
      // Wait a moment for database to settle
      await new Promise(r => setTimeout(r, 2000));
      
      // Get the latest Swiss-Elimination tournament ID and check status
      const pgClient = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
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
        
        await pgClient.end();

        if (result.rows.length > 0) {
          const tournamentId = result.rows[0].id;
          appendDebugLog(`\nLatest Swiss-Elimination tournament ID: ${tournamentId}`);
          appendDebugLog(`\n⏸️  PAUSED - Check the status above before proceeding to elimination rounds`);
          appendDebugLog(`\nTo check database directly:`);
          appendDebugLog(`  SELECT * FROM tournament_participants WHERE tournament_id = '${tournamentId}' ORDER BY tournament_points DESC;`);
          
          // Check player status with fresh connection
          const statusOk = await checkPlayerStatus(tournamentId);
          
          console.log(`\n✓ Debug complete! Check log file: ${debugLogFile}\n`);
          appendDebugLog(`\n✓ Swiss phase debug analysis complete!`);
        } else {
          appendDebugLog('ERROR: No Swiss-Elimination tournament found in database');
        }
      } catch (error) {
        appendDebugLog(`ERROR getting tournament ID: ${error.message}`);
        try {
          await pgClient.end();
        } catch (e) {}
      }
      
      resolve(code);
    });

    child.on('error', (err) => {
      console.error(`Error running tournament:`, err.message);
      appendDebugLog(`ERROR running tournament: ${err.message}`);
      resolve(1);
    });
  });
}

// Run
runSwissPhaseOnly().catch(err => {
  console.error('Fatal error:', err);
  appendDebugLog(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
