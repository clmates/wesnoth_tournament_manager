#!/usr/bin/env node

/**
 * Test script to analyze the Hamlets replay for [side] deduplication
 * Reads the uncompressed replay file and shows how many sides are detected
 */

const fs = require('fs');
const path = require('path');

const replayPath = '/home/clmates/wesnoth_tournament_manager/2p__Hamlets_Turn_21_(91653)';

if (!fs.existsSync(replayPath)) {
    console.error('ERROR: Replay file not found:', replayPath);
    process.exit(1);
}

console.log('🔍 Analyzing replay:', path.basename(replayPath));
console.log('');

// Read file
const wmlText = fs.readFileSync(replayPath, 'utf-8');

// Count total [side] blocks
const sideRegex = /\[side\]([\s\S]*?)\[\/side\]/g;
let totalSideBlocks = 0;
const sidesByNumber = new Map();

for (const match of wmlText.matchAll(sideRegex)) {
    totalSideBlocks++;
    const content = match[1];
    
    // Extract side number
    const sideNumMatch = content.match(/side\s*=\s*"?(\d+)"?/);
    const sideNum = sideNumMatch ? parseInt(sideNumMatch[1], 10) : 0;
    
    // Extract player name
    const playerMatch = content.match(/current_player\s*=\s*"([^"]+)"/);
    const playerName = playerMatch ? playerMatch[1] : 'Unknown';
    
    // Extract faction
    const factionMatch = content.match(/faction_name\s*=\s*[_]?"([^"]+)"/);
    const faction = factionMatch ? factionMatch[1] : 'Unknown';
    
    // Extract color
    const colorMatch = content.match(/color\s*=\s*"([^"]+)"/);
    const color = colorMatch ? colorMatch[1] : 'Unknown';
    
    if (sideNum > 0) {
        if (!sidesByNumber.has(sideNum)) {
            sidesByNumber.set(sideNum, []);
        }
        sidesByNumber.get(sideNum).push({
            occurrence: sidesByNumber.get(sideNum).length + 1,
            player: playerName,
            faction,
            color
        });
    }
}

console.log(`📊 REPLAY ANALYSIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Total [side] blocks found: ${totalSideBlocks}`);
console.log(`Unique side numbers: ${sidesByNumber.size}`);
console.log('');

if (totalSideBlocks > sidesByNumber.size) {
    console.log(`⚠️  RELOAD DETECTED: ${totalSideBlocks} blocks for ${sidesByNumber.size} unique sides`);
    console.log('');
}

console.log('📋 SIDE DETAILS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

for (const [sideNum, occurrences] of sidesByNumber.entries()) {
    console.log(`\n  Side ${sideNum}:`);
    occurrences.forEach((occ, idx) => {
        const marker = idx === occurrences.length - 1 ? '✓ LATEST' : '(reload)';
        console.log(`    #${occ.occurrence}: ${occ.player} | ${occ.faction} | ${occ.color} ${marker}`);
    });
}

console.log('\n');
console.log('✅ AFTER DEDUPLICATION:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

for (const [sideNum, occurrences] of sidesByNumber.entries()) {
    const latest = occurrences[occurrences.length - 1];
    console.log(`  Side ${sideNum}: "${latest.player}" (${latest.faction})`);
}

console.log('\n');

// Check for scenario - take the LAST one (after reload)
let lastScenarioMatch = null;
const scenarioRegex = /\[scenario\]([\s\S]*?)\[\/scenario\]/g;
for (const match of wmlText.matchAll(scenarioRegex)) {
    lastScenarioMatch = match;
}

if (lastScenarioMatch) {
    const scenarioContent = lastScenarioMatch[1];
    const scenarioMatch2 = scenarioContent.match(/scenario\s*=\s*"([^"]+)"/);
    const mpNameMatch = scenarioContent.match(/mp_scenario_name\s*=\s*"([^"]+)"/);
    const nameMatch = scenarioContent.match(/name\s*=\s*"([^"]+)"/);
    
    let mapName = scenarioMatch2 
        ? scenarioMatch2[1] 
        : mpNameMatch 
            ? mpNameMatch[1] 
            : nameMatch 
                ? nameMatch[1] 
                : 'Unknown';
    
    // Clean up map name
    const rawMapName = mapName;
    mapName = mapName.replace(/^2p\s*[—-]\s*/i, '');
    mapName = mapName.replace(/^\d+p\s*[—-]\s*/i, '');
    
    console.log(`🗺️  Map: ${mapName}${rawMapName !== mapName ? ` (cleaned from "${rawMapName}")` : ''}`);
}

// Check for endlevel
const endlevelMatch = wmlText.match(/\[endlevel\]([\s\S]*?)\[\/endlevel\]/);
if (endlevelMatch) {
    const endlevelContent = endlevelMatch[1];
    const resultMatch = endlevelContent.match(/result\s*=\s*"([^"]+)"/);
    const sideMatch = endlevelContent.match(/side\s*=\s*"?(\d+)"?/);
    
    const result = resultMatch ? resultMatch[1] : 'unknown';
    const side = sideMatch ? sideMatch[1] : 'unknown';
    
    console.log(`🏆 Victory: ${result} (side ${side})`);
}

console.log('');
