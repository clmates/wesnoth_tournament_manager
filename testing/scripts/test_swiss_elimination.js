#!/usr/bin/env node
/**
 * Test Swiss-Elimination Mix tournament only
 * Based on tournament_full_lifecycle.js
 */

const { spawn } = require('child_process');
const path = require('path');

async function runSwissElimination() {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`RUNNING: Swiss-Elimination Mix Tournament Test`);
    console.log(`${'='.repeat(80)}\n`);

    const child = spawn('node', [
      path.join(__dirname, 'tournament_full_lifecycle.js')
    ], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        TOURNAMENT_NAME: 'Swiss-Elimination Mix Test',
        TOURNAMENT_TYPE: '4',
        TOURNAMENT_MODE: 'A'
      }
    });

    child.on('close', (code) => {
      console.log(`\n✓ Swiss-Elimination Mix tournament test completed with exit code: ${code}\n`);
      resolve(code);
    });

    child.on('error', (err) => {
      console.error(`✗ Error running Swiss-Elimination Mix tournament:`, err.message);
      resolve(1);
    });
  });
}

runSwissElimination().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
