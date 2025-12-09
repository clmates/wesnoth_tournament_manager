const http = require('http');

function httpRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' },
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
        try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { }
        resolve({ statusCode: res.statusCode, body: parsed, raw });
      });
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  try {
    // Login as admin
    const login = await httpRequest('POST', '/api/auth/login', null, { nickname: 'admin', password: 'test123' });
    if (login.statusCode !== 200) {
      console.error('Login failed');
      return;
    }
    
    const token = login.body.token;
    console.log('✓ Admin logged in\n');
    
    // Get the most recent Auto Tournament
    const myTournaments = await httpRequest('GET', '/api/tournaments/my', token);
    const autoTournaments = myTournaments.body.filter(t => t.name && t.name.startsWith('Auto'));
    const tournament = autoTournaments[0];
    
    if (!tournament) {
      console.error('No Auto Tournament found');
      return;
    }
    
    console.log(`Found tournament: ${tournament.name} (id: ${tournament.id})`);
    console.log(`Tournament status: ${tournament.status}\n`);
    
    // Try to start it
    console.log('Attempting to START tournament...\n');
    const resp = await httpRequest('POST', `/api/tournaments/${tournament.id}/start`, token, {});
    
    console.log('Response Status:', resp.statusCode);
    console.log('Response Body:', JSON.stringify(resp.body, null, 2));
    if (resp.raw) {
      console.log('Raw Response:', resp.raw);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
