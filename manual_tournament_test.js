#!/usr/bin/env node
/**
 * Manual Tournament Test - Step by step creation and testing
 */

const BASE_URL = 'http://localhost:3000';

// Admin token
const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZjFiOTJmYzktMTI0Mi00YzRhLTgwNWMtMzJlMjhhZDQzYTZlIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsImlhdCI6MTczMzc0OTkxN30.tPZcV0hLddbN0BNcXP3TQZc8ELM4jz1E_0bkHRCcjLI';

// Test users tokens (we'll need to login first)
let testUsersTokens = [];

async function makeRequest(method, endpoint, body = null, token = adminToken) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log(`\n[REQUEST] ${method} ${endpoint}`);
    if (body) {
      console.log(`[BODY]`, JSON.stringify(body, null, 2));
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();

    console.log(`[RESPONSE] Status: ${response.status}`);
    console.log(`[DATA]`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    throw error;
  }
}

async function loginUser(nickname, password) {
  try {
    console.log(`\n=== LOGIN: ${nickname} ===`);
    const response = await makeRequest('POST', '/api/auth/login', { nickname, password }, null);
    return response.token;
  } catch (error) {
    console.error(`Failed to login ${nickname}:`, error.message);
    return null;
  }
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║            MANUAL TOURNAMENT CREATION TEST                     ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    // Step 1: Login test users
    console.log('\n📝 STEP 1: Login test users');
    const users = [
      { nickname: 'test_user_01', password: 'test_user_01' },
      { nickname: 'test_user_02', password: 'test_user_02' },
      { nickname: 'test_user_03', password: 'test_user_03' },
      { nickname: 'test_user_04', password: 'test_user_04' },
      { nickname: 'test_user_05', password: 'test_user_05' },
      { nickname: 'test_user_06', password: 'test_user_06' },
      { nickname: 'test_user_07', password: 'test_user_07' },
      { nickname: 'test_user_08', password: 'test_user_08' }
    ];

    for (const user of users) {
      const token = await loginUser(user.nickname, user.password);
      if (token) {
        testUsersTokens.push({ ...user, token });
        console.log(`✓ ${user.nickname} logged in successfully`);
      } else {
        console.log(`✗ Failed to login ${user.nickname}`);
      }
    }

    console.log(`✓ Total users logged in: ${testUsersTokens.length}`);

    // Step 2: Create Swiss-Elimination Mix tournament
    console.log('\n🎮 STEP 2: Create Swiss-Elimination Mix tournament');
    const tournamentData = {
      name: 'Manual Test - Swiss-Elimination Mix',
      description: 'Manual test tournament with 2 Swiss rounds and 3 elimination rounds',
      tournament_type: 'swiss_elimination',
      max_participants: 8,
      round_duration_days: 1,
      auto_advance_round: true,
      general_rounds: 2,
      final_rounds: 3,
      general_rounds_format: 'bo1',
      final_rounds_format: 'bo1'
    };

    const tournamentResponse = await makeRequest('POST', '/api/tournaments', tournamentData, adminToken);
    const tournamentId = tournamentResponse.id;
    console.log(`✓ Tournament created: ${tournamentId}`);

    // Step 3: Enroll players
    console.log('\n👥 STEP 3: Enroll players');
    for (const user of testUsersTokens) {
      await makeRequest('POST', `/api/tournaments/${tournamentId}/join`, {}, user.token);
      console.log(`✓ ${user.nickname} enrolled`);
    }

    // Step 4: Accept all participants
    console.log('\n✅ STEP 4: Accept all participants');
    const participantsResponse = await makeRequest('GET', `/api/tournaments/${tournamentId}/participants`, null, adminToken);
    for (const participant of participantsResponse) {
      if (participant.participation_status !== 'accepted') {
        await makeRequest('POST', `/api/tournaments/${tournamentId}/participants/${participant.id}/accept`, {}, adminToken);
        console.log(`✓ ${participant.user_id} accepted`);
      }
    }

    // Step 5: Close registration
    console.log('\n🔒 STEP 5: Close registration');
    await makeRequest('POST', `/api/tournaments/${tournamentId}/close-registration`, {}, adminToken);
    console.log(`✓ Registration closed`);

    // Step 6: Prepare tournament
    console.log('\n⚙️  STEP 6: Prepare tournament');
    await makeRequest('POST', `/api/tournaments/${tournamentId}/prepare`, {}, adminToken);
    console.log(`✓ Tournament prepared`);

    // Step 7: Get rounds
    console.log('\n📋 STEP 7: Get rounds');
    const roundsResponse = await makeRequest('GET', `/api/tournaments/${tournamentId}/rounds`, null, adminToken);
    console.log(`✓ Got ${roundsResponse.length} rounds:`);
    roundsResponse.forEach(round => {
      console.log(`  - Round ${round.round_number}: ${round.round_phase_label || 'N/A'} [${round.round_classification || 'N/A'}]`);
    });

    // Step 8: Start tournament
    console.log('\n▶️  STEP 8: Start tournament');
    await makeRequest('POST', `/api/tournaments/${tournamentId}/start`, {}, adminToken);
    console.log(`✓ Tournament started`);

    // Step 9: Get matches for first round
    console.log('\n🎯 STEP 9: Get matches for first round');
    const firstRound = roundsResponse[0];
    const matchesResponse = await makeRequest('GET', `/api/tournaments/${tournamentId}/rounds/${firstRound.id}/matches`, null, adminToken);
    console.log(`✓ Got ${matchesResponse.length} matches for round 1`);

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║              ✓ MANUAL TEST COMPLETED SUCCESSFULLY              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

main();
