#!/usr/bin/env node
/**
 * Run all tournament types automatically
 * Executes each tournament type with automatic mode
 */

const { spawn } = require('child_process');
const path = require('path');

const TOURNAMENT_TYPES = [
  { number: '1', name: 'Elimination', correlative: 1 },
  { number: '2', name: 'League', correlative: 2 },
  { number: '3', name: 'Swiss', correlative: 3 },
  { number: '4', name: 'Swiss-Elimination Mix', correlative: 4 }
];

async function runTournament(type) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`RUNNING: Test ${type.correlative} - ${type.name} Tournament (Type ${type.number})`);
    console.log(`${'='.repeat(80)}\n`);

    const child = spawn('node', [
      path.join(__dirname, 'tournament_full_lifecycle.js')
    ], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit',
      env: {
        ...process.env,
        TOURNAMENT_NAME: `Test ${type.correlative} - ${type.name}`,
        TOURNAMENT_TYPE: type.number,
        TOURNAMENT_MODE: 'A'
      }
    });

    child.on('close', (code) => {
      console.log(`\n✓ Test ${type.correlative} - ${type.name} tournament completed with exit code: ${code}\n`);
      resolve(code);
    });

    child.on('error', (err) => {
      console.error(`✗ Error running Test ${type.correlative} - ${type.name} tournament:`, err.message);
      resolve(1);
    });
  });
}

async function runAll() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    TOURNAMENT BATCH TEST - ALL TYPES                           ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');

  const results = {};
  
  for (const type of TOURNAMENT_TYPES) {
    const exitCode = await runTournament(type);
    results[`Test ${type.correlative} - ${type.name}`] = exitCode === 0 ? '✓ PASS' : '✗ FAIL';
    
    // Small delay between tournaments
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                          BATCH TEST SUMMARY                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝\n');
  
  for (const [name, result] of Object.entries(results)) {
    console.log(`  ${result}  ${name}`);
  }
  
  const allPassed = Object.values(results).every(r => r.includes('PASS'));
  console.log(`\n${allPassed ? '✓' : '✗'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}\n`);
}

runAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
