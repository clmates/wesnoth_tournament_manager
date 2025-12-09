/*
Tournament runner: simulate multiple elimination tournaments via API

Configurable variables (environment or edit at top):
 - NUM_TOURNAMENTS: number of tournaments to create (default 10)
 - MIN_PLAYERS: minimum players per tournament (default 4)
 - MAX_PLAYERS: maximum players per tournament (default 16)
 - DISPUTE_PROB: probability (0-1) that a loser disputes (default 0.05)
 - APPROVAL_PROB: probability (0-1) that organizer accepts a pending participant (default 0.95)
 - BASE_HOST / BASE_PORT: API host/port (defaults http://localhost:3000)

Logs: writes one file per tournament under `testing/results/` named `tournament_<id>_<timestamp>.log`

Run: node run_tournament_api_test.js
*/

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_HOST = process.env.TEST_BASE_HOST || 'localhost';
const BASE_PORT = process.env.TEST_BASE_PORT || 3000;

// Configurable variables (can be overridden via env)
const NUM_TOURNAMENTS = parseInt(process.env.NUM_TOURNAMENTS || '10', 10);
const MIN_PLAYERS = parseInt(process.env.MIN_PLAYERS || '4', 10);
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '16', 10);
const DISPUTE_PROB = parseFloat(process.env.DISPUTE_PROB || '0.05');
const APPROVAL_PROB = parseFloat(process.env.APPROVAL_PROB || '0.95');

const CREDENTIALS_PATH = path.join(__dirname, 'test_credentials.csv');
const RESULTS_DIR = path.join(__dirname, '..', 'results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

function timestampNow() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, '-');
}

function nowTag() {
  return `[${new Date().toISOString().replace(/[:.]/g,'-')}]`;
}

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

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeLogWriter(tournamentId, name) {
  const file = path.join(RESULTS_DIR, `tournament_${tournamentId || 'unknown'}_${timestampNow()}.log`);
  function append(line) { fs.appendFileSync(file, line + '\n'); }
  append(`${nowTag()} TOURNAMENT ${tournamentId || 'unknown'} NAME:${name || ''} LOG_STARTED`);
  return { append, file };
}

async function main() {
  // Read credentials
  const csv = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  lines.shift();
  const creds = lines.map(l => {
    const [nickname, password] = l.split(',');
    return { nickname: nickname.trim(), password: password.trim() };
  });

  // Login all users
  const users = {};
  for (const c of creds) {
    try {
      const resp = await httpRequest('POST', '/api/auth/login', null, { nickname: c.nickname, password: c.password });
      if (resp.statusCode === 200 && resp.body && resp.body.token) {
        users[c.nickname] = { token: resp.body.token, id: resp.body.userId };
      }
    } catch (err) {
      // ignore individual login failures
    }
  }

  const nicknames = Object.keys(users);
  // Build reverse map: userId => { nickname, token } for faster lookups during match reporting
  const usersById = {};
  for (const nick of nicknames) {
    usersById[users[nick].id] = { nickname: nick, token: users[nick].token };
  }
  if (nicknames.length === 0) {
    console.error('No users logged in from', CREDENTIALS_PATH);
    return;
  }

  // Ensure we have an admin token (prefer nickname 'admin')
  const adminNick = nicknames.includes('admin') ? 'admin' : nicknames[0];
  const admin = users[adminNick];
  if (!admin) {
    console.error('No admin user available');
    return;
  }

  console.log(`${nowTag()} Starting tournament run: ${NUM_TOURNAMENTS} tournaments`);

  // Get user's tournaments to count existing "Auto Tournament" entries
  let nextTournamentNumber = 1;
  try {
    const resp = await httpRequest('GET', '/api/tournaments/my', admin.token);
    if (resp.statusCode === 200 && Array.isArray(resp.body)) {
      const autoTournaments = resp.body.filter(t => t.name && t.name.startsWith('Auto Tournament'));
      nextTournamentNumber = autoTournaments.length + 1;
      console.log(`${nowTag()} Found ${autoTournaments.length} existing Auto Tournaments, starting from number ${nextTournamentNumber}`);
    }
  } catch (err) {
    console.error('Error fetching user tournaments:', err);
  }

  for (let t = 0; t < NUM_TOURNAMENTS; t++) {
    const currentTournamentNumber = nextTournamentNumber;
    nextTournamentNumber++;

    const tourName = `Auto Tournament ${currentTournamentNumber}`;
    const tourDesc = `Automated elimination test`;
    const maxParticipants = randInt(MIN_PLAYERS, MAX_PLAYERS);
    const generalRounds = Math.ceil(Math.log2(maxParticipants)) || 1;

    const log = makeLogWriter(`tournament_${currentTournamentNumber}`, tourName);
    log.append(`${nowTag()} ACTION: create_tournament name=${tourName} max_participants=${maxParticipants} general_rounds=${generalRounds}`);

    // Create tournament as admin
    let tournament = null;
    try {
      const resp = await httpRequest('POST', '/api/tournaments', admin.token, {
        name: tourName,
        description: tourDesc,
        tournament_type: 'elimination',
        max_participants: maxParticipants,
        round_duration_days: 1,
        auto_advance_round: true,
        general_rounds: generalRounds,
        general_rounds_format: 'bo3',
        final_rounds: 0,
        final_rounds_format: 'bo5'
      });
      if (resp.statusCode === 201 && resp.body && resp.body.id) {
        tournament = { id: resp.body.id };
        log.append(`${nowTag()} RESULT: SUCCESS create_tournament id=${tournament.id}`);
      } else {
        log.append(`${nowTag()} RESULT: ERROR create_tournament status=${resp.statusCode} body=${JSON.stringify(resp.body)}`);
        continue;
      }
    } catch (err) {
      log.append(`${nowTag()} RESULT: ERROR create_tournament exception=${String(err)}`);
      continue;
    }

    // Choose participants
    const numPlayers = Math.min(maxParticipants, Math.max(MIN_PLAYERS, randInt(MIN_PLAYERS, maxParticipants)));
    const shuffledNicks = [...nicknames].sort(() => Math.random() - 0.5);
    const selected = shuffledNicks.slice(0, numPlayers);
    log.append(`${nowTag()} ACTION: selected_participants count=${selected.length} list=${selected.join('|')}`);

    // Request join as each selected player (use request-join to exercise approval flow)
    for (const nick of selected) {
      const u = users[nick];
      try {
        const r = await httpRequest('POST', `/api/tournaments/${tournament.id}/request-join`, u.token, {});
        if (r.statusCode === 201) {
          log.append(`${nowTag()} RESULT: SUCCESS request_join user=${nick} participant_id=${r.body && r.body.id}`);
        } else {
          log.append(`${nowTag()} RESULT: ERROR request_join user=${nick} status=${r.statusCode} body=${JSON.stringify(r.body)}`);
        }
      } catch (err) {
        log.append(`${nowTag()} RESULT: ERROR request_join user=${nick} exception=${String(err)}`);
      }
      await new Promise(r => setTimeout(r, randInt(100, 300)));
    }

    // Fetch participants (public endpoint) and accept/reject as organizer
    try {
      // public participants endpoint is mounted under /api/public
      const parts = await httpRequest('GET', `/api/public/tournaments/${tournament.id}/participants`, admin.token);
      if (parts.statusCode === 200 && Array.isArray(parts.body)) {
        for (const p of parts.body) {
          if (p.participation_status === 'pending') {
            const accept = Math.random() < APPROVAL_PROB;
            const endpoint = accept ? 'accept' : 'reject';
            try {
              const res = await httpRequest('POST', `/api/tournaments/${tournament.id}/participants/${p.id}/${endpoint}`, admin.token, {});
              log.append(`${nowTag()} RESULT: ${endpoint.toUpperCase()} participant_id=${p.id} user_id=${p.user_id} status=${res.statusCode}`);
            } catch (err) {
              log.append(`${nowTag()} RESULT: ERROR ${endpoint} participant_id=${p.id} exception=${String(err)}`);
            }
            await new Promise(r => setTimeout(r, randInt(50, 200)));
          }
        }
      } else {
        log.append(`${nowTag()} RESULT: ERROR fetch_participants status=${parts.statusCode}`);
      }
    } catch (err) {
      log.append(`${nowTag()} RESULT: ERROR fetch_participants exception=${String(err)}`);
    }

    // Ensure enough accepted participants: if not enough, request join with other users and accept until met
    try {
      const partsAfter = await httpRequest('GET', `/api/public/tournaments/${tournament.id}/participants`, admin.token);
      let acceptedCount = 0;
      const pendingUserIds = new Set();
      if (partsAfter.statusCode === 200 && Array.isArray(partsAfter.body)) {
        for (const p of partsAfter.body) {
          if (p.participation_status === 'accepted') acceptedCount++;
          if (p.participation_status === 'pending') pendingUserIds.add(p.user_id);
        }
      }

      const required = numPlayers;
      const alreadySelected = new Set(selected);
      // find extra users not already involved
      const remainingNicks = Object.keys(users).filter(n => !alreadySelected.has(n));
      let idx = 0;
      while (acceptedCount < required && idx < remainingNicks.length) {
        const nick = remainingNicks[idx++];
        const u = users[nick];
        // request join
        try {
          const r = await httpRequest('POST', `/api/tournaments/${tournament.id}/request-join`, u.token, {});
          if (r.statusCode === 201 && r.body && r.body.id) {
            const participantId = r.body.id;
            log.append(`${nowTag()} ACTION: extra_request_join user=${nick} participant_id=${participantId}`);
            // accept as organizer
            try {
              const a = await httpRequest('POST', `/api/tournaments/${tournament.id}/participants/${participantId}/accept`, admin.token, {});
              if (a.statusCode === 200) {
                acceptedCount++;
                log.append(`${nowTag()} RESULT: EXTRA ACCEPT participant_id=${participantId} user=${nick} status=${a.statusCode}`);
              } else {
                log.append(`${nowTag()} RESULT: EXTRA ACCEPT FAILED participant_id=${participantId} user=${nick} status=${a.statusCode}`);
              }
            } catch (ae) {
              log.append(`${nowTag()} RESULT: ERROR extra_accept participant_id=${participantId} exception=${String(ae)}`);
            }
          } else {
            log.append(`${nowTag()} RESULT: ERROR extra_request_join user=${nick} status=${r.statusCode}`);
          }
        } catch (err) {
          log.append(`${nowTag()} RESULT: ERROR extra_request_join exception=${String(err)}`);
        }
        await new Promise(r => setTimeout(r, randInt(100, 300)));
      }

      if (acceptedCount < required) {
        log.append(`${nowTag()} WARN: required participants=${required} but accepted=${acceptedCount} (insufficient, will proceed but tournament start may fail)`);
      } else {
        log.append(`${nowTag()} INFO: accepted participants now=${acceptedCount}`);
      }
    } catch (err) {
      log.append(`${nowTag()} ERROR verifying accepted participants: ${String(err)}`);
    }

    // HARD CHECK: ensure accepted >= required before proceeding
    let finalAcceptedCount = 0;
    try {
      const finalParts = await httpRequest('GET', `/api/public/tournaments/${tournament.id}/participants`, admin.token);
      if (finalParts.statusCode === 200 && Array.isArray(finalParts.body)) {
        finalAcceptedCount = finalParts.body.filter(p => p.participation_status === 'accepted').length;
      }
    } catch (err) {
      log.append(`${nowTag()} ERROR final accepted count check: ${String(err)}`);
    }

    if (finalAcceptedCount < numPlayers) {
      log.append(`${nowTag()} FATAL: accepted participants (${finalAcceptedCount}) < required (${numPlayers}), skipping start/play for this tournament`);
      log.append(`${nowTag()} TOURNAMENT ${tournament.id} LOG_COMPLETED`);
      continue; // Skip to next tournament
    }

    // Organizer may set the tournament start time (optional) before preparing
    try {
      const startAt = new Date(Date.now() + 1000 * 60).toISOString(); // start in 1 minute
      const upd = await httpRequest('PUT', `/api/tournaments/${tournament.id}`, admin.token, { started_at: startAt });
      log.append(`${nowTag()} ACTION: organizer_set_started_at status=${upd.statusCode}`);
    } catch (err) {
      log.append(`${nowTag()} RESULT: ERROR setting started_at exception=${String(err)}`);
    }

    // Close registration
    try {
      const resp = await httpRequest('POST', `/api/tournaments/${tournament.id}/close-registration`, admin.token, {});
      log.append(`${nowTag()} ACTION: close_registration status=${resp.statusCode}`);
    } catch (err) {
      log.append(`${nowTag()} RESULT: ERROR close_registration exception=${String(err)}`);
    }

    // Prepare
    try {
      const resp = await httpRequest('POST', `/api/tournaments/${tournament.id}/prepare`, admin.token, {});
      log.append(`${nowTag()} ACTION: prepare status=${resp.statusCode}`);
    } catch (err) {
      log.append(`${nowTag()} RESULT: ERROR prepare exception=${String(err)}`);
    }

    // Start
    try {
      const resp = await httpRequest('POST', `/api/tournaments/${tournament.id}/start`, admin.token, {});
      log.append(`${nowTag()} ACTION: start status=${resp.statusCode}`);
    } catch (err) {
      log.append(`${nowTag()} RESULT: ERROR start exception=${String(err)}`);
    }

    // Play available matches until tournament finished or no progress
    let noProgressCount = 0;
    const maxNoProgress = 8;
    const maxLoops = 200;
    let loops = 0;
    let lastActivatedRound = -1; // Track last activated round to avoid duplicates

    while (loops++ < maxLoops) {
      // Get tournament state
      let tourState = null;
      try {
        const tr = await httpRequest('GET', `/api/tournaments/${tournament.id}`, admin.token);
        if (tr.statusCode === 200) tourState = tr.body;
      } catch (err) {
        log.append(`${nowTag()} ERROR fetching tournament state: ${String(err)}`);
      }

      if (tourState && tourState.status === 'finished') {
        log.append(`${nowTag()} INFO: tournament finished status=${tourState.status}`);
        break;
      }

      // Fetch all tournament matches
      let matches = [];
      try {
        const m = await httpRequest('GET', `/api/tournaments/${tournament.id}/matches`, admin.token);
        if (m.statusCode === 200 && Array.isArray(m.body)) matches = m.body;
      } catch (err) {
        log.append(`${nowTag()} ERROR fetching tournament matches: ${String(err)}`);
      }

      let didWork = false;
      for (const tm of matches) {
        if (tm.match_status === 'completed') continue;
        if (!tm.player1_id || !tm.player2_id) {
          // bye or incomplete pairing
          log.append(`${nowTag()} INFO: skipping incomplete match tm_id=${tm.id}`);
          continue;
        }

        // Pick winner randomly
        const winnerId = Math.random() < 0.5 ? tm.player1_id : tm.player2_id;
        const loserId = winnerId === tm.player1_id ? tm.player2_id : tm.player1_id;
        const winnerData = usersById[winnerId];
        const loserData = usersById[loserId];

        if (!winnerData || !loserData) {
          log.append(`${nowTag()} WARN: missing user data for players tm_id=${tm.id} winner_found=${!!winnerData} loser_found=${!!loserData}`);
          continue;
        }

        const winnerToken = winnerData.token;
        const loserToken = loserData.token;

        // Report a match as winner
        try {
          const reportBody = {
            opponent_id: loserId,
            map: 'AutoMap',
            winner_faction: 'Human',
            loser_faction: 'Orc',
            comments: 'Auto-played match',
            rating: 3,
            tournament_id: tournament.id,
            tournament_match_id: tm.id
          };
          const rep = await httpRequest('POST', '/api/matches/report-json', winnerToken, reportBody);
          if (rep.statusCode === 201 && rep.body && rep.body.id) {
            const reportedMatchId = rep.body.id;
            log.append(`${nowTag()} RESULT: match_reported tm_id=${tm.id} reported_id=${reportedMatchId} winner=${winnerId}`);
            log.append(`${nowTag()} DEBUG: Report response: ${JSON.stringify(rep.body)}`);

            // Link to tournament match
            try {
              const link = await httpRequest('POST', `/api/tournaments/${tournament.id}/matches/${tm.id}/result`, winnerToken, { winner_id: winnerId, reported_match_id: reportedMatchId });
              log.append(`${nowTag()} DEBUG: Link response status=${link.statusCode} body=${JSON.stringify(link.body)}`);
              if (link.statusCode !== 200) {
                log.append(`${nowTag()} ERROR linking reported match tm_id=${tm.id} status=${link.statusCode} body=${JSON.stringify(link.body)}`);
              } else {
                log.append(`${nowTag()} RESULT: tournament_record tm_id=${tm.id} status=${link.statusCode}`);
              }
            } catch (err) {
              log.append(`${nowTag()} ERROR linking reported match tm_id=${tm.id} exception=${String(err)}`);
            }

            // Loser confirms or disputes
            const action = Math.random() < DISPUTE_PROB ? 'dispute' : 'confirm';
            try {
              const c = await httpRequest('POST', `/api/matches/${reportedMatchId}/confirm`, loserToken, { action, comments: 'Auto response', rating: 3 });
              log.append(`${nowTag()} RESULT: loser_action match=${reportedMatchId} action=${action} status=${c.statusCode}`);
            } catch (err) {
              log.append(`${nowTag()} ERROR loser_action match=${reportedMatchId} exception=${String(err)}`);
            }

            // If disputed, allow admin to resolve randomly
            if (Math.random() < 0.5 && Math.random() < DISPUTE_PROB) {
              try {
                const adminAction = Math.random() < 0.5 ? 'validate' : 'reject';
                const adm = await httpRequest('POST', `/api/matches/admin/${reportedMatchId}/dispute`, admin.token, { action: adminAction });
                log.append(`${nowTag()} ACTION: admin_resolve match=${reportedMatchId} action=${adminAction} status=${adm.statusCode}`);
              } catch (err) {
                log.append(`${nowTag()} ERROR admin_resolve match=${reportedMatchId} exception=${String(err)}`);
              }
            }

            didWork = true;
            // small pause
            await new Promise(r => setTimeout(r, randInt(100, 400)));
          } else {
            log.append(`${nowTag()} ERROR: report failed tm_id=${tm.id} status=${rep.statusCode} body=${JSON.stringify(rep.body)}`);
          }
        } catch (err) {
          log.append(`${nowTag()} ERROR reporting match tm_id=${tm.id} exception=${String(err)}`);
        }
      }

      // Check if current round is completed and activate next round (only once per completed round)
      try {
        const roundsRes = await httpRequest('GET', `/api/tournaments/${tournament.id}/rounds`, admin.token);
        if (roundsRes.statusCode === 200 && Array.isArray(roundsRes.body)) {
          const rounds = roundsRes.body;
          // Find completed round
          const completedRound = rounds.find(r => r.round_status === 'completed');
          const pendingRound = rounds.find(r => r.round_status === 'pending');
          
          // Only activate if we haven't already activated this completed round
          if (completedRound && pendingRound && completedRound.round_number !== lastActivatedRound) {
            log.append(`${nowTag()} INFO: round ${completedRound.round_number} completed, activating next round`);
            const nextRoundRes = await httpRequest('POST', `/api/tournaments/${tournament.id}/next-round`, admin.token, {});
            if (nextRoundRes.statusCode === 200) {
              log.append(`${nowTag()} RESULT: next_round activated status=200`);
              lastActivatedRound = completedRound.round_number; // Mark this round as processed
            } else {
              log.append(`${nowTag()} WARN: next_round activation failed status=${nextRoundRes.statusCode}`);
            }
          }
        }
      } catch (err) {
        log.append(`${nowTag()} ERROR checking rounds for completion: ${String(err)}`);
      }

      if (!didWork) noProgressCount++; else noProgressCount = 0;
      if (noProgressCount >= maxNoProgress) {
        log.append(`${nowTag()} INFO: no progress detected, stopping play loop`);
        break;
      }

      // wait a bit for backend to create next round or update series
      await new Promise(r => setTimeout(r, 1000));
    }

    // After play loop, fetch final ranking for tournament
    try {
      const ranking = await httpRequest('GET', `/api/tournaments/${tournament.id}/ranking`, admin.token);
      if (ranking.statusCode === 200) {
        log.append(`${nowTag()} FINAL_RANKING count=${Array.isArray(ranking.body) ? ranking.body.length : 0}`);
        if (Array.isArray(ranking.body)) {
          ranking.body.forEach((r, idx) => log.append(`${nowTag()} RANK,${idx+1},user_id=${r.user_id},nickname=${r.nickname},elo=${r.elo_rating}`));
        }
      } else {
        log.append(`${nowTag()} WARN: ranking endpoint returned ${ranking.statusCode}, skipping final ranking`);
      }
    } catch (err) {
      log.append(`${nowTag()} WARN: error fetching final ranking: ${String(err)}`);
    }

    log.append(`${nowTag()} TOURNAMENT ${tournament.id} LOG_COMPLETED`);
    console.log(`${nowTag()} Completed tournament ${t + 1}/${NUM_TOURNAMENTS} id=${tournament.id}`);
  }

  console.log(`${nowTag()} All tournaments processed`);
}

main().catch(err => console.error('Runner error:', err));
