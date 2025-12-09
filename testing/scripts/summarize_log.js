/*
Summarize log script
Usage:
  node summarize_log.js [path/to/logfile]
If no logfile is provided, the script picks the latest `api_test_run_*.log` in the `testing/results` folder.

Output: creates `testing/results/summary_by_action_<timestamp>.log` with a table of action vs SUCCESS/ERROR counts.
*/

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', 'results');
if (!fs.existsSync(RESULTS_DIR)) {
  console.error('Results directory not found:', RESULTS_DIR);
  process.exit(1);
}

function timestampNow() {
  const d = new Date();
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${YYYY}${MM}${DD}_${hh}${mm}${ss}`;
}

function findLatestLog() {
  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.startsWith('api_test_run_') && f.endsWith('.log'));
  if (files.length === 0) return null;
  files.sort();
  return path.join(RESULTS_DIR, files[files.length - 1]);
}

const inputPath = process.argv[2] || findLatestLog();
if (!inputPath) {
  console.error('No log file provided and no api_test_run_*.log found in', RESULTS_DIR);
  process.exit(1);
}

const absolutePath = path.isAbsolute(inputPath) ? inputPath : path.join(RESULTS_DIR, inputPath);
if (!fs.existsSync(absolutePath)) {
  console.error('Log file not found:', absolutePath);
  process.exit(1);
}

const raw = fs.readFileSync(absolutePath, 'utf8');
const lines = raw.split(/\r?\n/);

// Map action -> { success: n, error: n }
const stats = {};
let currentAction = 'unknown';
for (const line of lines) {
  if (!line || line.trim() === '') continue;
  const actionMatch = line.match(/ACTION:\s*([^\s,]+)/);
  if (actionMatch) {
    currentAction = actionMatch[1].trim();
    if (!stats[currentAction]) stats[currentAction] = { success: 0, error: 0 };
    continue;
  }
  const resultMatch = line.match(/RESULT:\s*(SUCCESS|ERROR)/);
  if (resultMatch) {
    const r = resultMatch[1];
    if (!stats[currentAction]) stats[currentAction] = { success: 0, error: 0 };
    if (r === 'SUCCESS') stats[currentAction].success++;
    else if (r === 'ERROR') stats[currentAction].error++;
    continue;
  }
}

// Build table lines
const actions = Object.keys(stats).sort();
let totalSuccess = 0;
let totalError = 0;
const rows = [];
rows.push(['Action', 'SUCCESS', 'ERROR']);
for (const a of actions) {
  const s = stats[a].success || 0;
  const e = stats[a].error || 0;
  rows.push([a, String(s), String(e)]);
  totalSuccess += s;
  totalError += e;
}
rows.push(['TOTAL', String(totalSuccess), String(totalError)]);

// Determine column widths
const colWidths = [];
for (let c = 0; c < rows[0].length; c++) {
  let w = 0;
  for (const r of rows) w = Math.max(w, r[c].length);
  colWidths.push(w);
}

function pad(s, w) { return s + ' '.repeat(w - s.length); }

const summaryName = `summary_by_action_${timestampNow()}.log`;
const summaryPath = path.join(RESULTS_DIR, summaryName);
const out = [];
out.push(`Log summarized: ${path.basename(absolutePath)}`);
out.push(`Generated: ${new Date().toISOString()}`);
out.push('');
// table header
let header = '';
for (let c = 0; c < rows[0].length; c++) {
  header += pad(rows[0][c], colWidths[c]) + (c === rows[0].length - 1 ? '' : ' | ');
}
out.push(header);
// separator
let sep = '';
for (let c = 0; c < rows[0].length; c++) {
  sep += '-'.repeat(colWidths[c]) + (c === rows[0].length - 1 ? '' : '-+-');
}
out.push(sep);
// data rows
for (let r = 1; r < rows.length; r++) {
  let line = '';
  for (let c = 0; c < rows[r].length; c++) {
    line += pad(rows[r][c], colWidths[c]) + (c === rows[r].length - 1 ? '' : ' | ');
  }
  out.push(line);
}

fs.writeFileSync(summaryPath, out.join('\n'));
console.log('Summary written to', summaryPath);

process.exit(0);
