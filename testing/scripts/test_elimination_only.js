#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

async function runElimination() {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`TESTING: Elimination Tournament (Type 1)`);
    console.log(`${'='.repeat(80)}\n`);

    const child = spawn('node', [
      path.join(__dirname, 'tournament_full_lifecycle.js')
    ], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        TOURNAMENT_NAME: `Test Elimination Tournament`,
        TOURNAMENT_TYPE: '1',
        TOURNAMENT_MODE: 'A'
      }
    });

    child.on('close', (code) => {
      console.log(`\n✓ Elimination tournament completed with exit code: ${code}\n`);
      resolve(code);
    });

    child.on('error', (err) => {
      console.error(`✗ Error running Elimination tournament:`, err.message);
      resolve(1);
    });
  });
}

runElimination().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
