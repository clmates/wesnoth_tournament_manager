#!/usr/bin/env node
/**
 * Debug Swiss-Elimination Mix tournament
 * Checks player status after Swiss rounds and before Elimination rounds
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

const debugLogFile = path.join(RESULTS_DIR, `debug_swiss_elimination_${timestampNow()}.log`);

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
    appendDebugLog('PLAYER STATUS CHECK');
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
    appendDebugLog(`\nPlayer Rankings:`);
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
    appendDebugLog(`  Expected Active (for 2 elimination rounds): 4`);
    
    if (activeCount === 4) {
      appendDebugLog(`✅ CORRECT: Exactly 4 players are active for elimination phase`);
    } else {
      appendDebugLog(`❌ ERROR: Expected 4 active players, but found ${activeCount}`);
    }
    
    await pgClient.end();
    return activeCount === 4;
    
  } catch (error) {
    appendDebugLog(`ERROR checking player status: ${error.message}`);
    try {
      await pgClient.end();
    } catch (e) {}
    return false;
  }
}

async function runTournamentAndCheck() {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`DEBUG: Swiss-Elimination Mix Tournament Test`);
    console.log(`${'='.repeat(80)}\n`);
    
    appendDebugLog('Starting Swiss-Elimination Mix tournament test with DB checks');
    
    const child = spawn('node', [
      path.join(__dirname, 'tournament_full_lifecycle.js')
    ], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        TOURNAMENT_NAME: 'Debug Swiss-Elimination Mix Test',
        TOURNAMENT_TYPE: '4',
        TOURNAMENT_MODE: 'A'
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
          
          // Check player status with fresh connection
          const statusOk = await checkPlayerStatus(tournamentId);
          
          console.log(`\n✓ Debug complete! Check log file: ${debugLogFile}\n`);
          appendDebugLog(`\n✓ Debug analysis complete!`);
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
runTournamentAndCheck().catch(err => {
  console.error('Fatal error:', err);
  appendDebugLog(`FATAL ERROR: ${err.message}`);
  process.exit(1);
});
