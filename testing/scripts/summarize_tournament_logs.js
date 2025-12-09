/*
Summarize tournament logs produced by `run_tournament_api_test.js`.

Produces CSV `testing/results/tournament_summary_<timestamp>.csv` with columns:
 tournament_id, log_file, actions_success, actions_error, info_count, warnings, final_players, final_winner

Run: node summarize_tournament_logs.js [optional-log-filename]
*/

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', 'results');
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

function timestampNow() { return new Date().toISOString().replace(/[:.]/g,'-'); }

function parseLogFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const summary = {
    tournament_id: null,
    log_file: path.basename(filePath),
    actions_success: 0,
    actions_error: 0,
    info_count: 0,
    warnings: 0,
    final_players: 0,
    final_winner: ''
  };

  for (const l of lines) {
    if (l.includes('TOURNAMENT') && l.includes('LOG_STARTED')) {
      const m = l.match(/TOURNAMENT\s+(\S+)\s+NAME:(.*)\s+LOG_STARTED/);
      if (m) summary.tournament_id = m[1];
    }
    if (l.includes('RESULT: SUCCESS')) summary.actions_success++;
    if (l.includes('RESULT: ERROR')) summary.actions_error++;
    if (l.includes(' ERROR')) summary.actions_error++;
    if (l.includes('INFO:')) summary.info_count++;
    if (l.includes('WARN:') || l.includes('WARN')) summary.warnings++;
    if (l.includes(' RANK,')) summary.final_players++;
    // parse top-1 winner line
    if (l.includes('RANK,1,')) {
      const mm = l.match(/user_id=(\S+),nickname=(.*),elo=(\d+)/);
      if (mm) summary.final_winner = mm[2];
    }
  }

  return summary;
}

function safeQuote(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function writeCSV(rows) {
  const outFile = path.join(RESULTS_DIR, `tournament_summary_${timestampNow()}.csv`);
  const header = ['tournament_id','log_file','actions_success','actions_error','info_count','warnings','final_players','final_winner'].join(',');
  const lines = [header];
  for (const r of rows) {
    const row = [r.tournament_id || '', r.log_file || '', r.actions_success, r.actions_error, r.info_count, r.warnings, r.final_players, r.final_winner];
    lines.push(row.map(safeQuote).join(','));
  }
  fs.writeFileSync(outFile, lines.join('\n'));
  return outFile;
}

function findLogFiles(target) {
  if (target) {
    const p = path.join(RESULTS_DIR, target);
    if (fs.existsSync(p)) return [p];
    console.error('Specified log not found:', p);
    return [];
  }
  const all = fs.readdirSync(RESULTS_DIR).filter(f => /^tournament_.*\.log$/.test(f));
  return all.map(f => path.join(RESULTS_DIR, f));
}

function main() {
  const arg = process.argv[2];
  const files = findLogFiles(arg);
  if (files.length === 0) {
    console.error('No tournament logs found in', RESULTS_DIR);
    return;
  }
  const rows = [];
  for (const f of files) {
    try {
      const s = parseLogFile(f);
      rows.push(s);
    } catch (err) {
      console.error('Failed to parse', f, err);
    }
  }

  const out = writeCSV(rows);
  console.log('Wrote summary CSV:', out);
}

main();
