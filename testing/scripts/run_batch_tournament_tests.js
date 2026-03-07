#!/usr/bin/env node
/*
Tournament Testing Batch Runner
================================
Runs full tournament lifecycle tests for all 4 tournament types
Each test uses a different creator user
All tests run in AUTOMATIC mode (no pauses)
Generates comprehensive summary report
*/

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPT_PATH = path.join(__dirname, 'tournament_full_lifecycle.js');
const RESULTS_DIR = path.join(__dirname, '..', 'results');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const TOURNAMENT_TYPES = [
  { name: 'Elimination', code: '1' },
  { name: 'League', code: '2' },
  { name: 'Swiss', code: '3' },
  { name: 'Swiss-Elimination Mix', code: '4' },
];

const CREATOR_USERS = [
  'test_user_01',
  'test_user_05',
  'test_user_09',
  'test_user_13',
];

async function runTest(tournamentType, creatorIndex) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing ${tournamentType.name} Tournament (Creator: ${CREATOR_USERS[creatorIndex]})`);
    console.log('='.repeat(80));

    const process = spawn('node', [SCRIPT_PATH], {
      stdio: ['pipe', 'inherit', 'inherit'],
      cwd: __dirname,
    });

    // Send inputs: tournament type, then automatic mode
    setTimeout(() => {
      process.stdin.write(`${tournamentType.code}\n`);
    }, 500);

    setTimeout(() => {
      process.stdin.write('A\n'); // Automatic mode
      process.stdin.end();
    }, 1000);

    process.on('close', (code) => {
      const status = code === 0 ? '✓ PASSED' : '✗ FAILED';
      console.log(`\n[${status}] ${tournamentType.name} tournament test completed\n`);
      resolve({ type: tournamentType.name, code, creator: CREATOR_USERS[creatorIndex] });
    });

    process.on('error', (error) => {
      console.error(`Error running test: ${error.message}`);
      resolve({ type: tournamentType.name, code: 1, creator: CREATOR_USERS[creatorIndex], error: error.message });
    });
  });
}

async function main() {
  console.log('\n' + '#'.repeat(80));
  console.log('# TOURNAMENT FULL LIFECYCLE BATCH TEST RUNNER');
  console.log('# Running all 4 tournament types in AUTOMATIC mode');
  console.log('#'.repeat(80));

  const results = [];
  const startTime = new Date();

  for (let i = 0; i < TOURNAMENT_TYPES.length; i++) {
    const result = await runTest(TOURNAMENT_TYPES[i], i);
    results.push(result);

    // Add delay between tests to avoid database conflicts
    if (i < TOURNAMENT_TYPES.length - 1) {
      console.log('Waiting 3 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  const endTime = new Date();
  const duration = Math.round((endTime - startTime) / 1000);

  // Generate summary report
  console.log('\n' + '#'.repeat(80));
  console.log('# BATCH TEST SUMMARY');
  console.log('#'.repeat(80));

  const passCount = results.filter(r => r.code === 0).length;
  const failCount = results.filter(r => r.code !== 0).length;

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`✓ Passed: ${passCount}`);
  console.log(`✗ Failed: ${failCount}`);
  console.log(`⏱️  Total Duration: ${duration} seconds\n`);

  console.log('Test Results:');
  results.forEach((result, index) => {
    const status = result.code === 0 ? '✓' : '✗';
    const error = result.error ? ` - ${result.error}` : '';
    console.log(`  ${status} ${index + 1}. ${result.type} (Creator: ${result.creator})${error}`);
  });

  console.log('\nLog files location: ' + RESULTS_DIR);
  console.log('\n' + '#'.repeat(80));

  // Write summary to file
  const summaryFile = path.join(RESULTS_DIR, `batch_test_summary_${new Date().toISOString().split('T')[0]}.txt`);
  const summaryContent = `TOURNAMENT BATCH TEST SUMMARY
========================================
Date: ${new Date().toISOString()}
Duration: ${duration} seconds

Results:
${results.map((r, i) => `${i + 1}. ${r.type} (Creator: ${r.creator}) - ${r.code === 0 ? 'PASSED' : 'FAILED'}${r.error ? ` (${r.error})` : ''}`).join('\n')}

Total: ${passCount}/${results.length} passed
`;

  fs.writeFileSync(summaryFile, summaryContent);
  console.log(`\nSummary saved to: ${summaryFile}\n`);

  // Exit with appropriate code
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
