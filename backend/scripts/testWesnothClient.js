#!/usr/bin/env node

/**
 * Test script for Wesnoth Multiplayer Client
 * Tests the WML protocol implementation
 */

import { validateWesnothCredentials } from '../src/services/wesnothMultiplayerClient.js';

async function testWesnothLogin() {
  console.log('Testing Wesnoth Multiplayer Client...\n');

  // Test with invalid credentials
  console.log('Test 1: Invalid credentials');
  try {
    const result = await validateWesnothCredentials('testuser', 'invalidpassword');
    console.log('Result:', result);
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n---\n');

  // Test with valid credentials (if you have them)
  // Uncomment to test with real credentials:
  // console.log('Test 2: Valid credentials');
  // try {
  //   const result = await validateWesnothCredentials('username', 'password');
  //   console.log('Result:', result);
  // } catch (error) {
  //   console.error('Error:', error);
  // }
}

testWesnothLogin();
