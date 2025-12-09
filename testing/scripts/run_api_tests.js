/*
Test runner: API end-to-end tests for tournament app
Description of test sets performed by this script:
1) Log in all test users from `test_credentials.csv` and store their tokens.
2) For each test user:
   - Perform a random number (1-10) of match reports where this user is the winner and opponent is a random other test user.
   - For each reported match:
       * Log stats for both players before the report
       * Report the match via POST /api/matches/report-json (winner's token)
       * Log the API response and match id
       * Fetch profiles/stats for both players after report and log them
       * Verify FIDE ELO calculation locally (using same formula as server) and log PASS/FAIL
       * As the loser, the opponent will randomly (70%/30%) confirm or dispute the match using POST /api/matches/:id/confirm (loser's token)
       * Log the result of confirm/dispute and any status changes
3) All actions and results are written to a timestamped log file under `testing/results`.

Notes:
- This script uses only API calls (no direct DB access).
- It expects backend running on http://localhost:3000 (adjust BASE_URL below if different).
- The credentials file is `testing/scripts/test_credentials.csv` in format: nickname,password
- Log file format: each action line prefixed with [YYYYMMDD_HHMMSS] description; next line is [timestamp] RESULT: SUCCESS or ERROR + details.

Run: node run_api_tests.js
*/

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_HOST = process.env.TEST_BASE_HOST || 'localhost';
const BASE_PORT = process.env.TEST_BASE_PORT || 3000;
const BASE_URL = `http://${BASE_HOST}:${BASE_PORT}`;

const CREDENTIALS_PATH = path.join(__dirname, 'test_credentials.csv');
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

const logFile = path.join(RESULTS_DIR, `api_test_run_${timestampNow()}.log`);
function appendLog(line) {
  fs.appendFileSync(logFile, line + '\n');
}

function nowTag() {
  const d = new Date();
  return `[${d.toISOString().replace(/[:.]/g,'-')}]`;
}

// Simple HTTP request helper
function httpRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

    const req = http.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { /* ignore */ }
        resolve({ statusCode: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

// Utility randoms and text
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickRandom(arr) { return arr[randInt(0, arr.length - 1)]; }
function randomMap() { const maps = ['Alpine', 'Forest', 'Wastelands', 'Riverside', 'Highlands']; return pickRandom(maps); }
function randomFaction() { const factions = ['Human', 'Elves', 'Undead', 'Orc', 'Dwarves']; return pickRandom(factions); }
function randomComment(prefix) { const comments = ['Good game', 'Well played', 'Close match', 'Interesting tactics', 'Unlucky', 'GGWP', 'Nice try']; return `${prefix}: ${pickRandom(comments)}.`; }

// Ported FIDE calculation functions (same as backend)
function calculateExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}
function getKFactor(playerRating, matchesPlayed) {
  if (!playerRating || playerRating === 0) return 40;
  if (playerRating >= 2400) return 8;
  if (playerRating >= 2100) return 16;
  if (matchesPlayed >= 30) return 24;
  return 40;
}
function calculateNewRating(playerRating, opponentRating, result, matchesPlayed) {
  const k = getKFactor(playerRating, matchesPlayed);
  const expectedScore = calculateExpectedScore(playerRating || 1400, opponentRating);
  let actualScore = 0;
  if (result === 'win') actualScore = 1;
  else if (result === 'draw') actualScore = 0.5;
  const ratingChange = k * (actualScore - expectedScore);
  const newRating = (playerRating || 1400) + ratingChange;
  return Math.round(newRating);
}

(async () => {
  appendLog(`${nowTag()} Starting API test run`);

  // Read credentials
  const csv = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
  const lines = csv.split(/\r?\n/).map(l=>l.trim()).filter(l=>l && !l.startsWith('#'));
  const header = lines.shift();
  const creds = lines.map(l => {
    const [nickname, password] = l.split(',');
    return { nickname: nickname.trim(), password: password.trim() };
  });

  appendLog(`${nowTag()} Loaded ${creds.length} credentials from ${CREDENTIALS_PATH}`);

  // Login all users
  const users = {};
  for (const c of creds) {
    appendLog(`${nowTag()} ACTION: login user=${c.nickname}`);
    try {
      const resp = await httpRequest('POST', '/api/auth/login', null, { nickname: c.nickname, password: c.password });
      if (resp.statusCode === 200 && resp.body && resp.body.token) {
        users[c.nickname] = { token: resp.body.token, id: resp.body.userId };
        appendLog(`${nowTag()} RESULT: SUCCESS - logged in, userId=${resp.body.userId}`);
      } else {
        appendLog(`${nowTag()} RESULT: ERROR - login failed user=${c.nickname} status=${resp.statusCode} body=${JSON.stringify(resp.body)}`);
      }
    } catch (err) {
      appendLog(`${nowTag()} RESULT: ERROR - login exception user=${c.nickname} - ${String(err)}`);
    }
  }

  const nicknames = Object.keys(users);
  appendLog(`${nowTag()} INFO: ${nicknames.length} users logged in successfully`);

  // For each logged-in user perform random number of match reports
  for (const nickname of nicknames) {
    const u = users[nickname];
    const matchesToReport = randInt(1, 10);
    appendLog(`${nowTag()} ACTION: run_user_reports user=${nickname} count=${matchesToReport}`);

    for (let i = 0; i < matchesToReport; i++) {
      const opponentNick = pickRandom(nicknames.filter(n => n !== nickname));
      const opponent = users[opponentNick];
      // Get stats before for both (use profile endpoint for matches_played etc)
      appendLog(`${nowTag()} ACTION: fetch_profiles_before user=${nickname} opponent=${opponentNick}`);
      let profileWinnerBefore = null;
      let profileLoserBefore = null;
      try {
        const pw = await httpRequest('GET', '/api/users/profile', u.token);
        const pl = await httpRequest('GET', '/api/users/profile', opponent.token);
        profileWinnerBefore = pw.body;
        profileLoserBefore = pl.body;
        appendLog(`${nowTag()} RESULT: SUCCESS - fetched profiles`);
      } catch (err) {
        appendLog(`${nowTag()} RESULT: ERROR - fetch_profiles_before user=${nickname} opponent=${opponentNick} - ${String(err)}`);
        continue;
      }

      // Report match
      const map = randomMap();
      const winnerFaction = randomFaction();
      const loserFaction = randomFaction();
      const commentsWinner = randomComment('Winner');
      const commentsLoser = randomComment('Loser');
      const rating = randInt(1,5);

      const actionDesc = `Report match: ${nickname} (winner) vs ${opponentNick} (loser) map=${map}`;
      appendLog(`${nowTag()} ACTION: report_match user=${nickname} opponent=${opponentNick} map=${map}`);

      let matchId = null;
      try {
        const body = {
          opponent_id: opponent.id,
          map,
          winner_faction: winnerFaction,
          loser_faction: loserFaction,
          comments: `${commentsWinner} / ${commentsLoser}`,
          rating
        };
        const resp = await httpRequest('POST', '/api/matches/report-json', u.token, body);
        if (resp.statusCode === 201 && resp.body && resp.body.id) {
          matchId = resp.body.id;
          appendLog(`${nowTag()} RESULT: SUCCESS - match reported id=${matchId}`);
        } else {
          appendLog(`${nowTag()} RESULT: ERROR - report_match user=${nickname} opponent=${opponentNick} status=${resp.statusCode} body=${JSON.stringify(resp.body)}`);
          continue;
        }
      } catch (err) {
          appendLog(`${nowTag()} RESULT: ERROR - report_match exception user=${nickname} opponent=${opponentNick} - ${String(err)}`);
        continue;
      }

      // Fetch profiles/stats after report
      appendLog(`${nowTag()} ACTION: fetch_profiles_after user=${nickname} opponent=${opponentNick}`);
      let profileWinnerAfter = null;
      let profileLoserAfter = null;
      try {
        const pw = await httpRequest('GET', '/api/users/profile', u.token);
        const pl = await httpRequest('GET', '/api/users/profile', opponent.token);
        profileWinnerAfter = pw.body;
        profileLoserAfter = pl.body;
        appendLog(`${nowTag()} RESULT: SUCCESS - fetched profiles after`);
      } catch (err) {
        appendLog(`${nowTag()} RESULT: ERROR - fetch_profiles_after user=${nickname} opponent=${opponentNick} - ${String(err)}`);
      }

      // Also fetch recent matches for winner to get stored before/after ELO in match record
      appendLog(`${nowTag()} ACTION: fetch_recent_matches user=${nickname}`);
      let recentMatches = [];
      try {
        const rm = await httpRequest('GET', `/api/users/${u.id}/matches`, u.token);
        if (rm.statusCode === 200 && Array.isArray(rm.body)) recentMatches = rm.body;
        appendLog(`${nowTag()} RESULT: SUCCESS - recent matches retrieved count=${recentMatches.length}`);
      } catch (err) {
        appendLog(`${nowTag()} RESULT: ERROR - fetch_recent_matches user=${nickname} - ${String(err)}`);
      }

      // Find the match by id in recentMatches
      const foundMatch = recentMatches.find(m => m.id === matchId) || recentMatches[0] || null;
      if (!foundMatch) {
        appendLog(`${nowTag()} RESULT: ERROR - reported match not found in recent matches`);
      } else {
        // Log elo before/after
        const wb = foundMatch.winner_elo_before;
        const wa = foundMatch.winner_elo_after;
        const lb = foundMatch.loser_elo_before;
        const la = foundMatch.loser_elo_after;
        appendLog(`${nowTag()} INFO: Match ELOs - winner ${wb} -> ${wa}; loser ${lb} -> ${la}`);

        // Verify FIDE calculation locally using pre-match ratings and matches_played before
        const expectedWinnerNew = calculateNewRating(profileWinnerBefore.elo_rating || 1400, profileLoserBefore.elo_rating || 1400, 'win', profileWinnerBefore.matches_played || 0);
        const expectedLoserNew = calculateNewRating(profileLoserBefore.elo_rating || 1400, profileWinnerBefore.elo_rating || 1400, 'loss', profileLoserBefore.matches_played || 0);
        let eloCheck = 'PASS';
        if (expectedWinnerNew !== wa || expectedLoserNew !== la) {
          eloCheck = `FAIL - expected winner ${expectedWinnerNew} got ${wa}; expected loser ${expectedLoserNew} got ${la}`;
        }
        appendLog(`${nowTag()} RESULT: ELO_CHECK ${eloCheck}`);
      }

      // Now as loser, simulate confirm or dispute
      const actionType = Math.random() < 0.7 ? 'confirm' : 'dispute';
      const confirmComments = actionType === 'confirm' ? randomComment('Loser confirm') : randomComment('Loser dispute');
      const confirmRating = randInt(1,5);
      const actionLabel = actionType === 'confirm' ? 'confirm_match' : 'dispute_match';
      appendLog(`${nowTag()} ACTION: ${actionLabel} user=${opponentNick} match=${matchId}`);
      try {
        const resp = await httpRequest('POST', `/api/matches/${matchId}/confirm`, opponent.token, { action: actionType, comments: confirmComments, rating: confirmRating });
        if (resp.statusCode === 200 && resp.body) {
          appendLog(`${nowTag()} RESULT: SUCCESS - ${actionLabel} user=${opponentNick} match=${matchId} response=${JSON.stringify(resp.body)}`);
        } else {
          appendLog(`${nowTag()} RESULT: ERROR - ${actionLabel} user=${opponentNick} match=${matchId} status=${resp.statusCode} body=${JSON.stringify(resp.body)}`);
        }
      } catch (err) {
        appendLog(`${nowTag()} RESULT: ERROR - ${actionLabel} user=${opponentNick} match=${matchId} exception=${String(err)}`);
      }

      // If the loser disputed, let the admin optionally resolve the dispute
      if (actionType === 'dispute') {
        // Check for admin credentials logged in
        const adminUser = users['admin'];
        if (adminUser && adminUser.token) {
          // small random delay to simulate review time
          await new Promise(r => setTimeout(r, randInt(300, 1200)));
          const adminAction = Math.random() < 0.5 ? 'validate' : 'reject';
          appendLog(`${nowTag()} ACTION: admin_resolve admin=admin action=${adminAction} match=${matchId}`);
          try {
            const adminResp = await httpRequest('POST', `/api/matches/admin/${matchId}/dispute`, adminUser.token, { action: adminAction });
            if (adminResp.statusCode === 200 && adminResp.body) {
              appendLog(`${nowTag()} RESULT: SUCCESS - admin_resolve admin=admin match=${matchId} response=${JSON.stringify(adminResp.body)}`);
            } else {
              appendLog(`${nowTag()} RESULT: ERROR - admin_resolve admin=admin match=${matchId} status=${adminResp.statusCode} body=${JSON.stringify(adminResp.body)}`);
            }
          } catch (err) {
            appendLog(`${nowTag()} RESULT: ERROR - admin_resolve admin=admin match=${matchId} exception=${String(err)}`);
          }
        } else {
          appendLog(`${nowTag()} INFO: No admin credentials present; skipping admin review for match=${matchId}`);
        }
      }

      // Pause a short random time between matches to avoid overwhelming server
      await new Promise(r => setTimeout(r, randInt(200, 800)));
    }

    appendLog(`${nowTag()} INFO: Completed matches for user ${nickname}`);
  }

  appendLog(`${nowTag()} Test run completed`);

  // Automatically call summarize_log.js on the generated log
  try {
    const { execFileSync } = require('child_process');
    const summarizeScript = path.join(__dirname, 'summarize_log.js');
    const logBasename = path.basename(logFile);
    appendLog(`${nowTag()} ACTION: summarize_log file=${logBasename}`);
    const stdout = execFileSync('node', [summarizeScript, logBasename], { encoding: 'utf8' });
    // summarize_log writes its own file; capture and log its stdout
    appendLog(`${nowTag()} RESULT: SUCCESS - summarize_log output=${stdout.trim().replace(/\r?\n/g, ' | ')}`);
  } catch (err) {
    appendLog(`${nowTag()} RESULT: ERROR - summarize_log failed: ${String(err)}`);
  }

})();
