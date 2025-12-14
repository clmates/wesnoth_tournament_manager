# Tournament Types Configuration & Structure

## Overview
Each tournament type in CLM Competitive has a distinct configuration and operational structure to support different competitive formats.

---

## Tournament Type Configurations

### 1. **ELIMINATION** (Pure Bracket Elimination)
```
General Rounds: 0
Final Rounds:   3
Total Rounds:   3
```

**Structure:**
- Round 1: 8 players → 4 matches → 4 winners
- Round 2: 4 players → 2 matches → 2 winners  
- Round 3: 2 players → 1 match → 1 winner

**Format:** Single-elimination bracket
- Each player must win to advance
- Losers are eliminated
- No consolation or secondary matches

**Use Case:** Single-elimination tournaments where only winners advance

---

### 2. **LEAGUE** (Round-Robin)
```
General Rounds: 3
Final Rounds:   0
Total Rounds:   3
```

**Structure:**
- Round 1: 8 players → 4 matches (random pairings)
- Round 2: 8 players → 4 matches (new pairings)
- Round 3: 8 players → 4 matches (new pairings)

**Format:** Round-robin all participants all rounds
- All players participate in every round
- Players ranked by wins/points
- No elimination within tournament

**Use Case:** League/group stage where all players must be tested against different opponents

---

### 3. **SWISS** (Swiss System)
```
General Rounds: 3
Final Rounds:   0
Total Rounds:   3
```

**Structure:**
- Round 1: 8 players → 4 matches (Swiss pairing - score-based)
- Round 2: 8 players → 4 matches (Swiss pairing adjusted for new scores)
- Round 3: 8 players → 4 matches (Swiss pairing final round)

**Format:** Swiss system all rounds
- Players stay in tournament (no elimination)
- Each round: players paired by performance
- Score-based advancement
- All players complete tournament

**Use Case:** Competitive tournaments needing fair matchmaking without elimination

---

### 4. **SWISS-ELIMINATION MIX** (Hybrid Format)
```
General Rounds: 2
Final Rounds:   1
Total Rounds:   3
```

**Structure:**
- **Phase 1 - Swiss (Rounds 1-2):**
  - Round 1: 8 players → 4 matches (Swiss pairing)
  - Round 2: 8 players → 4 matches (Swiss pairing)
  
- **Phase 2 - Elimination (Round 3):**
  - Round 3: Top players from Phase 1 → elimination bracket

**Format:** Swiss phase → Top finishers advance to elimination
- Initial rounds use Swiss system for fair seeding
- Final round uses elimination to determine champion
- Provides best of both formats

**Use Case:** Multi-stage tournaments where fair pairing precedes final elimination

---

## Configuration Code Reference

```javascript
// Tournament Type Configuration
if (tournamentType === 'elimination') {
  tournamentData.general_rounds = 0;
  tournamentData.final_rounds = 3;
} else if (tournamentType === 'league') {
  tournamentData.general_rounds = 3;
  tournamentData.final_rounds = 0;
} else if (tournamentType === 'swiss') {
  tournamentData.general_rounds = 3;
  tournamentData.final_rounds = 0;
} else if (tournamentType === 'swiss_elimination') {
  tournamentData.general_rounds = 2;
  tournamentData.final_rounds = 1;
}
```

---

## Visible Differences in Execution

### Participant Count Progression

| Type | R1 Players | R2 Players | R3 Players | Notes |
|------|-----------|-----------|-----------|-------|
| **Elimination** | 8 → 4 matches | 4 → 2 matches | 2 → 1 match | Players eliminated each round |
| **League** | 8 → 4 matches | 8 → 4 matches | 8 → 4 matches | All players every round |
| **Swiss** | 8 → 4 matches | 8 → 4 matches | 8 → 4 matches | All players, score-paired |
| **Swiss-Elim** | 8 → 4 matches | 8 → 4 matches | Top N → elimination | Phase transition visible |

### Match Report Pattern

```
League/Swiss:
- All players participate in every round
- Match count constant: 4 matches per round

Elimination:
- Match count decreases by half each round
- Round 1: 4 matches
- Round 2: 2 matches
- Round 3: 1 match

Swiss-Elimination:
- Rounds 1-2: 4 matches each (Swiss system)
- Round 3: Fewer matches (elimination bracket)
```

---

## Pairing Strategy Differences

### **Elimination & League:** 
- Standard pairings or random

### **Swiss:**
- Score-based pairings
- Strongest vs strongest, weakest vs weakest within score bands
- Ensures most competitive matchups

### **Swiss-Elimination:**
- Rounds 1-2: Swiss pairing (score-based)
- Round 3: Top scorers seed into elimination bracket

---

## Testing Confirmation

All 4 tournament types successfully tested and verified:

```
✅ Elimination       - PASSED (3 rounds, elimination progression)
✅ League           - PASSED (3 rounds, all players each round)
✅ Swiss            - PASSED (3 rounds, score-based pairing)
✅ Swiss-Elimination - PASSED (2 Swiss + 1 Elimination, hybrid progression)
```

**Test Date:** 2025-12-14
**Duration:** ~23 seconds for 4 complete tournaments
**Success Rate:** 4/4 (100%)

---

## Implementation Details

### General Rounds vs Final Rounds

**General Rounds:**
- Use Swiss pairing (if enabled)
- All participants continue
- Accumulate points/rankings

**Final Rounds:**
- Use elimination bracket pairing
- Top performers advance
- Determine final standings

### Auto-Advance Round

All tournament types configured with:
```
auto_advance_round: true
```

After all matches in a round are reported, the next round automatically activates (with 500ms delay for database synchronization).

---

## Database Schema Impact

Tournament configuration stored in `tournaments` table:
- `general_rounds` - Number of round-robin/Swiss rounds
- `final_rounds` - Number of elimination rounds  
- `tournament_type` - Enum: 'elimination', 'league', 'swiss', 'swiss_elimination'

Round metadata in `tournament_rounds` table:
- `round_number` - Sequential round (1, 2, 3, ...)
- `round_type` - 'general' or 'final' (determines pairing strategy)

---

## Summary

Each tournament type serves a specific competitive purpose:

| Type | Best For | Pairing | Players/Round | Stages |
|------|----------|---------|--------------|--------|
| **Elimination** | Quick tournaments | Fixed bracket | Decreasing | 1 (Bracket) |
| **League** | Testing all players | Random/Standard | Constant | 1 (Round-robin) |
| **Swiss** | Fair competition | Score-based | Constant | 1 (Swiss) |
| **Swiss-Elim** | Hybrid competitive | Score → Bracket | Varying | 2 (Swiss + Elim) |

The configuration system now clearly differentiates between all types, making each tournament's structure visible and distinct during execution.
