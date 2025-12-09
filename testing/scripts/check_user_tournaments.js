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
        resolve({ statusCode: res.statusCode, body: parsed });
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
      console.error('Login failed:', login.body);
      return;
    }
    
    const token = login.body.token;
    console.log('✓ Admin logged in\n');
    
    // Fetch user's tournaments
    const resp = await httpRequest('GET', '/api/tournaments/my', token);
    console.log('Status:', resp.statusCode);
    console.log('Total tournaments:', Array.isArray(resp.body) ? resp.body.length : 0);
    console.log('\nTournaments:');
    
    if (Array.isArray(resp.body)) {
      resp.body.forEach((t, idx) => {
        console.log(`${idx + 1}. ${t.name} (id: ${t.id})`);
      });
      
      // Count Auto Tournament entries
      const autoTournaments = resp.body.filter(t => t.name && t.name.startsWith('Auto Tournament'));
      console.log(`\n✓ Found ${autoTournaments.length} Auto Tournament entries`);
      console.log(`  Next number should be: ${autoTournaments.length + 1}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
