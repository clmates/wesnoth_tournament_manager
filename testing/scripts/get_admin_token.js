#!/usr/bin/env node
/**
 * get_admin_token.js
 * Simple script to login as admin and return the JWT token
 * Usage: node get_admin_token.js
 */

const http = require('http');

const API_HOST = 'localhost';
const API_PORT = 3000;
const ADMIN_NICKNAME = 'admin';
const ADMIN_PASSWORD = 'test123';

function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
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

async function main() {
  try {
    console.log(`Logging in as admin (${ADMIN_NICKNAME})...`);

    // Login
    const loginRes = await httpRequest('POST', '/api/auth/login', {
      nickname: ADMIN_NICKNAME,
      password: ADMIN_PASSWORD,
    });

    if (loginRes.status !== 200) {
      console.error('Login failed:', loginRes.data);
      process.exit(1);
    }

    const token = loginRes.data.token;
    console.log(`\n✅ Admin token obtained:\n`);
    console.log(token);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
