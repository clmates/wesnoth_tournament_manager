#!/usr/bin/env node
/**
 * check_stats_integrity.js
 * Recompute ELO and basic stats by replaying all matches in chronological order
 * (skipping matches with final status 'cancelled'), without writing to the DB.
 * Then compare computed user stats with the current `users` table and print a report.
 *
 * Usage: node check_stats_integrity.js [--baseline=<number>] [--out=<path>] [--dburl=<DATABASE_URL>]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--baseline=')) args.baseline = Number(a.split('=')[1]);
    else if (a.startsWith('--out=')) args.out = a.split('=')[1];
    else if (a.startsWith('--dburl=')) args.dburl = a.split('=')[1];
  }
  return args;
}

const args = parseArgs();
const BASELINE = Number.isFinite(args.baseline) ? args.baseline : 1600;
const OUT_DIR = args.out ? path.resolve(args.out) : path.join(__dirname, '..', 'results');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT_FILE = path.join(OUT_DIR, `check_stats_integrity_${TIMESTAMP}.csv`);

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

let connectionString = args.dburl || process.env.DATABASE_URL;
if (!connectionString) {
  const host = process.env.PGHOST || 'localhost';
  const port = process.env.PGPORT || '5432';
  const user = process.env.PGUSER || 'postgres';
  const password = process.env.PGPASSWORD || 'postgres';
  const database = process.env.PGDATABASE || 'wesnoth_tournament';
  connectionString = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}
// Parse connectionString into PG env variables for psql
let envPG = Object.assign({}, process.env);
try {
  const url = new URL(connectionString);
  if (url.protocol.startsWith('postgres')) {
    envPG.PGUSER = url.username || envPG.PGUSER;
    envPG.PGPASSWORD = decodeURIComponent(url.password) || envPG.PGPASSWORD;
    envPG.PGHOST = url.hostname || envPG.PGHOST;
    envPG.PGPORT = url.port || envPG.PGPORT;
    envPG.PGDATABASE = url.pathname ? url.pathname.replace(/^\//, '') : envPG.PGDATABASE;
  }
} catch (e) {
  // ignore parse errors and rely on existing PG env vars
}

function calculateExpectedScore(playerRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

function getKFactor(playerRating, matchesPlayed) {
  if (playerRating === null || playerRating === 0) return 40;
  if (playerRating >= 2400) return 8;
  if (playerRating >= 2100) return 16;
  if (matchesPlayed >= 30) return 24;
  return 40;
}

function calculateNewRating(playerRating, opponentRating, result, matchesPlayed) {
  const k = getKFactor(playerRating, matchesPlayed);
  const expectedScore = calculateExpectedScore(playerRating || BASELINE, opponentRating);
  let actualScore = 0;
  if (result === 'win') actualScore = 1;
  else if (result === 'draw') actualScore = 0.5;
  const ratingChange = k * (actualScore - expectedScore);
  const newRating = (playerRating || BASELINE) + ratingChange;
  return Math.round(newRating);
}

function calculateTrend(currentTrend, isWin) {
  let currentCount = 0;
  let currentDirection = '';
  if (currentTrend && currentTrend !== '-') {
    if (currentTrend.startsWith('+')) {
      currentDirection = 'W';
      currentCount = parseInt(currentTrend.substring(1));
    } else if (currentTrend.startsWith('-') && currentTrend.length > 1) {
      currentDirection = 'L';
      currentCount = parseInt(currentTrend.substring(1));
    }
  }
  if (isWin) {
    if (currentDirection === 'W') return `+${currentCount + 1}`;
    return '+1';
  } else {
    if (currentDirection === 'L') return `-${currentCount + 1}`;
    return '-1';
  }
}

async function main() {
  const out = fs.createWriteStream(OUT_FILE, { flags: 'w' });
  function consoleLog(...parts) { console.log(...parts); }
  function writeCsvLine(line) { out.write(line + '\n'); }

  consoleLog('# check_stats_integrity');
  consoleLog('# connection:', connectionString.replace(/\:[^@]+@/, ':****@'));
  consoleLog(`# baseline rating: ${BASELINE}`);
  consoleLog('');

  // Helper to run a query via psql and return rows as array of objects (tab-separated)
  // Robust CSV parser for lines produced by COPY ... TO STDOUT WITH CSV
  function parseCSV(text) {
    const rows = [];
    let i = 0;
    const len = text.length;
    let row = [];
    let field = '';
    let inQuotes = false;
    while (i < len) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < len && text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        } else { field += ch; i++; continue; }
      }
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    // trailing
    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  }

  // Run a query via psql using COPY (...) TO STDOUT WITH CSV for robust output
  function runQuery(query) {
    const escaped = query.replace(/"/g, '\\"');
    const cmd = `psql "${connectionString}" -c "COPY (${escaped}) TO STDOUT WITH CSV"`;
    try {
      const outBuf = execSync(cmd, { encoding: 'utf8' });
      if (!outBuf) return [];
      // parse CSV output
      const rows = parseCSV(outBuf);
      // If first row is header-like (contains column names), we assume COPY didn't include header and continue
      return rows;
    } catch (err) {
      throw new Error(`psql query failed: ${err.message}`);
    }
  }

  // Load users (id,nickname)
  const usersRows2 = runQuery('SELECT id,nickname FROM users');
  const userState = new Map();
  for (const row of usersRows2) {
    const [id, nickname] = row;
    userState.set(String(id), { id: String(id), nickname: nickname, elo: BASELINE, matches_played: 0, total_wins: 0, total_losses: 0, trend: '-' });
  }

  // Load matches ordered by created_at
  const matchesRows = runQuery('SELECT id,winner_id,loser_id,status,created_at FROM matches ORDER BY created_at ASC,id ASC');

  consoleLog(`# matches to process: ${matchesRows.length}`);

  for (const parts of matchesRows) {
    const id = parts[0];
    const winnerId = parts[1];
    const loserId = parts[2];
    const status = parts[3] || 'unconfirmed';

    if (!userState.has(winnerId)) userState.set(winnerId, { id: winnerId, nickname: `user_${winnerId}`, elo: BASELINE, matches_played:0, total_wins:0, total_losses:0, trend: '-' });
    if (!userState.has(loserId)) userState.set(loserId, { id: loserId, nickname: `user_${loserId}`, elo: BASELINE, matches_played:0, total_wins:0, total_losses:0, trend: '-' });

    if (status === 'cancelled') continue;

    const winner = userState.get(winnerId);
    const loser = userState.get(loserId);
    const winnerNew = calculateNewRating(winner.elo, loser.elo, 'win', winner.matches_played);
    const loserNew = calculateNewRating(loser.elo, winner.elo, 'loss', loser.matches_played);
    winner.elo = winnerNew;
    loser.elo = loserNew;
    winner.matches_played += 1;
    loser.matches_played += 1;
    winner.total_wins += 1;
    loser.total_losses += 1;
    winner.trend = calculateTrend(winner.trend, true);
    loser.trend = calculateTrend(loser.trend, false);
  }

  // Fetch current DB user stats for comparison
  const curRows = runQuery("SELECT id,nickname,COALESCE(elo_rating,0),COALESCE(matches_played,0),COALESCE(total_wins,0),COALESCE(total_losses,0),COALESCE(trend,'-') FROM users");

  consoleLog('');
  consoleLog('# Comparison results (one row per user: STATUS, DB..., COMPUTED...)');
  // CSV header
  const header = [
    'STATUS', 'id', 'nickname',
    'db_elo', 'db_matches_played', 'db_total_wins', 'db_total_losses', 'db_trend',
    'computed_elo', 'computed_matches_played', 'computed_total_wins', 'computed_total_losses', 'computed_trend'
  ];
  writeCsvLine(header.join(','));

  let differing = 0;
  for (const row of curRows) {
    const [id, nicknameRaw, elo_s, mp_s, wins_s, losses_s, trend_s] = row;
    const nickname = nicknameRaw || '';
    const db = {
      elo: Number(elo_s || 0),
      matches_played: Number(mp_s || 0),
      total_wins: Number(wins_s || 0),
      total_losses: Number(losses_s || 0),
      trend: trend_s || '-'
    };
    const computed = userState.get(String(id)) || { elo: BASELINE, matches_played: 0, total_wins: 0, total_losses: 0, trend: '-' };

    const isDiff = (computed.elo !== db.elo) || (computed.matches_played !== db.matches_played) || (computed.total_wins !== db.total_wins) || (computed.total_losses !== db.total_losses) || ((computed.trend || '-') !== (db.trend || '-'));
    const status = isDiff ? 'DIFF' : 'OK';
    if (isDiff) differing += 1;

    // CSV-safe value function
    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const outRow = [
      status,
      id,
      esc(nickname),
      db.elo,
      db.matches_played,
      db.total_wins,
      db.total_losses,
      esc(db.trend),
      computed.elo,
      computed.matches_played,
      computed.total_wins,
      computed.total_losses,
      esc(computed.trend)
    ];
    writeCsvLine(outRow.join(','));
  }
  consoleLog('');
  consoleLog(`# users compared: ${curRows.length}`);
  consoleLog(`# users differing: ${differing}`);

  out.end();
  console.log('Report written to', OUT_FILE);
}

main().catch(err => {
  console.error('Error running integrity check:', err);
  process.exit(1);
});
