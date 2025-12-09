#!/usr/bin/env node

import axios from 'axios';

const API_URL = 'http://localhost:3000/api';
const TOKEN = process.env.ADMIN_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmMWI5MmZjOS0xMjQyLTRjNGEtODA1Yy0zMmUyOGFkNDM3OWUiLCJpYXQiOjE3MzEwMjAwNDYsImV4cCI6MTc0Njc3NzI0Nn0.khYdvWwMfRPZcmFVL2fUQCMkC8P-Nn6a6h0z84j-Bhg';

async function testNextRound(tournamentId) {
  try {
    console.log(`\n🔄 Testing next-round endpoint for tournament: ${tournamentId}`);
    console.log('='.repeat(80));

    const response = await axios.post(
      `${API_URL}/tournaments/${tournamentId}/next-round`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
        },
      }
    );

    console.log('✅ SUCCESS');
    console.log('Response:', response.data);
    console.log('='.repeat(80));
    return response.data;
  } catch (error) {
    console.error('❌ ERROR');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
    console.log('='.repeat(80));
    throw error;
  }
}

const tournamentId = process.argv[2];
if (!tournamentId) {
  console.error('Usage: node test_next_round.js <tournament_id>');
  process.exit(1);
}

await testNextRound(tournamentId);
