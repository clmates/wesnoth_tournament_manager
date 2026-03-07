#!/usr/bin/env node
/**
 * recalculate_and_verify.js
 * 1. Login as admin and get token
 * 2. Call /admin/recalculate-all-stats endpoint
 * 3. Execute check_stats_integrity.js to verify results
 * 4. Compare and report findings
 */

const http = require('http');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const API_HOST = 'localhost';
const API_PORT = 3000;
const ADMIN_NICKNAME = 'admin';
const ADMIN_PASSWORD = '<password>';

function httpRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
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
    console.log('='.repeat(80));
    console.log('STEP 1: Getting admin token...');
    console.log('='.repeat(80));

    // Login
    const loginRes = await httpRequest('POST', '/api/auth/login', {
      nickname: ADMIN_NICKNAME,
      password: ADMIN_PASSWORD,
    });

    if (loginRes.status !== 200) {
      console.error('❌ Login failed:', loginRes.data);
      process.exit(1);
    }

    const adminToken = loginRes.data.token;
    console.log('✅ Admin token obtained');
    console.log('');

    // Call recalculate endpoint
    console.log('='.repeat(80));
    console.log('STEP 2: Calling /admin/recalculate-all-stats endpoint...');
    console.log('='.repeat(80));

    const recalcRes = await httpRequest(
      'POST',
      '/api/admin/recalculate-all-stats',
      {},
      { Authorization: `Bearer ${adminToken}` }
    );

    if (recalcRes.status !== 200) {
      console.error('❌ Recalculation failed:', recalcRes.data);
      process.exit(1);
    }

    console.log('✅ Recalculation completed');
    console.log(`   - Matches processed: ${recalcRes.data.matchesProcessed}`);
    console.log(`   - Users updated: ${recalcRes.data.usersUpdated}`);
    console.log('');

    // Execute integrity check
    console.log('='.repeat(80));
    console.log('STEP 3: Running integrity check...');
    console.log('='.repeat(80));
    console.log('');

    execSync('node check_stats_integrity.js', { 
      cwd: __dirname,
      stdio: 'inherit'
    });

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ PROCESS COMPLETED');
    console.log('='.repeat(80));
    console.log('');
    console.log('Summary:');
    console.log(`  1. Admin logged in successfully`);
    console.log(`  2. Recalculated stats for ${recalcRes.data.matchesProcessed} matches and ${recalcRes.data.usersUpdated} users`);
    console.log(`  3. Integrity check completed - check the CSV file in testing/results/`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
