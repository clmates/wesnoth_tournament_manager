const fs = require('fs');
const path = require('path');

// Instead, let's directly query via fetch to the API
const BASE_URL = 'http://localhost:3000';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYWU2YjA3YTItYzA1MS00OTRkLWJhZTQtZjI3MDNhYTUyYmQ5IiwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsImlhdCI6MTczMzc0OTkxN30.tPZcV0hLddbN0BNcXP3TQZc8ELM4jz1E_0bkHRCcjLI';

async function getTournamentInfo() {
  try {
    console.log('\n=== TOURNAMENT 48 INFO ===\n');
    
    const response = await fetch(`${BASE_URL}/api/tournaments/407289e5-9feb-4e75-b9bd-68f000eecafe`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Tournament:', data.name);
    console.log('Status:', data.status);
    console.log('Participants:', data.participants?.length || 0);
    
    if (data.participants) {
      console.log('\nParticipants Status:');
      data.participants.forEach(p => {
        console.log(`  ${p.nickname.padEnd(15)} | Status: ${p.status || 'N/A'} | Wins: ${p.tournament_wins || 0}, Losses: ${p.tournament_losses || 0}`);
      });
    }
    
    console.log('\n=== ROUNDS ===\n');
    if (data.rounds) {
      data.rounds.forEach(round => {
        console.log(`Round ${round.round_number}: ${round.round_status} (${round.round_matches?.length || 0} matches)`);
      });
    }
    
  } catch (err) {
    console.error('Error fetching tournament:', err.message);
  }
}

getTournamentInfo().then(() => process.exit(0));
