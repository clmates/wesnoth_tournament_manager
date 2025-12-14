#!/usr/bin/env node
/**
 * Enhanced Tournament Testing Script
 * Creates one tournament of each type with clear naming
 * Shows detailed execution and results
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const TOURNAMENT_CONFIGS = [
  {
    number: 1,
    type: 'Elimination',
    inputSequence: ['1', 'A']  // Type 1, Automatic mode
  },
  {
    number: 2,
    type: 'League',
    inputSequence: ['2', 'A']  // Type 2, Automatic mode
  },
  {
    number: 3,
    type: 'Swiss',
    inputSequence: ['3', 'A']  // Type 3, Automatic mode
  },
  {
    number: 4,
    type: 'Swiss-Elimination Mix',
    inputSequence: ['4', 'A']  // Type 4, Automatic mode
  }
];

function runTournament(config) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(90)}`);
    console.log(`🎮 TEST ${config.number}: ${config.type.toUpperCase()} TOURNAMENT`);
    console.log(`${'='.repeat(90)}\n`);

    const child = spawn('node', [
      path.join(__dirname, 'tournament_full_lifecycle.js')
    ], {
      cwd: path.join(__dirname, '..', '..'),
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true
    });

    let inputIndex = 0;

    // Send inputs sequentially
    const sendNextInput = () => {
      if (inputIndex < config.inputSequence.length) {
        const input = config.inputSequence[inputIndex];
        console.log(`[SENDING INPUT] ${input}`);
        child.stdin.write(input + '\n');
        inputIndex++;
        setTimeout(sendNextInput, 500); // Small delay between inputs
      } else {
        child.stdin.end();
      }
    };

    sendNextInput();

    child.on('close', (code) => {
      const status = code === 0 ? '✅ PASS' : '❌ FAIL';
      console.log(`\n${status} ${config.type} tournament completed\n`);
      resolve({
        type: config.type,
        number: config.number,
        success: code === 0,
        exitCode: code
      });
    });

    child.on('error', (err) => {
      console.error(`❌ Error: ${err.message}`);
      resolve({
        type: config.type,
        number: config.number,
        success: false,
        exitCode: 1
      });
    });
  });
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║          TOURNAMENT SYSTEM - INDIVIDUAL TYPE TESTS WITH CLEAR NAMES               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════╝');

  const results = [];

  for (const config of TOURNAMENT_CONFIGS) {
    const result = await runTournament(config);
    results.push(result);
    
    // Delay between tournaments
    await new Promise(r => setTimeout(r, 2000));
  }

  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                            FINAL TEST SUMMARY                                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════════╝\n');

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const name = `Test ${result.number}: ${result.type}`;
    console.log(`  ${status} ${name.padEnd(40)} [Exit: ${result.exitCode}]`);
  }

  const allPassed = results.every(r => r.success);
  const passCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  console.log(`\n  Results: ${passCount}/${totalCount} tests passed\n`);

  if (allPassed) {
    console.log('  🎉 ALL TESTS PASSED! 🎉\n');
  } else {
    console.log('  ⚠️  Some tests failed. Please review the output above.\n');
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
