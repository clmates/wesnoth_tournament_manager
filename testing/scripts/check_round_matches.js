const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Find the latest tournament log
const logsDir = path.join(__dirname, '../results');
const files = fs.readdirSync(logsDir).filter(f => f.startsWith('tournament_'));
const latestFile = files.sort().reverse()[0];
const logPath = path.join(logsDir, latestFile);

console.log('Reading log file:', latestFile);

const content = fs.readFileSync(logPath, 'utf-8');
const lines = content.split('\n');

// Extract tournament ID
let tournamentId;
for (const line of lines) {
  if (line.includes('RESULT: SUCCESS create_tournament')) {
    const match = line.match(/id=([a-f0-9\-]+)/);
    if (match) {
      tournamentId = match[1].trim();
      break;
    }
  }
}

if (!tournamentId) {
  console.log('Could not find tournament ID in log');
  console.log('Sample lines:');
  lines.slice(0, 20).forEach(l => console.log(l));
  process.exit(1);
}

console.log('Tournament ID:', tournamentId);
console.log('\nFetching round matches data...');

function fetchRoundMatches() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/tournaments/${tournamentId}/round-matches`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwYWJjZGVmIiwibmljayI6ImFkbWluMiIsImlhdCI6MTczMzc1MzIwNn0.EGR8SEkTvCmIaQXfAeNt7e6V5j1h49HFSE3iQXGGlD8`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('Round matches data:');
          console.log(JSON.stringify(parsed, null, 2));
          console.log(`\nTotal round matches: ${parsed.length}`);
          resolve();
        } catch (e) {
          console.error('Failed to parse JSON:', e.message);
          console.error('Response:', data);
          reject(e);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error fetching round matches:', error.message);
      reject(error);
    });

    req.end();
  });
}

fetchRoundMatches().catch(() => process.exit(1));
