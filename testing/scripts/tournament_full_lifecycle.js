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

// Initialize log file
console.log(`[INIT] Creating log file at: ${logFile}`);
try {
  fs.writeFileSync(logFile, `Tournament Lifecycle Test Started at ${new Date().toISOString()}\n`);
  console.log(`[INIT] Log file created successfully`);
} catch (err) {
  console.error(`[INIT ERROR] Failed to create log file:`, err.message);
}

function appendLog(line) {
  const timestamp = new Date().toISOString();
  try {
    fs.appendFileSync(logFile, `[${timestamp}] ${line}\n`);
  } catch (err) {
    console.error(`[LOG ERROR] Failed to write to ${logFile}:`, err.message);
  }
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
    return response; // Return both token and userId
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

async function reportMatch(token, tournamentId, matchId, winnerId, loserId) {
  try {
    // Step 1: Report the match using the general match reporting endpoint
    const reportData = {
      opponent_id: loserId,
      map: 'AutoMap',
      winner_faction: 'Human',
      loser_faction: 'Orc',
      comments: getRandomComment(),
      rating: 3,
      tournament_id: tournamentId,
      tournament_match_id: matchId
    };

    const reportResponse = await makeRequest(
      'POST',
      '/api/matches/report-json',
      reportData,
      token
    );

    if (!reportResponse || !reportResponse.id) {
      throw new Error('Failed to report match - no match ID returned');
    }

    const reportedMatchId = reportResponse.id;

    // Step 2: Link the reported match to the tournament match
    const linkData = {
      winner_id: winnerId,
      reported_match_id: reportedMatchId
    };

    const linkResponse = await makeRequest(
      'POST',
      `/api/tournaments/${tournamentId}/matches/${matchId}/result`,
      linkData,
      token
    );

    return { reportedMatchId, linkResponse };
  } catch (error) {
    throw new Error(`Match report failed: ${error.message}`);
  }
}

async function completeRound(token, tournamentId, roundId) {
  try {
    // Add a small delay to ensure database state is updated
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Move to next round using the correct endpoint
    const response = await makeRequest('POST', `/api/tournaments/${tournamentId}/next-round`, {}, token);
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
  let tokens = {}; // nickname -> token
  let userIdToToken = {}; // userId -> token
  let tournamentId = null;
  let creatorToken = null;
  let enrolledPlayers = []; // Array of {userId, token, nickname}

  try {
    logPhase('INITIALIZATION', `Tournament Type: ${tournamentType}, Mode: ${stepByStep ? 'Step-by-Step' : 'Automatic'}`);

    // Load and login users
    logPhase('LOGIN', 'Loading test credentials and logging in users...');
    users = loadTestUsers();
    console.log(`Loaded ${users.length} test users`);
    appendLog(`Loaded ${users.length} test users`);

    for (const user of users) {
      try {
        const loginResult = await loginUser(user.nickname, user.password);
        tokens[user.nickname] = loginResult.token;
        userIdToToken[loginResult.userId] = loginResult.token;
        logAction(`Login ${user.nickname}`, 'SUCCESS');
      } catch (error) {
        logError(`Login ${user.nickname}`, error);
      }
    }

    const availableUsers = Object.keys(tokens);
    if (availableUsers.length < 2) {
      throw new Error('Need at least 2 logged-in users for tournament');
    }

    const creatorNickname = availableUsers[0];
    creatorToken = tokens[creatorNickname];

    if (stepByStep) {
      await pause('⏸️  SETUP PHASE COMPLETE');
    }

    // Create tournament
    logPhase('TOURNAMENT CREATION', `Creating ${tournamentType} tournament with ${tournamentType === 'league' ? 4 : 8} players`);

    // League tournaments are faster with fewer participants
    const maxParticipants = tournamentType === 'league' ? Math.min(4, availableUsers.length) : Math.min(8, availableUsers.length);
    const tournamentName = process.env.TOURNAMENT_NAME || `Test ${tournamentType.toUpperCase()} Tournament ${new Date().toISOString().slice(0, 10)}`;
    
    // Configure tournament based on type
    let tournamentData = {
      name: tournamentName,
      description: `Automated test tournament - ${tournamentType} format`,
      tournament_type: tournamentType,
      max_participants: maxParticipants,
      round_duration_days: 1,
      auto_advance_round: true,
      general_rounds_format: 'bo1',
      final_rounds_format: 'bo1',
    };

    // Set rounds based on tournament type
    if (tournamentType === 'elimination') {
      // Pure elimination: 3 final rounds (Quarterfinals, Semifinals, Final)
      tournamentData.general_rounds = 0;
      tournamentData.final_rounds = 3;
    } else if (tournamentType === 'league') {
      // League: 2 general rounds (ida y vuelta - home and away)
      tournamentData.general_rounds = 2;
      tournamentData.final_rounds = 0;
    } else if (tournamentType === 'swiss') {
      // Swiss: 3 general rounds
      tournamentData.general_rounds = 3;
      tournamentData.final_rounds = 0;
    } else if (tournamentType === 'swiss_elimination') {
      // Swiss-Elimination Mix: 3 Swiss rounds + 2 Elimination rounds (Semifinals, Final)
      tournamentData.general_rounds = 3;
      tournamentData.final_rounds = 2;
    }

    const createResult = await createTournament(creatorToken, tournamentData);
    tournamentId = createResult.id;
    logAction('Tournament Created', 'SUCCESS', `ID: ${tournamentId}, Type: ${tournamentType}, General Rounds: ${tournamentData.general_rounds}, Final Rounds: ${tournamentData.final_rounds}`);

    if (stepByStep) {
      await pause('⏸️  TOURNAMENT CREATED - Ready to enroll players');
    }

    // Enroll players
    logPhase('PLAYER ENROLLMENT', `Enrolling ${Math.min(maxParticipants, availableUsers.length - 1)} players`);

    enrolledPlayers = []; // Reset enrolled players array
    for (let i = 1; i < Math.min(maxParticipants + 1, availableUsers.length); i++) {
      const nickname = availableUsers[i];
      try {
        await enrollPlayer(tokens[nickname], tournamentId);
        // Find the userId for this nickname token
        let userId = null;
        for (const [uid, token] of Object.entries(userIdToToken)) {
          if (token === tokens[nickname]) {
            userId = uid;
            break;
          }
        }
        if (userId) {
          enrolledPlayers.push({ userId, token: tokens[nickname], nickname });
        }
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
    let maxRounds = 100; // Will be updated with actual tournament data
    const maxRoundsLimit = process.env.MAX_ROUNDS ? parseInt(process.env.MAX_ROUNDS) : null;

    while (tournamentActive && roundNumber <= maxRounds) {
      try {
        // Check if we should stop at Swiss rounds only
        if (maxRoundsLimit && roundNumber > maxRoundsLimit) {
          logAction(`Round ${roundNumber}`, 'INFO', `Stopping at round ${roundNumber} (MAX_ROUNDS=${maxRoundsLimit})`);
          tournamentActive = false;
          break;
        }

        const tournament = await getTournamentDetails(creatorToken, tournamentId);
        
        // Update maxRounds on first iteration (or if not set)
        if (roundNumber === 1) {
          maxRounds = tournament.total_rounds || 100;
          logAction(`Round Execution Setup`, 'SUCCESS', `Max rounds for this tournament: ${maxRounds}`);
        }
        
        if (tournament.status !== 'in_progress') {
          logAction(`Round ${roundNumber}`, 'SUCCESS', `Tournament status: ${tournament.status}`);
          tournamentActive = tournament.status === 'in_progress';
          if (!tournamentActive) break;
        }

        const roundsResult = await getTournamentRounds(creatorToken, tournamentId);
        const currentRound = roundsResult.find((r) => r.round_number === roundNumber);

        if (!currentRound) {
          logAction(`Round ${roundNumber}`, 'INFO', 'No more rounds available');
          tournamentActive = false;
          break;
        }

        // Determine round type label using new classification system
        let roundTypeLabel = currentRound.round_phase_label || 'Round';
        
        // Fallback to old logic if new fields not available
        if (!currentRound.round_phase_label) {
          roundTypeLabel = currentRound.round_type === 'general' ? 'SWISS' : 'ELIMINATION';
          if (currentRound.round_type === 'final') {
            // For final rounds, determine the stage (Quarterfinals, Semifinals, Final)
            const remainingFinalRounds = roundsResult.filter(r => r.round_type === 'final' && r.round_number >= roundNumber).length;
            if (remainingFinalRounds === 3) roundTypeLabel = 'QUARTERFINALS (8→4)';
            else if (remainingFinalRounds === 2) roundTypeLabel = 'SEMIFINALS (4→2)';
            else if (remainingFinalRounds === 1) roundTypeLabel = 'FINAL (2→1)';
          }
        }
        
        const roundPrefix = `Round ${roundNumber} [${roundTypeLabel}]${currentRound.round_classification ? ` (${currentRound.round_classification})` : ''}`;

        logPhase(`ROUND ${roundNumber}`, `Getting matches for round ${roundNumber} - ${roundTypeLabel}`);

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
          const loser = winner === match.player1_id ? match.player2_id : match.player1_id;
          const comment = getRandomComment();
          const replayFile = getRandomReplayFile();

          // Get the winner's token (player must report their own match)
          const winnerToken = userIdToToken[winner];
          if (!winnerToken) {
            logError(`${roundPrefix} - Report Match ${match.id}`, new Error(`Winner token not found for ${winner}`));
            continue;
          }

          try {
            await reportMatch(winnerToken, tournamentId, match.id, winner, loser);
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

        // Note: Round completion happens automatically when all matches are reported.
        // We don't need to manually trigger it. Just log the completion.
        if (matchCount > 0) {
          logAction(`${roundPrefix} - All Matches Reported`, 'SUCCESS', `${matchCount} matches completed`);

          // Check if we should activate next round
          const shouldActivateNext = !maxRoundsLimit || roundNumber < maxRoundsLimit;
          
          if (shouldActivateNext) {
            // Activate next round if there are matches reported
            if (stepByStep) {
              await pause(`⏸️  Preparing to activate next round`);
            }

            try {
              const nextRoundResponse = await completeRound(creatorToken, tournamentId, currentRound.id);
              logAction(`${roundPrefix} - Next Round Activated`, 'SUCCESS', `Moving to round ${roundNumber + 1}`);
            } catch (error) {
              logError(`${roundPrefix} - Next Round Activation`, error);
            }
          } else {
            logAction(`${roundPrefix} - Next Round Not Activated`, 'INFO', `Stopping at round ${roundNumber} (MAX_ROUNDS=${maxRoundsLimit})`);
          }
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
    console.log('[DEBUG] Entry point started');
    
    // Check if running in automated mode via environment variables
    if (process.env.TOURNAMENT_TYPE && process.env.TOURNAMENT_MODE) {
      console.log('[DEBUG] Using environment-based configuration');
      const typeMap = { '1': 'elimination', '2': 'league', '3': 'swiss', '4': 'swiss_elimination' };
      const typeKey = typeMap[process.env.TOURNAMENT_TYPE];
      const config = {
        tournamentType: typeKey,
        stepByStep: process.env.TOURNAMENT_MODE === 'S'
      };
      console.log('[DEBUG] Config from env:', config);
      await runTournamentLifecycle(config);
      console.log('[DEBUG] Tournament lifecycle completed');
    } else {
      console.log('[DEBUG] Using interactive menu');
      const config = await showMenu();
      console.log('[DEBUG] Config returned:', config);
      if (config) {
        console.log('[DEBUG] Starting tournament lifecycle with config:', config);
        await runTournamentLifecycle(config);
        console.log('[DEBUG] Tournament lifecycle completed');
      } else {
        console.log('Exiting...');
      }
    }
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
