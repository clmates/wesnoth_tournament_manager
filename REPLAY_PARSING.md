The system automatically discovers, parses, and integrates Wesnoth game replays
into the tournament database. Two background jobs run in parallel:

`SyncGamesFromForumJob` Rune Every 60 s => Detects new games in the forum DB and queues them 
`ParseNewReplaysRefactorized` Runs Every 30 s => Parses queued replays and creates match records 


## Source Files

`backend/src/jobs/parseNewReplaysRefactored.ts`  Orchestrator — Steps 2–8, match creation 
`backend/src/utils/replayRankedParser.ts`  WML parser — ranked_mode, players/factions, surrender, leaderkill 
`backend/src/services/replayParser.ts` Map/scenario extraction from WML 


## Early Rejection During Parse

**File:** `backend/src/jobs/parseNewReplaysRefactored.ts`, lines 102–128

Before any forum queries, each dequeued replay is checked:

```typescript
// parseNewReplaysRefactored.ts:102–128

// Early exit: OOS replays are unreliable (game had sync errors)
if (replay.oos === 1) {
  if (replay.replay_filename.includes('Turn_1_')) {
    console.log(`[PARSE] OOS Turn_1 replay → Deleting`);
    await query(`DELETE FROM replays WHERE id = ?`, [replay.id]);
  } else {
    console.log(`[PARSE] OOS replay → Rejecting`);
    await query(
      `UPDATE replays SET parse_status = 'rejected', need_integration = 0, parsed = 1,
       parse_summary = ? WHERE id = ?`,
      [JSON.stringify({ matchType: 'rejected', reason: 'oos' }), replay.id]
    );
  }
  errorCount++;
  continue;
}

// Early exit: Turn_1 replays are too short to be valid — always delete
if (replay.replay_filename.includes('Turn_1_')) {
  console.log(`[PARSE] Turn_1 replay → Deleting (game too short)`);
  await query(`DELETE FROM replays WHERE id = ?`, [replay.id]);
  errorCount++;
  continue;
}
```

| Condition | Action |
|-----------|--------|
| `oos=1` + `Turn_1_` in filename | DELETE row |
| `oos=1` (not turn 1) | Set `parse_status='rejected'` |
| `Turn_1_` in filename (any OOS value) | DELETE row |


## WML Replay Parse

**File:** `backend/src/utils/replayRankedParser.ts`, entry point lines 92–174

The replay `.bz2` file is read from the local filesystem at:
```
/scratch/wesnothd-public-replays/{version}/{YYYY}/{MM}/{DD}/{filename}.bz2
```
A temporary copy is made in `.tmp/replays/`, parsed, then deleted.


### — `ranked_mode` and `tournament` Detection

**File:** `backend/src/utils/replayRankedParser.ts`, lines 308–381  
**Function:** `extractAddonConfig(wml)`

Searches three WML locations in priority order:

```typescript
// replayRankedParser.ts:308–381
function extractAddonConfig(wml: WmlNode): RankedAddonConfig {
  let rankedMode = false;
  let tournament = false;
  let tournamentName: string | undefined;

  // Strategy 1: Try [scenario] > [scenario_data]
  const scenario = wml.scenario as WmlNode | undefined;
  if (scenario) {
    const scenarioData = scenario['scenario_data'] as WmlNode | undefined;
    if (scenarioData) {
      rankedMode = scenarioData.ranked_mode === 'yes';
      tournament = scenarioData.tournament === 'yes';
      tournamentName = tournament
        ? (scenarioData.tournament_name as string | undefined)
        : undefined;
      return { ranked_mode: rankedMode, tournament, tournament_name: tournamentName };
    }
  }

  // Strategy 2: Try [carryover_sides_start] > [variables]  ← MOST COMMON
  // This is where addon state persists after turn 1 carryover
  const carryoverSidesStart = wml.carryover_sides_start as WmlNode | undefined;
  if (carryoverSidesStart) {
    const variables = carryoverSidesStart.variables as WmlNode | undefined;
    if (variables) {
      rankedMode = variables.ranked_mode === 'yes';
      tournament = variables.tournament === 'yes';
      tournamentName = tournament
        ? (variables.tournament_name as string | undefined)
        : undefined;
      if (rankedMode || tournament) {
        console.log(`[RANKED PARSE] Found addon config in [carryover_sides_start][variables]`);
        return { ranked_mode: rankedMode, tournament, tournament_name: tournamentName };
      }
    }
  }

  // Strategy 3: Try root-level scenario_data
  const rootScenarioData = wml['scenario_data'] as WmlNode | undefined;
  if (rootScenarioData) {
    rankedMode = rootScenarioData.ranked_mode === 'yes';
    tournament = rootScenarioData.tournament === 'yes';
    tournamentName = tournament
      ? (rootScenarioData.tournament_name as string | undefined)
      : undefined;
    return { ranked_mode: rankedMode, tournament, tournament_name: tournamentName };
  }

  // Fallback: No addon config found in WML.
  // The addon presence may have been confirmed at forum DB level but the
  // WML block is missing (e.g., game ended before addon state was written).
  console.warn('[RANKED PARSE] No addon config found in WML');
  return { ranked_mode: false, tournament: false, addon_found_at_forum: true };
}
```


### Player / Faction Extraction from WML

**File:** `backend/src/utils/replayRankedParser.ts`, lines 388–562  
**Function:** `extractPlayers(wml)`

Only used when the forum reported `"Custom"` factions, or as a fallback if forum data is missing.
Tries four locations in priority order:

```typescript
// replayRankedParser.ts:396–428 — Attempt 1: [old_sideN] at WML root level
// These blocks are written directly in the root by the Ranked addon
let foundOldSides = false;
for (let sideNum = 1; sideNum <= 10; sideNum++) {
  const oldSideKey = `old_side${sideNum}`;
  const oldSide = wml[oldSideKey] as WmlNode | undefined; // ROOT level, not inside [scenario]
  if (!oldSide) { if (sideNum > 1) break; continue; }
  foundOldSides = true;
  const playerName = (oldSide['current_player'] as string) || `Player${sideNum}`;
  const faction = (oldSide['faction'] as string) || (oldSide['faction_name'] as string) || 'Unknown';
  players.push({ side: sideNum, name: playerName, faction });
  console.log(`   [old_side${sideNum}] ${playerName} (${faction})`);
}
if (foundOldSides) return players;
```

```typescript
// replayRankedParser.ts:430–480 — Attempt 2: [carryover_sides_start][variables][old_sideN]
// This is where they are stored after turn 1 carryover
const carryoverSidesStart = wml.carryover_sides_start as WmlNode | WmlNode[] | undefined;
const carryoverArray = Array.isArray(carryoverSidesStart)
  ? carryoverSidesStart
  : [carryoverSidesStart];

for (const carryoverNode of carryoverArray) {
  if (!carryoverNode) continue;
  const variablesNode = carryoverNode.variables as WmlNode | WmlNode[] | undefined;
  const variablesArray = Array.isArray(variablesNode) ? variablesNode : [variablesNode];
  for (const variables of variablesArray) {
    if (!variables) continue;
    for (let sideNum = 1; sideNum <= 10; sideNum++) {
      const oldSide = variables[`old_side${sideNum}`] as WmlNode | undefined;
      if (!oldSide) { if (sideNum > 1) break; continue; }
      foundOldSides = true;
      players.push({ side: sideNum,
        name: (oldSide['current_player'] as string) || `Player${sideNum}`,
        faction: (oldSide['faction'] as string) || (oldSide['faction_name'] as string) || 'Unknown'
      });
    }
    if (foundOldSides) return players;
  }
}
```

```typescript
// replayRankedParser.ts:486–521 — Attempt 3: [old_sideN] inside [scenario]
const scenario = wml.scenario as WmlNode | undefined;
if (scenario) {
  for (let sideNum = 1; sideNum <= 10; sideNum++) {
    const oldSide = scenario[`old_side${sideNum}`] as WmlNode | undefined;
    if (!oldSide) { if (sideNum > 1) break; continue; }
    foundOldSides = true;
    players.push({ side: sideNum,
      name: (oldSide['current_player'] as string) || `Player${sideNum}`,
      faction: (oldSide['faction'] as string) || (oldSide['faction_name'] as string) || 'Unknown'
    });
  }
  if (foundOldSides) return players;
}
```

```typescript
// replayRankedParser.ts:523–558 — Attempt 4 (last resort): [side] sections inside [scenario]
const sides = scenario?.side as WmlNode | WmlNode[] | undefined;
if (!sides) return [];
const sideArray = Array.isArray(sides) ? sides : [sides];
for (const side of sideArray) {
  const sideNum = parseInt(side.side as string) || players.length + 1;
  const leader = side.leader as WmlNode | undefined;
  if (leader) {
    players.push({ side: sideNum,
      name: (leader.name as string) || `Player${sideNum}`,
      faction: leader.type as string | undefined
    });
  }
}
return players;
```


### — Surrender Detection

**File:** `backend/src/utils/replayRankedParser.ts`, lines 569–663  
**Function:** `extractSurrenders(wml, forumPlayers?)`

```typescript
// replayRankedParser.ts:577–650

// Get the last replay section if it's an array
// (the actual game replay is usually at the end when there are multiple sections)
const replayNode = wml.replay as WmlNode | WmlNode[] | undefined;
if (!replayNode) return [];
const replay = Array.isArray(replayNode) ? replayNode[replayNode.length - 1] : replayNode;

const commands = replay.command as WmlNode | WmlNode[] | undefined;
if (!commands) return [];
const commandArray = Array.isArray(commands) ? commands : [commands];

for (let i = 0; i < commandArray.length; i++) {
  const command = commandArray[i];
  const fireEvent = command.fire_event as WmlNode | undefined;

  // PATTERN 1: Old surrender pattern with fire_event + input
  if (fireEvent && fireEvent.raise === 'menu item surrender') {
    const fromSide = parseInt(command.from_side as string) || 0;

    // Look for next command: value=2 = confirmed surrender, value=1 = cancelled
    const nextCommand = commandArray[i + 1];
    if (nextCommand && nextCommand.input) {
      const inputValue = parseInt((nextCommand.input as any).value as string);
      const confirmed = inputValue === 2;
      surrenders.push({ side: fromSide, confirmed });
    }
  }

  // PATTERN 2: New surrender pattern with server speak message
  // Message format: "PlayerName has surrendered."
  const speak = command.speak as WmlNode | undefined;
  if (speak && typeof speak === 'object') {
    const message = speak.message as string | undefined;
    if (message && message.includes('has surrendered.')) {
      const surrenderMatch = message.match(/^(.+)\s+has\s+surrendered\.$/);
      if (surrenderMatch && forumPlayers) {
        const surrenderingPlayerName = surrenderMatch[1].trim();
        // Use forum players list to resolve the surrendering player's side number
        const surrenderingPlayer = forumPlayers.find(p => p.user_name === surrenderingPlayerName);
        if (surrenderingPlayer) {
          // Server message is always confirmed — no input confirmation needed
          surrenders.push({ side: surrenderingPlayer.side_number, confirmed: true });
        }
      }
    }
  }
}
```


### — Leaderkill Detection

**File:** `backend/src/utils/replayRankedParser.ts`, lines 670–717  
**Function:** `extractLeaderkills(wml)`

```typescript
// replayRankedParser.ts:670–717
function extractLeaderkills(wml: WmlNode): LeaderkillEvent[] {
  const replayNode = wml.replay as WmlNode | WmlNode[] | undefined;
  if (!replayNode) return [];
  const replay = Array.isArray(replayNode) ? replayNode[replayNode.length - 1] : replayNode;
  const commands = replay?.command as WmlNode | WmlNode[] | undefined;
  if (!commands) return [];
  const commandArray = Array.isArray(commands) ? commands : [commands];
  const leaderkills: LeaderkillEvent[] = [];

  // Scan from the end — leaderkill commands appear near the final turns.
  // Limit to last 50 commands to avoid scanning the entire replay.
  for (let i = commandArray.length - 1; i >= Math.max(0, commandArray.length - 50); i--) {
    const command = commandArray[i];
    if (command.dependent !== 'yes') continue;

    const fromSide = parseInt(command.from_side as string);
    if (!fromSide || fromSide < 1) continue;

    const inputNode = command.input as WmlNode | undefined;
    if (!inputNode) continue;
    const varNode = inputNode.variable as WmlNode | undefined;
    if (!varNode) continue;

    const varName = varNode.name as string | undefined;
    const varValue = parseInt(varNode.value as string);

    // Pattern: Winner_N variable where value equals the winning side number.
    // Example: name="Winner_2" value=2  →  side 2 won by leaderkill
    if (varName && varName.startsWith('Winner_')) {
      const winnerSideFromVar = parseInt(varName.split('_')[1]);
      if (winnerSideFromVar && varValue === winnerSideFromVar && varValue > 0) {
        console.log(`[EXTRACT LEADERKILLS] Leaderkill: side ${varValue} wins`);
        leaderkills.push({ winner_side: varValue });
      }
    }
  }

  return leaderkills;
}
```

## — Victory Determination

**File:** `backend/src/utils/replayRankedParser.ts`, lines 726–864  
**Function:** `determineVictory(wml, players, surrenders, addon, forumPlayers?)`

```typescript
// replayRankedParser.ts:726–864
async function determineVictory(
  wml: WmlNode,
  players: Array<{ side: number; name: string; faction?: string }>,
  surrenders: SurrenderEvent[],
  addon: RankedAddonConfig,
  forumPlayers?: Array<{ side_number: number; user_name: string; faction: string }>
): Promise<ParsedRankedReplay['victory']> {

  // Check for confirmed surrenders first.
  // Forum data is the source of truth for side ↔ nickname mapping.
  for (const surrender of surrenders) {
    if (surrender.confirmed) {
      const loserSide = surrender.side;

      if (forumPlayers && forumPlayers.length > 0) {
        const loserData  = forumPlayers.find(p => p.side_number === loserSide);
        const winnerData = forumPlayers.find(p => p.side_number !== loserSide);

        if (loserData && winnerData) {
          const loserWml  = players.find(p => p.side === loserSide);
          const winnerWml = players.find(p => p.side !== loserSide);

          // Use faction from forum; fall back to WML if forum reported "Custom"
          const loserFaction  = (loserData.faction  !== 'Custom' && loserData.faction)
            ? loserData.faction  : loserWml?.faction;
          const winnerFaction = (winnerData.faction !== 'Custom' && winnerData.faction)
            ? winnerData.faction : winnerWml?.faction;

          return {
            winner_side: winnerData.side_number, loser_side: loserData.side_number,
            winner_name: winnerData.user_name,   loser_name:  loserData.user_name,
            winner_faction: winnerFaction,        loser_faction: loserFaction,
            reason: 'surrender',
            confidence_level: 2  // Clear victory by surrender
          };
        }
      }
    }
  }

  // No surrenders found — check for leaderkill victory pattern
  const leaderkills = extractLeaderkills(wml);
  if (leaderkills.length > 0) {
    const winnerSide = leaderkills[leaderkills.length - 1].winner_side; // use last event
    const loserSide  = winnerSide === 1 ? 2 : 1;

    const winnerData = forumPlayers?.find(p => p.side_number === winnerSide);
    const loserData  = forumPlayers?.find(p => p.side_number === loserSide);
    const winnerWml  = players.find(p => p.side === winnerSide);
    const loserWml   = players.find(p => p.side === loserSide);

    const winnerName    = winnerData?.user_name || winnerWml?.name || `Player${winnerSide}`;
    const loserName     = loserData?.user_name  || loserWml?.name  || `Player${loserSide}`;
    const winnerFaction = (winnerData?.faction && winnerData.faction !== 'Custom')
      ? winnerData.faction : winnerWml?.faction;
    const loserFaction  = (loserData?.faction  && loserData.faction  !== 'Custom')
      ? loserData.faction  : loserWml?.faction;

    console.log(`[VICTORY] Leaderkill: ${winnerName} (side ${winnerSide}) def ${loserName}`);
    return {
      winner_side: winnerSide, loser_side: loserSide,
      winner_name: winnerName,  loser_name: loserName,
      winner_faction: winnerFaction, loser_faction: loserFaction,
      reason: 'victory_conditions',
      confidence_level: 2  // Clear victory by leaderkill
    };
  }

  // No clear victory — needs player confirmation
  const player1 = players[0] || { side: 1, name: 'Player1' };
  const player2 = players[1] || { side: 2, name: 'Player2' };
  return {
    winner_side: player1.side, loser_side: player2.side,
    winner_name: player1.name, loser_name: player2.name,
    winner_faction: player1.faction, loser_faction: player2.faction,
    reason: 'unknown',
    confidence_level: 1  // Always confidence=1 for unclear victories
  };
}
```
