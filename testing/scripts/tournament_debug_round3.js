#!/usr/bin/env node
/**
 * Tournament test - Execute Rounds 1, 2 AND 3, then STOP
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


async function runTest() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TOURNAMENT TEST - ROUNDS 1, 2 & 3`);
  console.log(`${'='.repeat(80)}\n`);

  console.log('STEP 1: Run tournament lifecycle (will execute Rounds 1, 2, and 3)\n');
  
  await new Promise((resolve) => {
    const child = spawn('node', [
      path.join(__dirname, 'tournament_full_lifecycle.js')
    ], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        TOURNAMENT_NAME: 'Debug Test - Rounds 1 & 2 & 3',
        TOURNAMENT_TYPE: '4',
        TOURNAMENT_MODE: 'A',
        MAX_ROUNDS: '3'
      }
    });

    child.on('close', (code) => {
      console.log(`\nTournament script completed with exit code: ${code}\n`);
      resolve();
    });
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('STEP 2: Database state after Round 3');
  console.log(`${'='.repeat(80)}\n`);

  console.log(`📋 Run this SQL to examine Round 3 state:\n`);
  console.log(`psql -h localhost -U postgres -d wesnoth_tournament -c \\`);
  console.log(`"SELECT tp.id, u.nickname, tp.status, tp.tournament_points, tp.tournament_wins`);
  console.log(`FROM tournament_participants tp`);
  console.log(`LEFT JOIN users u ON tp.user_id = u.id`);
  console.log(`WHERE tp.tournament_id = (SELECT id FROM tournaments WHERE tournament_type='swiss_elimination' ORDER BY created_at DESC LIMIT 1)`);
  console.log(`ORDER BY tp.tournament_points DESC, tp.tournament_wins DESC;"\n`);
}

runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
