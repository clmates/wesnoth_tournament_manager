#!/usr/bin/env node

/**
 * Victory Detection Analysis
 * Shows all methods used to detect the winner of a Wesnoth replay
 */

const fs = require('fs');
const path = require('path');

const replayPath = '/home/clmates/wesnoth_tournament_manager/2p__Hamlets_Turn_21_(91653)';

if (!fs.existsSync(replayPath)) {
    console.error('ERROR: Replay file not found:', replayPath);
    process.exit(1);
}

console.log('🏆 VICTORY DETECTION ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');

const wmlText = fs.readFileSync(replayPath, 'utf-8');

// PRIORITY 1: Check for explicit endlevel result
console.log('1️⃣  EXPLICIT ENDLEVEL (Highest Confidence)');
console.log('───────────────────────────────────────────');
const endlevelMatch = wmlText.match(/\[endlevel\]([\s\S]*?)\[\/endlevel\]/);
if (endlevelMatch) {
    const endlevelContent = endlevelMatch[1];
    const resultMatch = endlevelContent.match(/result\s*=\s*"([^"]+)"/);
    const sideMatch = endlevelContent.match(/side\s*=\s*"?(\d+)"?/);
    
    const result = resultMatch ? resultMatch[1] : 'unknown';
    const side = sideMatch ? sideMatch[1] : 'unknown';
    
    console.log(`✓ FOUND: result="${result}" side="${side}"`);
    console.log(`  → Victory Type: ${result.toUpperCase()}`);
    if (result === 'victory') {
        console.log(`  → Winner: Side ${side}`);
    } else if (result === 'resign') {
        console.log(`  → Loser: Side ${side} (winner is opposite side)`);
    }
    console.log(`  Confidence: HIGH (Auto-report)`);
} else {
    console.log('✗ NOT FOUND: No [endlevel] block in replay');
    console.log('  Replay may be incomplete or ongoing');
}

console.log('');
console.log('2️⃣  RESIGNATION (High Confidence)');
console.log('───────────────────────────────────────────');

// Check for resign actions
const resignMatch = wmlText.match(/\[resign\]([\s\S]*?)\[\/resign\]/);
if (resignMatch) {
    console.log(`✓ FOUND: [resign] block detected`);
    // Extract side info if available
    const resignContent = resignMatch[1];
    const sideMatch = resignContent.match(/side\s*=\s*"?(\d+)"?/);
    if (sideMatch) {
        console.log(`  → Resigning side: ${sideMatch[1]}`);
    }
    console.log(`  Confidence: HIGH (Player action)`);
} else {
    console.log('✗ NOT FOUND: No [resign] action');
}

console.log('');
console.log('3️⃣  SURRENDER (Medium Confidence)');
console.log('───────────────────────────────────────────');

// Look for surrender messages in [speak] blocks
let surrenderFound = false;
const commandMatches = wmlText.matchAll(/\[command\]([\s\S]*?)\[\/command\]/g);
for (const match of commandMatches) {
    const commandContent = match[1];
    const speakMatch = commandContent.match(/\[speak\]([\s\S]*?)\[\/speak\]/);
    if (speakMatch) {
        const speakContent = speakMatch[1];
        const messageMatch = speakContent.match(/message\s*=\s*"([^"]+)"/);
        if (messageMatch) {
            const message = messageMatch[1];
            if (message.includes('surrendered') || message.includes('Surrender')) {
                console.log(`✓ FOUND: "${message}"`);
                surrenderFound = true;
                break;
            }
        }
    }
}

if (!surrenderFound) {
    console.log('✗ NOT FOUND: No surrender messages in commands');
}

console.log('');
console.log('4️⃣  VICTORY CONDITIONS (Medium Confidence)');
console.log('───────────────────────────────────────────');

// Look for victory conditions in scenario
const scenarioMatch = wmlText.match(/\[scenario\]([\s\S]*?)\[\/scenario\]/);
let lastScenarioMatch = null;
const scenarioRegex = /\[scenario\]([\s\S]*?)\[\/scenario\]/g;
for (const match of wmlText.matchAll(scenarioRegex)) {
    lastScenarioMatch = match;
}

if (lastScenarioMatch) {
    const scenarioContent = lastScenarioMatch[1];
    const objectiveMatch = scenarioContent.match(/objective\s*=\s*"([^"]+)"/);
    if (objectiveMatch) {
        console.log(`✓ Objective: ${objectiveMatch[1]}`);
    }
    
    const victoryMatch = scenarioContent.match(/victory_when_enemies_defeated\s*=\s*"?yes"?/);
    if (victoryMatch) {
        console.log(`✓ Victory condition: Defeat all enemies`);
    }
} else {
    console.log('✗ No objective information');
}

console.log('');
console.log('5️⃣  FALLBACK: Default to First Player (Lowest Confidence)');
console.log('───────────────────────────────────────────');

// Get first side player
let firstPlayers = [];
const sideRegex = /\[side\]([\s\S]*?)\[\/side\]/g;
const sidesByNumber = new Map();

for (const match of wmlText.matchAll(sideRegex)) {
    const sideData = match[1];
    const sideNumMatch = sideData.match(/side\s*=\s*"?(\d+)"?/);
    const playerMatch = sideData.match(/current_player\s*=\s*"([^"]+)"/);
    
    const sideNum = sideNumMatch ? parseInt(sideNumMatch[1], 10) : 0;
    const playerName = playerMatch ? playerMatch[1] : 'Unknown';
    
    if (sideNum > 0) {
        sidesByNumber.set(sideNum, playerName);
    }
}

const firstPlayer = sidesByNumber.get(1) || 'Unknown';
console.log(`⚠  Fallback: Assume winner is Side 1`);
console.log(`   → Player: ${firstPlayer}`);
console.log(`   ⚠  Confidence: LOW (requires manual confirmation!)`);
console.log(`   ⚠  Used when: No specific victory condition found`);

console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('📋 SUMMARY FOR THIS REPLAY');
console.log('───────────────────────────────────────────');

// Determine what method will be used
let victoryMethod = 'UNKNOWN';
let confidence = 'LOW';

if (endlevelMatch) {
    const endlevelContent = endlevelMatch[1];
    const resultMatch = endlevelContent.match(/result\s*=\s*"([^"]+)"/);
    const result = resultMatch ? resultMatch[1] : '';
    
    if (result === 'victory' || result === 'resign') {
        victoryMethod = `Endlevel (${result})`;
        confidence = 'HIGH';
    }
} else if (resignMatch) {
    victoryMethod = 'Resign action';
    confidence = 'HIGH';
} else if (surrenderFound) {
    victoryMethod = 'Surrender message';
    confidence = 'MEDIUM';
} else {
    victoryMethod = 'FALLBACK (First player)';
    confidence = 'LOW - NEEDS MANUAL CONFIRMATION';
}

console.log(`Victory Detection Method: ${victoryMethod}`);
console.log(`Confidence Level: ${confidence}`);
console.log('');

if (confidence === 'LOW - NEEDS MANUAL CONFIRMATION') {
    console.log(`⚠️  WARNING: This replay has NO explicit victory condition!`);
    console.log(`   The match may be:
   • Incomplete (game disconnected/crashed)
   • Ongoing (not yet finished)
   • Using a custom victory condition not recognized by parser`);
    console.log('');
    console.log(`   Admin MUST manually verify the winner before confirming!`);
}

console.log('');
