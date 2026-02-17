#!/usr/bin/env node

/**
 * Test script for phpBB authentication
 * Tests login functionality against phpBB database
 * 
 * Usage: npx tsx scripts/testPhpbbLogin.ts
 */

import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000/api';

async function testPhpbbLogin() {
  console.log('🧪 Testing phpBB Authentication\n');
  console.log(`📍 API Base URL: ${API_BASE_URL}\n`);

  // Test 1: Health check
  console.log('Test 1: Health check');
  try {
    const healthResponse = await axios.get(`http://localhost:3000/health`, {
      timeout: 5000
    });
    console.log(`✅ Backend is running (Status: ${healthResponse.status})\n`);
  } catch (error) {
    console.error('❌ Backend is not running');
    console.error(`   Make sure to run: npm run dev\n`);
    process.exit(1);
  }

  // Test 2: Login with invalid credentials
  console.log('Test 2: Login with invalid credentials');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'nonexistent_user_12345',
      password: 'definitely_wrong_password'
    });
    console.error('❌ Should have failed with invalid credentials');
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log(`✅ Correctly rejected invalid credentials (${error.response.data.error})\n`);
    } else {
      console.error(`❌ Unexpected error: ${error.message}\n`);
    }
  }

  // Test 3: Valid login (requires actual phpBB credentials)
  console.log('Test 3: Valid login');
  console.log('⚠️  To test valid login, provide phpBB credentials:');
  console.log('   - Username: Your phpBB forum username');
  console.log('   - Password: Your phpBB forum password\n');

  if (process.argv[2] && process.argv[3]) {
    const username = process.argv[2];
    const password = process.argv[3];

    console.log(`📧 Testing login with username: ${username}`);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        username,
        password
      });

      console.log('✅ Login successful!\n');
      console.log('Response:', {
        token: response.data.token ? `${response.data.token.substring(0, 20)}...` : 'N/A',
        username: response.data.username,
        userId: response.data.userId,
        email: response.data.email
      });
      console.log('\n📝 Token can be used in the Authorization header:');
      console.log('   Authorization: Bearer <token>\n');

      // Test 4: Validate token
      console.log('Test 4: Validate token');
      try {
        const validateResponse = await axios.get(`${API_BASE_URL}/auth/validate-token`, {
          headers: {
            Authorization: `Bearer ${response.data.token}`
          }
        });

        console.log('✅ Token validation successful!\n');
        console.log('User info:', {
          userId: validateResponse.data.userId,
          username: validateResponse.data.username,
          email: validateResponse.data.email,
          isAdmin: validateResponse.data.isAdmin
        });
      } catch (error: any) {
        console.error('❌ Token validation failed:', error.response?.data?.error || error.message);
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.error(`❌ Login failed: ${error.response.data.error}`);
        console.error('   Check your username and password\n');
      } else {
        console.error(`❌ Login error: ${error.message}\n`);
      }
    }
  } else {
    console.log('Usage with credentials:');
    console.log('  npx tsx scripts/testPhpbbLogin.ts <username> <password>\n');
    console.log('Example:');
    console.log('  npx tsx scripts/testPhpbbLogin.ts admin mypassword123\n');
  }

  console.log('✅ phpBB Authentication tests completed\n');
}

testPhpbbLogin().catch(console.error);
