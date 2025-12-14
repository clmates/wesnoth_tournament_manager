#!/usr/bin/env node
/*
Tournament Full Lifecycle Testing Script
========================================
Tests the complete tournament workflow:
1. Create tournament
2. Enroll players
3. Prepare tournament
4. Start tournament
5. Generate rounds
6. Report matches
7. Advance rounds
8. Complete tournament

Features:
- Menu-driven interface to select tournament type and options
- Automatic or step-by-step mode
- Step-by-step mode pauses at each phase (creation, enrollment, prep, gameplay)
- Gameplay mode pauses at each round
- All actions logged with timestamps
- Error handling and recovery suggestions
- Uses API only (no direct DB access)
*/

const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const FormData = require('form-data');

const BASE_HOST = process.env.TEST_BASE_HOST || 'localhost';
const BASE_PORT = process.env.TEST_BASE_PORT || 3000;
const BASE_URL = `http://${BASE_HOST}:${BASE_PORT}`;

const CREDENTIALS_PATH = path.join(__dirname, 'test_credentials.csv');
const RESULTS_DIR = path.join(__dirname, '..', 'results');
const WESNOTH_SAVES_DIR = 'C:\\Users\\carlo\\Documents\\My Games\\Wesnoth1.18\\saves';

if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

// =====================
// Logging and Utilities
// =====================

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

const logFile = path.join(RESULTS_DIR, `tournament_lifecycle_${timestampNow()}.log`);

function appendLog(line) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] ${line}\n`);
}

function logPhase(phase, details) {
  const separator = '='.repeat(80);
  appendLog(`\n${separator}`);
  appendLog(`PHASE: ${phase}`);
  appendLog(`DETAILS: ${details}`);
  appendLog(separator);
  console.log(`\n${separator}`);
  console.log(`PHASE: ${phase}`);
  console.log(`DETAILS: ${details}`);
  console.log(separator);
}

function logAction(action, result, details = '') {
  const status = result === 'SUCCESS' ? '✓' : '✗';
  appendLog(`[${status}] ${action}`);
  if (details) {
    appendLog(`    Details: ${details}`);
  }
  console.log(`[${status}] ${action}`);
  if (details) {
    console.log(`    Details: ${details}`);
  }
}

function logError(action, error) {
  appendLog(`[✗] ERROR in ${action}`);
  appendLog(`    ${error.message || error}`);
  console.log(`[✗] ERROR in ${action}`);
  console.log(`    ${error.message || error}`);
}

// =====================
// Match Comments & Files
// =====================

const MATCH_COMMENTS = [
  'Great game! Very competitive match.',
  'Nice tactics, well played opponent.',
  'That was intense! Great use of units.',
  'Well executed strategy, impressive moves.',
  'Solid gameplay, enjoyed this match.',
  'Amazing defense, good balance of units.',
  'Creative strategy, fun to play against.',
  'Excellent performance from both sides.',
  'Very interesting unit placement.',
  'Good micro management throughout.',
  'Impressive tactical decisions.',
  'Great match, looking forward to rematch!',
  'Well deserved victory, gg.',
  'Strong opening, kept pressure on.',
  'Good resource management.',
];

function getRandomComment() {
  return MATCH_COMMENTS[Math.floor(Math.random() * MATCH_COMMENTS.length)];
}

function getRandomReplayFile() {
  try {
    if (!fs.existsSync(WESNOTH_SAVES_DIR)) {
      return null;
    }
    const files = fs.readdirSync(WESNOTH_SAVES_DIR).filter(
      f => f.endsWith('.sgf') || f.endsWith('.wsm') || f.endsWith('.zip')
    );
    if (files.length === 0) return null;
    return path.join(WESNOTH_SAVES_DIR, files[Math.floor(Math.random() * files.length)]);
  } catch (error) {
    return null;
  }
}

// =====================
// API Calls
// =====================

function makeRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ status: res.statusCode, message: parsed.error || 'API Error', response: parsed });
          }
        } catch (e) {
          reject({ status: res.statusCode, message: 'Invalid JSON response', raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function loginUser(nickname, password) {
  try {
    const response = await makeRequest('POST', '/api/auth/login', { nickname, password });
    return response.token;
  } catch (error) {
    throw new Error(`Login failed for ${nickname}: ${error.message}`);
  }
}

async function createTournament(token, tournamentData) {
  try {
    const response = await makeRequest('POST', '/api/tournaments', tournamentData, token);
    return response;
  } catch (error) {
    throw new Error(`Tournament creation failed: ${error.message}`);
  }
}

async function enrollPlayer(token, tournamentId) {
  try {
    const response = await makeRequest('POST', `/api/tournaments/${tournamentId}/join`, {}, token);
    return response;
  } catch (error) {
    throw new Error(`Player enrollment failed: ${error.message}`);
  }
}

async function prepareTournament(token, tournamentId) {
  try {
    const response = await makeRequest('POST', `/api/tournaments/${tournamentId}/prepare`, {}, token);
    return response;
  } catch (error) {
    throw new Error(`Tournament preparation failed: ${error.message}`);
  }
}

async function startTournament(token, tournamentId) {
  try {
    const response = await makeRequest('POST', `/api/tournaments/${tournamentId}/start`, {}, token);
    return response;
  } catch (error) {
    throw new Error(`Tournament start failed: ${error.message}`);
  }
}

async function closeRegistration(token, tournamentId) {
  try {
    const response = await makeRequest('POST', `/api/tournaments/${tournamentId}/close-registration`, {}, token);
    return response;
  } catch (error) {
    throw new Error(`Close registration failed: ${error.message}`);
  }
}

async function getTournamentDetails(token, tournamentId) {
  try {
    const response = await makeRequest('GET', `/api/tournaments/${tournamentId}`, null, token);
    return response;
  } catch (error) {
    throw new Error(`Get tournament details failed: ${error.message}`);
  }
}

async function getTournamentRounds(token, tournamentId) {
  try {
    const response = await makeRequest('GET', `/api/tournaments/${tournamentId}/rounds`, null, token);
    return response;
  } catch (error) {
    throw new Error(`Get tournament rounds failed: ${error.message}`);
  }
}

async function getRoundMatches(token, tournamentId, roundId) {
  try {
    const response = await makeRequest('GET', `/api/tournaments/${tournamentId}/rounds/${roundId}/matches`, null, token);
    return response;
  } catch (error) {
    throw new Error(`Get round matches failed: ${error.message}`);
  }
}

async function reportMatch(token, matchId, winnerId) {
  try {
    const reportData = {
      winner_id: winnerId,
      comments: getRandomComment(),
    };

    // Try to attach a random replay file
    const replayFile = getRandomReplayFile();
    if (replayFile && fs.existsSync(replayFile)) {
      // If replay file exists, use multipart form data
      return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('winner_id', winnerId);
        form.append('comments', reportData.comments);
        form.append('replay', fs.createReadStream(replayFile));

        const url = new URL(`${BASE_URL}/api/matches/${matchId}/report`);
        const options = {
          hostname: url.hostname,
          port: url.port || 3000,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${token}`,
          },
        };

        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = data ? JSON.parse(data) : {};
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(parsed);
              } else {
                reject({ status: res.statusCode, message: parsed.error || 'API Error' });
              }
            } catch (e) {
              reject({ status: res.statusCode, message: 'Invalid JSON response' });
            }
          });
        });

        req.on('error', reject);
        form.pipe(req);
      });
    } else {
      // No replay file, use regular JSON request
      const response = await makeRequest('POST', `/api/matches/${matchId}/report`, reportData, token);
      return response;
    }
  } catch (error) {
    throw new Error(`Match report failed: ${error.message}`);
  }
}

async function completeRound(token, tournamentId, roundId) {
  try {
    const response = await makeRequest('POST', `/api/tournaments/${tournamentId}/rounds/${roundId}/complete`, {}, token);
    return response;
  } catch (error) {
    throw new Error(`Round completion failed: ${error.message}`);
  }
}

// =====================
// User Management
// =====================

function loadTestUsers() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Test credentials file not found: ${CREDENTIALS_PATH}`);
  }
  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
  const lines = content.trim().split('\n').filter(line => line && !line.startsWith('#'));
  return lines.map(line => {
    const [nickname, password] = line.split(',').map(s => s.trim());
    return { nickname, password };
  });
}

// =====================
// Interactive Menu
// =====================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function showMenu() {
  console.log('\n' + '='.repeat(80));
  console.log('TOURNAMENT LIFECYCLE TESTING SCRIPT');
  console.log('='.repeat(80));
  console.log('\nSelect Tournament Type:');
  console.log('1) Elimination');
  console.log('2) League');
  console.log('3) Swiss');
  console.log('4) Swiss-Elimination Mix');
  console.log('\nSelect Mode:');
  console.log('A) Automatic (runs all phases without pausing)');
  console.log('S) Step-by-Step (pauses at each phase, requires confirmation)');
  console.log('Q) Quit\n');

  const tournamentType = await question('Tournament Type (1-4): ');
  const mode = await question('Mode (A/S/Q): ');

  const typeMap = { '1': 'elimination', '2': 'league', '3': 'swiss', '4': 'swiss_elimination' };
  const typeKey = typeMap[tournamentType];

  if (!typeKey) {
    console.log('Invalid tournament type');
    return null;
  }

  if (mode.toUpperCase() === 'Q') {
    return null;
  }

  const stepByStep = mode.toUpperCase() === 'S';

  return { tournamentType: typeKey, stepByStep };
}

async function pause(message) {
  const response = await question(`\n${message}\nPress Enter to continue...`);
  return response;
}

// =====================
// Main Execution
// =====================

async function runTournamentLifecycle(config) {
  const { tournamentType, stepByStep } = config;
  let users = [];
  let tokens = {};
  let tournamentId = null;
  let creatorToken = null;

  try {
    logPhase('INITIALIZATION', `Tournament Type: ${tournamentType}, Mode: ${stepByStep ? 'Step-by-Step' : 'Automatic'}`);

    // Load and login users
    logPhase('LOGIN', 'Loading test credentials and logging in users...');
    users = loadTestUsers();
    console.log(`Loaded ${users.length} test users`);
    appendLog(`Loaded ${users.length} test users`);

    for (const user of users) {
      try {
        tokens[user.nickname] = await loginUser(user.nickname, user.password);
        logAction(`Login ${user.nickname}`, 'SUCCESS');
      } catch (error) {
        logError(`Login ${user.nickname}`, error);
      }
    }

    const availableUsers = Object.keys(tokens);
    if (availableUsers.length < 2) {
      throw new Error('Need at least 2 logged-in users for tournament');
    }

    creatorToken = tokens[availableUsers[0]];

    if (stepByStep) {
      await pause('⏸️  SETUP PHASE COMPLETE');
    }

    // Create tournament
    logPhase('TOURNAMENT CREATION', `Creating ${tournamentType} tournament with ${Math.min(8, availableUsers.length)} players`);

    const maxParticipants = Math.min(8, availableUsers.length);
    const tournamentData = {
      name: `Test ${tournamentType.toUpperCase()} Tournament ${new Date().toISOString().slice(0, 10)}`,
      description: `Automated test tournament - ${tournamentType} format`,
      tournament_type: tournamentType,
      max_participants: maxParticipants,
      round_duration_days: 1,
      auto_advance_round: true,
      general_rounds: tournamentType === 'elimination' ? 0 : 3,
      final_rounds: tournamentType === 'elimination' ? 3 : 0,
      general_rounds_format: 'bo1',
      final_rounds_format: 'bo1',
    };

    const createResult = await createTournament(creatorToken, tournamentData);
    tournamentId = createResult.id;
    logAction('Tournament Created', 'SUCCESS', `ID: ${tournamentId}`);

    if (stepByStep) {
      await pause('⏸️  TOURNAMENT CREATED - Ready to enroll players');
    }

    // Enroll players
    logPhase('PLAYER ENROLLMENT', `Enrolling ${Math.min(maxParticipants, availableUsers.length - 1)} players`);

    for (let i = 1; i < Math.min(maxParticipants + 1, availableUsers.length); i++) {
      const nickname = availableUsers[i];
      try {
        await enrollPlayer(tokens[nickname], tournamentId);
        logAction(`Enroll ${nickname}`, 'SUCCESS');
      } catch (error) {
        logError(`Enroll ${nickname}`, error);
      }
    }

    if (stepByStep) {
      await pause('⏸️  ENROLLMENT COMPLETE - Ready to close registration');
    }

    // Close registration
    logPhase('REGISTRATION CLOSURE', 'Closing registration to prepare tournament');

    try {
      await closeRegistration(creatorToken, tournamentId);
      logAction('Registration Closed', 'SUCCESS');
    } catch (error) {
      logError('Close Registration', error);
    }

    if (stepByStep) {
      await pause('⏸️  REGISTRATION CLOSED - Ready to prepare tournament');
    }

    // Prepare tournament
    logPhase('TOURNAMENT PREPARATION', 'Finalizing tournament configuration and generating initial matches');

    try {
      await prepareTournament(creatorToken, tournamentId);
      logAction('Tournament Prepared', 'SUCCESS');
    } catch (error) {
      logError('Tournament Preparation', error);
    }

    if (stepByStep) {
      await pause('⏸️  PREPARATION COMPLETE - Ready to start tournament');
    }

    // Start tournament
    logPhase('TOURNAMENT START', 'Starting tournament and activating first round');

    try {
      await startTournament(creatorToken, tournamentId);
      logAction('Tournament Started', 'SUCCESS');
    } catch (error) {
      logError('Tournament Start', error);
    }

    if (stepByStep) {
      await pause('⏸️  TOURNAMENT STARTED - Ready to play rounds');
    }

    // Play rounds
    logPhase('ROUND EXECUTION', 'Running tournament rounds and matches');

    let roundNumber = 1;
    let tournamentActive = true;

    while (tournamentActive && roundNumber <= 10) {
      const roundPrefix = `Round ${roundNumber}`;

      try {
        const tournament = await getTournamentDetails(creatorToken, tournamentId);
        if (tournament.status !== 'in_progress') {
          logAction(`${roundPrefix} - Status Check`, 'SUCCESS', `Tournament status: ${tournament.status}`);
          tournamentActive = tournament.status === 'in_progress';
          if (!tournamentActive) break;
        }

        const roundsResult = await getTournamentRounds(creatorToken, tournamentId);
        const currentRound = roundsResult.find((r) => r.round_number === roundNumber);

        if (!currentRound) {
          logAction(`${roundPrefix} - Round Check`, 'INFO', 'No more rounds available');
          tournamentActive = false;
          break;
        }

        logPhase(`ROUND ${roundNumber}`, `Getting matches for round ${roundNumber}`);

        const matches = await getRoundMatches(creatorToken, tournamentId, currentRound.id);
        logAction(`${roundPrefix} - Fetch Matches`, 'SUCCESS', `Found ${matches.length} matches`);

        if (matches.length === 0) {
          logAction(`${roundPrefix} - No Matches`, 'INFO', 'No more matches in this round');
          tournamentActive = false;
          break;
        }

        // Report matches
        let matchCount = 0;
        for (const match of matches) {
          if (match.match_status === 'completed') {
            logAction(`${roundPrefix} - Match ${match.id} already completed`, 'INFO');
            continue;
          }

          // Randomly select winner (prefer player with lower ID to simulate varied outcomes)
          const winner = Math.random() > 0.5 ? match.player1_id : match.player2_id;
          const comment = getRandomComment();
          const replayFile = getRandomReplayFile();

          try {
            await reportMatch(creatorToken, match.id, winner);
            const replayInfo = replayFile ? ` [Replay: ${path.basename(replayFile)}]` : '';
            logAction(
              `${roundPrefix} - Report Match ${match.id}`, 
              'SUCCESS', 
              `Winner: ${winner}, Comment: "${comment}"${replayInfo}`
            );
            matchCount++;
          } catch (error) {
            logError(`${roundPrefix} - Report Match ${match.id}`, error);
          }
        }

        if (stepByStep) {
          await pause(`⏸️  ROUND ${roundNumber} COMPLETE - ${matchCount} matches reported`);
        }

        // Complete round
        try {
          await completeRound(creatorToken, tournamentId, currentRound.id);
          logAction(`${roundPrefix} - Round Completed`, 'SUCCESS');
        } catch (error) {
          logError(`${roundPrefix} - Round Completion`, error);
        }

        roundNumber++;
      } catch (error) {
        logError(`${roundPrefix} - Execution`, error);
        tournamentActive = false;
      }
    }

    logPhase('TOURNAMENT COMPLETION', 'Tournament has finished all rounds');

    try {
      const finalTournament = await getTournamentDetails(creatorToken, tournamentId);
      logAction('Final Tournament Status', 'SUCCESS', `Status: ${finalTournament.status}`);
      appendLog(`\nFinal Tournament Status: ${JSON.stringify(finalTournament, null, 2)}`);
    } catch (error) {
      logError('Final Status Check', error);
    }

    logPhase('SUMMARY', `Test completed successfully for ${tournamentType} tournament`);
    console.log(`\n✓ Test completed! Check log file: ${logFile}\n`);
    appendLog(`\n✓ Test completed successfully!\nLog file: ${logFile}`);
  } catch (error) {
    logPhase('ERROR', `Unexpected error occurred: ${error.message}`);
    logError('Lifecycle Execution', error);
    console.error(`\n✗ Test failed! Check log file: ${logFile}\n`);
    appendLog(`\n✗ Test failed!\nLog file: ${logFile}`);
  } finally {
    rl.close();
  }
}

// =====================
// Entry Point
// =====================

(async () => {
  try {
    const config = await showMenu();
    if (config) {
      await runTournamentLifecycle(config);
    } else {
      console.log('Exiting...');
    }
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
