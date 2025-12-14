#!/usr/bin/env node
/**
 * Tournament test - Execute ONLY Round 1 and STOP
 * This allows examining the database state after each round
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BASE_HOST = process.env.TEST_BASE_HOST || 'localhost';
const BASE_PORT = process.env.TEST_BASE_PORT || 3000;

function logAction(phase, level, details) {
  const timestamp = new Date().toISOString();
  const emoji = level === 'SUCCESS' ? '✅' : level === 'ERROR' ? '❌' : '📋';
  console.log(`[${emoji}] ${phase}${details ? ` - ${details}` : ''}`);
}

function logError(phase, error) {
  console.log(`[❌] ${phase} - ${error.message || error}`);
}

function makeRequest(method, pathname, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve(parsed);
        } catch (e) {
          resolve({ error: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function getRandomComment() {
  const comments = [
    'Great game! Very competitive match.',
    'Solid gameplay, enjoyed this match.',
    'Impressive tactical decisions.',
    'Amazing defense, good balance of units.',
    'Well deserved victory, gg.',
    'Strong opening, kept pressure on.',
    'Good micro management throughout.',
    'Nice tactics, well played opponent.',
    'Very interesting unit placement.',
    'Creative strategy, fun to play against.',
    'That was intense! Great use of units.',
    'Excellent performance from both sides.',
    'Well executed strategy, impressive moves.',
    'Good resource management.',
    'Great match, looking forward to rematch!',
  ];
  return comments[Math.floor(Math.random() * comments.length)];
}

async function runTest() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TOURNAMENT TEST - ROUND 1 ONLY`);
  console.log(`${'='.repeat(80)}\n`);

  console.log('STEP 1: Run tournament lifecycle (will execute until after Round 1 completes)\n');
  
  await new Promise((resolve) => {
    const child = spawn('node', [
      path.join(__dirname, 'tournament_full_lifecycle.js')
    ], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        TOURNAMENT_NAME: 'Debug Test - Round 1 Only',
        TOURNAMENT_TYPE: '4',
        TOURNAMENT_MODE: 'A',
        MAX_ROUNDS: '1'
      }
    });

    child.on('close', (code) => {
      console.log(`\nTournament script completed with exit code: ${code}\n`);
      resolve();
    });
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('STEP 2: Examine database state');
  console.log(`${'='.repeat(80)}\n`);

  console.log(`📋 Commands to run in psql to examine the database:\n`);
  console.log(`\\c wesnoth_tournament`);
  console.log(`\\dt tournament_* matches`);
  console.log(`SELECT * FROM tournaments ORDER BY created_at DESC LIMIT 1;`);
  console.log(`SELECT * FROM tournament_rounds ORDER BY created_at DESC LIMIT 5;`);
  console.log(`SELECT round_number, COUNT(*) as match_count FROM tournament_round_matches GROUP BY round_number;`);
  console.log(`SELECT id, tournament_id, round_id, player1_id, player2_id, match_status FROM tournament_matches LIMIT 20;`);
  console.log(`SELECT id, status, tournament_points, tournament_wins FROM tournament_participants;`);
  console.log(`SELECT 'CHECK_COMPLETE_ROUND' as log_marker;`);
  console.log(`SELECT 'SELECT_PLAYERS' as log_marker;`);
  console.log(`\n`);
}

runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
