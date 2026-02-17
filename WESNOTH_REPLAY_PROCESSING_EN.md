# Automated Replay Detection and Processing

**Date:** February 17, 2026  
**Status:** 🔲 Phase 7 - Implementation Design  
**Integration with:** Wesnoth Tournament Manager  

---

## Overview

Replace manual replay uploads with automated detection and processing. The system monitors a configured directory on the Debian server for replay files (`.gz` format), automatically parses them, extracts match data, and generates tournament match records with auto-reported status.

**Key Benefits:**
- ✅ Zero manual intervention for replay uploads
- ✅ Automatic match creation with extracted data
- ✅ Self-service confirmation for winners
- ✅ Detailed victory condition tracking
- ✅ Addon-based tournament validation

---

## 1. Database Schema

### 1.1 New Table: `replays`

Tracks all replay files detected on the server.

```sql
CREATE TABLE replays (
    id CHAR(36) PRIMARY KEY,
    replay_filename VARCHAR(500) NOT NULL UNIQUE,
    replay_path VARCHAR(1000) NOT NULL,
    file_size_bytes BIGINT,
    parsed TINYINT(1) DEFAULT 0,
    need_integration TINYINT(1) DEFAULT 0,
    match_id CHAR(36),
    parse_status VARCHAR(50) DEFAULT 'pending', -- pending, parsing, parsed, error
    parse_error_message TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    parsing_started_at DATETIME,
    parsing_completed_at DATETIME,
    file_write_closed_at DATETIME, -- inotify CLOSE_WRITE event
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_parsed (parsed),
    INDEX idx_need_integration (need_integration),
    INDEX idx_match_id (match_id),
    INDEX idx_parse_status (parse_status),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL
);
```

**Column Descriptions:**
- `replay_filename` - Just the filename (e.g., `20250217_clmates_vs_admin.rpy.gz`)
- `replay_path` - Absolute path on Debian server (e.g., `/var/games/wesnoth/replays/20250217_clmates_vs_admin.rpy.gz`)
- `file_size_bytes` - Size of `.gz` file (for validation)
- `parsed` - Flag indicating if parsing completed
- `need_integration` - Flag set when addon check confirms tournament match
- `match_id` - Reference to auto-created match record
- `parse_status` - Detailed status for monitoring
- `file_write_closed_at` - Timestamp when inotify CLOSE_WRITE fired (file finished writing)

### 1.2 Extended: `matches` Table

Add match status for auto-reported replays.

```sql
ALTER TABLE matches ADD COLUMN replay_id CHAR(36);
ALTER TABLE matches ADD COLUMN auto_reported TINYINT(1) DEFAULT 0;
ALTER TABLE matches ADD COLUMN detected_from VARCHAR(20) DEFAULT 'manual'; -- 'manual' or 'replay'

-- Modify match status enum if needed:
-- Current: 'unconfirmed', 'confirmed'
-- New: 'auto_reported' (replay detected), 'confirmed' (either player confirmed)
```

**New Match Status Flow:**
```
Replay parsed automatically
        ↓
Match created: status = 'auto_reported'
        ↓
Loser can confirm (optional verification)  OR  Winner confirms (validation + rating)
        ↓
Match status = 'confirmed'
```

---

## 2. File Detection Architecture

### 2.1 inotify-based Detection

**Location:** `backend/src/services/replayMonitor.ts`

**Process:**
```
1. Start inotify watcher on configured replay directory
2. Listen for CREATE event → add entry to replays table
3. Listen for CLOSE_WRITE event → mark file_write_closed_at, trigger parsing
4. Store replay_filename and replay_path in replays table
5. Continue background parsing (separate process)
```

**Configuration:**
```env
# .env
WESNOTH_REPLAY_DIR=/var/games/wesnoth/replays
WESNOTH_REPLAY_EXTENSION=.rpy.gz
REPLAY_AUTO_PARSE=true
REPLAY_PARSER_INTERVAL_SECONDS=30
REPLAY_ADDON_FILTER=tournament_addon_uuid  # Addon to identify tournament matches
```

**Implementation:**
```typescript
import * as inotify from 'inotify';

const watcher = new inotify.Inotify();
watcher.addWatch({
    path: process.env.WESNOTH_REPLAY_DIR,
    events: inotify.IN_CLOSE_WRITE | inotify.IN_CREATE,
    callback: async (event) => {
        if (event.name.endsWith('.rpy.gz')) {
            if (event.mask & inotify.IN_CREATE) {
                // File created
                await db.query(
                    `INSERT INTO replays (replay_filename, replay_path, detected_at, parse_status)
                     VALUES (?, ?, NOW(), 'pending')`,
                    [event.name, path.join(process.env.WESNOTH_REPLAY_DIR, event.name)]
                );
            }
            if (event.mask & inotify.IN_CLOSE_WRITE) {
                // File finished writing
                await db.query(
                    `UPDATE replays SET file_write_closed_at = NOW()
                     WHERE replay_filename = ? AND parse_status = 'pending'`,
                    [event.name]
                );
                // Trigger quick parse check
                queueReplayForParsing(event.name);
            }
        }
    }
});
```

---

## 3. Replay Parsing Strategy

### 3.1 Two-Stage Parsing

#### Stage 1: Quick Addon Check (< 1 second)
**Trigger:** File CLOSE_WRITE event  
**Goal:** Determine if replay is tournament-relevant  
**Method:** Parse WML, search for tournament addon UUID  
**Output:** Set `need_integration` flag

```typescript
async function quickAddonCheck(replayPath: string): Promise<boolean> {
    const wml = await parseWMLQuick(replayPath); // Partial parse
    const hasAddon = wml.addons?.some(
        addon => addon.id === process.env.REPLAY_ADDON_FILTER
    );
    return hasAddon;
}
```

#### Stage 2: Full Parsing (1-10 seconds)
**Trigger:** Background cron job every 30 seconds (or event-driven)  
**Goal:** Extract all match data  
**Output:** Create auto_reported match record  

**Data Extracted:**
- Players (side, name, faction, leader)
- Map name and ID
- Era
- All addons used
- Winner (from endlevel block)
- Victory condition (resign, leadership kill, victory points, etc.)
- Game length / turn count

```typescript
async function fullReplayParse(replayPath: string): Promise<ReplayAnalysis> {
    const wml = await parseWMLFull(replayPath);
    
    return {
        metadata: {
            version: wml.version,
            scenario_id: wml.scenario?.id,
            scenario_name: wml.scenario?.name,
            map_file: wml.scenario?.map_data,
            era_id: wml.era?.id
        },
        addons: wml.addons || [],
        players: extractPlayers(wml),
        victory: determineVictory(wml),
        timestamp: new Date()
    };
}
```

### 3.2 Parsing Implementation

**File:** `backend/src/services/replayParser.ts`

**Dependencies:**
```bash
npm install fast-pako          # Fast gzip decompression
npm install wml-parser         # WML format parser (if available)
```

**Core Functions:**

1. **`parseWMLQuick(replayPath)`** - Returns addon list only
2. **`parseWMLFull(replayPath)`** - Returns complete ReplayAnalysis object
3. **`extractPlayers(wmlData)`** - Parse `[side]` blocks
4. **`determineVictory(wmlData)`** - Analyze endlevel and events
5. **`createAutoMatch(analysis)`** - Generate match record from analysis

### 3.3 Victory Condition Detection

**Priority Detection Order:**

```typescript
function determineVictory(wml): VictoryCondition {
    // 1. Explicit endlevel result
    if (wml.endlevel?.result === 'victory') {
        return {
            type: 'explicit_victory',
            winner_side: wml.endlevel.side,
            reason: 'Endlevel explicit victory'
        };
    }
    
    // 2. Resignation (player quit)
    if (wml.endlevel?.result === 'resign') {
        const loser_side = wml.endlevel.side;
        const winner_side = 3 - loser_side; // Assume 2-player (sides 1/2)
        return {
            type: 'resignation',
            winner_side: winner_side,
            reason: 'Opponent resign'
        };
    }
    
    // 3. Leader death (multiplayer standard)
    const leaderDeathEvent = findLeaderDeathEvent(wml);
    if (leaderDeathEvent) {
        const deadLeader = leaderDeathEvent.unit;
        const deadSide = findSideWithLeader(wml, deadLeader);
        const winner_side = 3 - deadSide;
        return {
            type: 'leadership_kill',
            winner_side: winner_side,
            reason: 'Leader defeated'
        };
    }
    
    // 4. Victory points (campaign mode)
    const endTurnEvents = wml.turns?.slice(-1)[0]?.events || [];
    const scores = calculateScores(wml);
    return {
        type: 'victory_points',
        winner_side: scores[0] > scores[1] ? 1 : 2,
        reason: `Victory points: ${scores[0]} vs ${scores[1]}`
    };
}
```

---

## 4. Background Processing

### 4.1 Cron Job: Parse New Replays

**Frequency:** Every 30 seconds  
**File:** `backend/src/jobs/parseNewReplays.ts`

```typescript
async function parseNewReplays() {
    // Find unparsed replays with file write completed
    const pending = await db.query(
        `SELECT * FROM replays 
         WHERE parsed = 0 
         AND file_write_closed_at IS NOT NULL
         AND file_write_closed_at < NOW() - INTERVAL 5 SECOND
         LIMIT 10`
    );
    
    for (const replay of pending) {
        try {
            // Update status
            await db.query(
                `UPDATE replays SET parse_status = 'parsing', parsing_started_at = NOW()
                 WHERE id = ?`,
                [replay.id]
            );
            
            // Parse
            const analysis = await parseWMLFull(replay.replay_path);
            
            // Check tournament addon
            const isTournament = analysis.addons.some(
                a => a.id === process.env.REPLAY_ADDON_FILTER
            );
            
            if (isTournament) {
                // Create auto_reported match
                const matchId = await createAutoMatch(analysis, replay.id);
                
                await db.query(
                    `UPDATE replays 
                     SET parsed = 1, need_integration = 1, match_id = ?, 
                         parse_status = 'parsed', parsing_completed_at = NOW()
                     WHERE id = ?`,
                    [matchId, replay.id]
                );
            } else {
                // Non-tournament replay
                await db.query(
                    `UPDATE replays 
                     SET parsed = 1, need_integration = 0, parse_status = 'parsed', 
                         parsing_completed_at = NOW()
                     WHERE id = ?`,
                    [replay.id]
                );
            }
        } catch (error) {
            await db.query(
                `UPDATE replays 
                 SET parse_status = 'error', parse_error_message = ?, parsing_completed_at = NOW()
                 WHERE id = ?`,
                [error.message, replay.id]
            );
        }
    }
}

// Register cron job
schedule.scheduleJob('*/30 * * * * *', parseNewReplays); // Every 30 seconds
```

### 4.2 Auto-Match Creation

**Function:** `createAutoMatch(analysis, replayId)`

```typescript
async function createAutoMatch(
    analysis: ReplayAnalysis,
    replayId: string
): Promise<string> {
    const matchId = generateUUID();
    
    // Extract player data
    const winner = analysis.players[analysis.victory.winner_side - 1];
    const loser = analysis.players[analysis.victory.winner_side === 1 ? 1 : 0];
    
    // Find or create user records
    const winnerId = await ensureUserExists(winner.name);
    const loserId = await ensureUserExists(loser.name);
    
    // Calculate ELO (simplified)
    const { eloChange } = calculateELO(winnerId, loserId);
    
    // Insert match
    await db.query(
        `INSERT INTO matches (
            id, winner_id, loser_id, map, winner_faction, loser_faction,
            winner_elo_after, loser_elo_after, elo_change,
            status, auto_reported, detected_from, replay_id,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto_reported', 1, 'replay', ?, NOW())`,
        [
            matchId,
            winnerId,
            loserId,
            analysis.metadata.map_file,
            winner.faction_id,
            loser.faction_id,
            winner.elo_rating + eloChange,
            loser.elo_rating - eloChange,
            eloChange,
            replayId
        ]
    );
    
    return matchId;
}
```

---

## 5. Match Confirmation Flow

### 5.1 Winner Confirmation (Validation Step)

**Endpoint:** `POST /api/matches/{matchId}/confirm-as-winner`

**Request:**
```json
{
    "comment": "Good game! Your tactics with the cavalry were impressive.",
    "opponent_rating": 4,
    "accuracy": 85
}
```

**Process:**
1. Verify authenticated user is the auto-reported winner
2. Validate replay file still exists and hasn't been tampered
3. Update match:
   - Set `status = 'confirmed'`
   - Add `winner_comments`, `winner_rating`
   - Update winner's ELO (if confirmed rating differs)
4. Trigger statistics update (add to faction/map stats)

**Response:**
```json
{
    "status": "confirmed",
    "message": "Match confirmed successfully",
    "elo_change": 42,
    "new_rating": 1442
}
```

### 5.2 Loser Confirmation (Optional Verification)

**Endpoint:** `POST /api/matches/{matchId}/confirm-as-loser`

**Response:**
```json
{
    "status": "confirmed",
    "message": "Match verified by loser",
    "loser_confirmed_at": "2025-02-17T14:30:00Z"
}
```

---

## 6. Match Status Progression

**Old Flow:**
```
unconfirmed (manual upload)
    ↓
confirmed (loser verifies)
```

**New Flow:**
```
auto_reported (replay detected & parsed automatically)
    ↓
confirmed (winner confirms with comment + rating)
    ↓ [Optional: loser verifies]
verified (additional validation)
```

### 6.1 Database Schema Update

```sql
ALTER TABLE matches MODIFY COLUMN status ENUM(
    'unconfirmed',
    'auto_reported',
    'confirmed',
    'verified',
    'disputed',
    'rejected'
) DEFAULT 'unconfirmed';

ALTER TABLE matches ADD COLUMN loser_confirmed_at DATETIME;
ALTER TABLE matches ADD COLUMN dispute_reason TEXT;
```

---

## 7. Configuration Files

### 7.1 Replay Monitor Config

**File:** `backend/.env.example`

```env
# Replay Detection and Processing
WESNOTH_REPLAY_DIR=/var/games/wesnoth/replays
WESNOTH_REPLAY_EXTENSION=.rpy.gz
REPLAY_AUTO_PARSE=true
REPLAY_PARSER_INTERVAL_SECONDS=30
REPLAY_ADDON_FILTER=tournament-addon  # UUID identifying tournament replays
REPLAY_KEEP_FILES=true                 # Keep files after processing
REPLAY_MAX_AGE_DAYS=90                 # Auto-delete old replays
REPLAY_VALIDATION_STRICT=true          # Verify file integrity
```

### 7.2 Permissions Setup

**Required Debian Permissions:**

```bash
# Wesnoth replays directory (readable by app)
sudo chown www-data:www-data /var/games/wesnoth/replays
sudo chmod 775 /var/games/wesnoth/replays

# App can read replays
sudo setfacl -m u:www-data:rx /var/games/wesnoth/replays
```

---

## 8. Integration with Tournament Requirements

### 8.1 Addon-based Tournament Validation

**Purpose:** Automatically identify tournament matches

**Implementation:**
```typescript
function validateTournamentReplay(analysis: ReplayAnalysis): boolean {
    // Check for tournament addon
    const hasTournamentAddon = analysis.addons.some(
        addon => addon.id === process.env.REPLAY_ADDON_FILTER
    );
    
    // Check for valid era
    const allowedEras = ['era1', 'era2']; // Configure as needed
    const validEra = allowedEras.includes(analysis.metadata.era_id);
    
    // Check for valid map
    const validMap = await isMapApprovedForTournament(analysis.metadata.map_file);
    
    return hasTournamentAddon && validEra && validMap;
}
```

### 8.2 Victory Condition Customization

**Tournament-specific Victory Conditions (determined by addon):**

```typescript
const VictoryConditions = {
    LEADERSHIP_KILL: 'opponent_leader_defeated',
    VICTORY_POINTS: 'victory_points_reached',
    TURN_LIMIT: 'turn_limit_exceeded',
    RESIGNATION: 'opponent_resigned',
    DISCONNECT: 'opponent_disconnected'
};
```

---

## 9. Implementation Phases

### Phase 7A: Database & Table Creation
- Create `replays` table
- Extend `matches` table with new status values
- Add indexes for performance

### Phase 7B: File Detection (inotify Watcher)
- Implement `replayMonitor.ts` service
- File detection on CREATE and CLOSE_WRITE events
- Insert records into `replays` table
- Start service in production environment

### Phase 7C: Replay Parsing Service
- Implement `replayParser.ts` with WML parsing
- Quick addon check (Stage 1)
- Full parse implementation (Stage 2)
- Victory condition detection

### Phase 7D: Background Job & Auto-Match Creation
- Implement cron job every 30 seconds
- `createAutoMatch()` function
- Auto-create tournament matches
- Update ELO calculations

### Phase 7E: Confirmation Endpoints
- `/api/matches/{matchId}/confirm-as-winner`
- `/api/matches/{matchId}/confirm-as-loser`
- Comment and rating capture
- Match status transitions

### Phase 7F: Frontend UI Updates
- Show `auto_reported` matches in dashboard
- Winner confirmation form (comment + rating)
- Optional loser verification
- Replay file link/download

---

## 10. Monitoring & Logging

### 10.1 Logging Events

All events logged to `audit_logs` table:

```sql
INSERT INTO audit_logs (event_type, username, details, created_at)
VALUES (?, ?, ?, NOW());
```

**Event Types:**
- `REPLAY_DETECTED` - New replay file found
- `REPLAY_PARSING_STARTED` - Parser begun
- `REPLAY_PARSED_SUCCESS` - Parse completed
- `REPLAY_PARSED_ERROR` - Parse failed
- `REPLAY_TOURNAMENT_MATCH` - Tournament match identified
- `MATCH_AUTO_CREATED` - Auto-reported match created
- `MATCH_CONFIRMED_WINNER` - Winner confirmed
- `MATCH_CONFIRMED_LOSER` - Loser confirmed

### 10.2 Health Check Endpoint

**Endpoint:** `GET /api/health/replay-monitor`

**Response:**
```json
{
    "status": "healthy",
    "inotify_active": true,
    "pending_replays": 0,
    "parsing_in_progress": 0,
    "last_parse_at": "2025-02-17T14:25:30Z",
    "queue_size": 0,
    "errors_last_hour": 0
}
```

---

## 11. Error Handling & Recovery

### 11.1 Parsing Errors

**Recoverable:**
- Corrupted .gz: retry with backoff
- Missing addon: mark as `need_integration = 0`
- Invalid WML: log error, skip

**Critical:**
- Replay directory unavailable: alert admin
- Database connection lost: queue for retry
- File permission denied: log and skip

### 11.2 Automatic Cleanup

```typescript
// Daily job: clean up old replays
schedule.scheduleJob('0 2 * * *', async () => {
    const maxAge = parseInt(process.env.REPLAY_MAX_AGE_DAYS) || 90;
    const cutoff = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    
    await db.query(
        `UPDATE replays SET deleted_at = NOW()
         WHERE created_at < ? AND deleted_at IS NULL`,
        [cutoff]
    );
    
    // Physical file deletion (if enabled)
    if (process.env.REPLAY_DELETE_FILES === 'true') {
        // Delete physical files from disk
    }
});
```

---

## 12. File Structure

**New/Modified Files:**

```
backend/
├── src/
│   ├── services/
│   │   ├── replayMonitor.ts (NEW - inotify watcher)
│   │   ├── replayParser.ts (NEW - WML parsing)
│   │   └── wesnothAuth.ts (existing)
│   ├── routes/
│   │   ├── matches.ts (MODIFIED - add confirmation endpoints)
│   │   └── auth.ts (existing)
│   ├── jobs/
│   │   └── parseNewReplays.ts (NEW - background cron job)
│   ├── middleware/
│   │   └── errorHandler.ts (existing)
│   └── app.ts
├── migrations/
│   └── add_replay_processing_tables.sql (NEW)
├── .env.example (MODIFIED - add replay config vars)
└── package.json (MODIFIED - add inotify & gzip libs)

frontend/
├── src/
│   ├── pages/
│   │   ├── Match.tsx (MODIFIED - add confirmation form)
│   │   └── Dashboard.tsx (MODIFIED - show auto_reported matches)
│   ├── components/
│   │   └── MatchConfirmation.tsx (NEW)
│   └── services/
│       └── api.ts (existing)
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

- WML parser with sample replays
- Victory condition detection
- ELO calculation with auto-reported matches

### 13.2 Integration Tests

- inotify detection + database insertion
- Background job execution
- Auto-match creation flow
- Confirmation endpoint flow

### 13.3 End-to-End Tests

- Generate test replay file
- Monitor for detection
- Verify parsing and match creation
- Winner confirmation

---

## 14. Performance Considerations

**Expected Throughput:**
- Parse time per replay: 1-5 seconds
- inotify latency: < 100ms
- Background job cycle: 30 seconds
- Database query performance: indexed lookups

**Optimization:**
- Async parsing queue (process 3-5 replays in parallel)
- Cache parsed WML structure
- Batch database inserts for statistics
- Connection pooling for MariaDB

---

## 15. Security Considerations

✅ **File Validation:**
- Verify `.gz` file signature before parsing
- Validate replay structure before creating match
- Checksum verification (optional)

✅ **Access Control:**
- Only authorized users can confirm matches
- Replay files not downloadable (unless explicit permission)
- User can only confirm their own matches

✅ **Replay Tampering:**
- Validate replay hasn't been modified since parsing
- Compare checksums on confirmation
- Flag suspicious modifications

---

## 16. Known Limitations & Future Enhancements

**Limitations:**
- Single addon filter for tournament identification (could be enhanced with multiple addons)
- Victory detection depends on consistent WML structure
- No real-time validation against official Wesnoth server

**Future Enhancements:**
- Real-time match statistics streaming
- Replay video generation (FFmpeg integration)
- Advanced anti-cheat detection
- Multi-server relay for decentralized tournaments
- Spectator replay linking

---

## 17. Summary

This design enables **fully automated tournament match reporting** with:
- ✅ Zero manual replay uploads
- ✅ Automatic match creation and ELO calculation
- ✅ Self-service winner confirmation
- ✅ Tournament addon-based validation
- ✅ Transparent error handling and logging
- ✅ Production-ready monitoring

**Next Steps:**
1. Finalize tournament addon UUID
2. Determine victory conditions per tournament
3. Start Phase 7A (database schema)
4. Implement inotify watcher (Phase 7B)
5. Build WML parser (Phase 7C)
6. Deploy background job (Phase 7D)

---

**Document Version:** 1.0  
**Date Created:** February 17, 2026  
**Status:** Design Complete, Ready for Implementation
