#!/usr/bin/env node

/**
 * Verification script for Tournament Modes implementation
 * Checks that all files, migrations, and types are in place
 */

const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const results = {
  success: [],
  warnings: [],
  errors: [],
};

function checkFile(filePath, description) {
  const fullPath = path.join(baseDir, filePath);
  if (fs.existsSync(fullPath)) {
    results.success.push(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    results.errors.push(`❌ MISSING: ${description}: ${filePath}`);
    return false;
  }
}

function checkFileContains(filePath, searchString, description) {
  const fullPath = path.join(baseDir, filePath);
  if (!fs.existsSync(fullPath)) {
    results.errors.push(`❌ FILE NOT FOUND: ${filePath}`);
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  if (content.includes(searchString)) {
    results.success.push(`✅ ${description}`);
    return true;
  } else {
    results.warnings.push(`⚠️  ${description} - string not found`);
    return false;
  }
}

console.log('🔍 Verifying Tournament Modes Implementation...\n');

// Check SQL migration
console.log('📊 Checking SQL Migrations...');
checkFile(
  'backend/migrations/014_tournament_modes.sql',
  'SQL Migration for tournament modes'
);
checkFileContains(
  'backend/migrations/014_tournament_modes.sql',
  'tournament_type VARCHAR(20)',
  'tournament_type field in migration'
);
checkFileContains(
  'backend/migrations/014_tournament_modes.sql',
  'CREATE TABLE tournament_standings',
  'tournament_standings table'
);
checkFileContains(
  'backend/migrations/014_tournament_modes.sql',
  'CREATE TABLE swiss_pairings',
  'swiss_pairings table'
);
checkFileContains(
  'backend/migrations/014_tournament_modes.sql',
  'CREATE TABLE league_standings',
  'league_standings table'
);

// Check TypeScript types
console.log('\n📝 Checking TypeScript Types...');
checkFile(
  'backend/src/types/tournament.ts',
  'Tournament types file'
);
checkFileContains(
  'backend/src/types/tournament.ts',
  'export type TournamentType',
  'TournamentType type definition'
);
checkFileContains(
  'backend/src/types/tournament.ts',
  'export interface EliminationConfig',
  'EliminationConfig interface'
);
checkFileContains(
  'backend/src/types/tournament.ts',
  'export interface SwissConfig',
  'SwissConfig interface'
);
checkFileContains(
  'backend/src/types/tournament.ts',
  'export interface LeagueConfig',
  'LeagueConfig interface'
);

// Check Services
console.log('\n⚙️  Checking Services...');
checkFile(
  'backend/src/services/tournamentService.ts',
  'Tournament Service'
);
checkFileContains(
  'backend/src/services/tournamentService.ts',
  'getTournamentConfig',
  'getTournamentConfig method'
);
checkFileContains(
  'backend/src/services/tournamentService.ts',
  'createTournament',
  'createTournament method'
);
checkFileContains(
  'backend/src/services/tournamentService.ts',
  'getStandings',
  'getStandings method'
);
checkFileContains(
  'backend/src/services/tournamentService.ts',
  'getSuggestions',
  'getSuggestions method'
);

// Check Routes
console.log('\n🛣️  Checking API Routes...');
checkFile(
  'backend/src/routes/tournaments.ts',
  'Tournaments routes file'
);
checkFileContains(
  'backend/src/routes/tournaments.ts',
  "router.get('/:id/config'",
  "GET /:id/config endpoint"
);
checkFileContains(
  'backend/src/routes/tournaments.ts',
  "router.get('/suggestions/by-count'",
  "GET /suggestions/by-count endpoint"
);
checkFileContains(
  'backend/src/routes/tournaments.ts',
  "router.get('/:id/standings'",
  "GET /:id/standings endpoint"
);
checkFileContains(
  'backend/src/routes/tournaments.ts',
  "router.get('/:id/league-standings'",
  "GET /:id/league-standings endpoint"
);
checkFileContains(
  'backend/src/routes/tournaments.ts',
  "router.get('/:id/swiss-pairings'",
  "GET /:id/swiss-pairings endpoint"
);

// Check Documentation
console.log('\n📚 Checking Documentation...');
checkFile(
  'API_TOURNAMENT_MODES.md',
  'API Documentation'
);
checkFile(
  'IMPLEMENTATION_GUIDE.md',
  'Implementation Guide'
);
checkFile(
  'TOURNAMENT_MODES_PROPOSAL.md',
  'Tournament Modes Proposal'
);

// Print Results
console.log('\n' + '='.repeat(60));
console.log('📋 VERIFICATION RESULTS');
console.log('='.repeat(60) + '\n');

if (results.success.length > 0) {
  console.log(`✅ SUCCESS (${results.success.length}):`);
  results.success.forEach(item => console.log(`  ${item}`));
}

if (results.warnings.length > 0) {
  console.log(`\n⚠️  WARNINGS (${results.warnings.length}):`);
  results.warnings.forEach(item => console.log(`  ${item}`));
}

if (results.errors.length > 0) {
  console.log(`\n❌ ERRORS (${results.errors.length}):`);
  results.errors.forEach(item => console.log(`  ${item}`));
}

console.log('\n' + '='.repeat(60));

const total = results.success.length + results.warnings.length + results.errors.length;
const percentage = Math.round((results.success.length / total) * 100);

console.log(`\n📊 Status: ${percentage}% Complete (${results.success.length}/${total})`);

if (results.errors.length === 0) {
  console.log('✅ All critical files are in place!');
  console.log('\n🚀 Next Steps:');
  console.log('  1. Run SQL migration: mysql -u user -p db < backend/migrations/014_tournament_modes.sql');
  console.log('  2. Compile TypeScript: npm run build');
  console.log('  3. Restart server: npm restart');
  console.log('  4. Test endpoints using examples in API_TOURNAMENT_MODES.md');
  process.exit(0);
} else {
  console.log('❌ Some critical files are missing. Please review the errors above.');
  process.exit(1);
}
