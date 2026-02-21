# 🔄 Replay Processing Refactor Plan
**Date:** February 21, 2026  
**Objective:** Migrate from filesystem polling to forum database-driven replay processing

## Current Architecture
- **Polling:** inotify watches `/var/games/wesnoth/replays/` directory
- **Detection:** File system events trigger replay insertion to `replays` table
- **Processing:** `parseNewReplays` job fetches from `replays` WHERE `parsed=0`
- **Parsing:** Full replay file parsing for all game info
- **Limitation:** Decoupled from source of truth (forum database game data)

## New Architecture (Proposed)
```
Forum Database Tables
├── wesnothd_game_info (INSTANCE_UUID, GAME_ID, END_TIME, REPLAY_NAME, OOS, etc.)
├── wesnothd_game_player_info (INSTANCE_UUID, GAME_ID, USER_ID, FACTION, IS_HOST, etc.)
└── wesnothd_game_content_info (INSTANCE_UUID, GAME_ID, TYPE, ID, ADDON_ID, NAME)
                    ↓
         Sync to Tournament DB
                    ↓
         replays table (indexed by INSTANCE_UUID, GAME_ID)
                    ↓
         Minimal Replay Parse (victory_conditions only)
                    ↓
         match_reports table (CONFIDENCE_LEVEL, STATUS)
                    ↓
    Auto-Create Matches (confidence=2) OR
    Pending Reporting (confidence=1, awaiting user confirmation)
```

## Phase 1: Database Schema Changes

### 1.1 Refactor `replays` Table
**Current schema:** Stores local file paths  
**New schema:** Maps forum game data to Wesnoth replay server URLs  
**New indexes:** Composite on `INSTANCE_UUID, GAME_ID` (mirrors forum source)

```sql
-- Add new columns to existing replays table
ALTER TABLE replays ADD COLUMN IF NOT EXISTS instance_uuid CHAR(36);
ALTER TABLE replays ADD COLUMN IF NOT EXISTS game_id INT UNSIGNED;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS wesnoth_version VARCHAR(20); -- e.g., "1.18"
ALTER TABLE replays ADD COLUMN IF NOT EXISTS replay_url VARCHAR(1000); -- Full URL to replay server
ALTER TABLE replays ADD COLUMN IF NOT EXISTS game_name VARCHAR(255);
ALTER TABLE replays ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS oos TINYINT(1) DEFAULT 0;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS is_reload TINYINT(1) DEFAULT 0;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS last_checked_at DATETIME;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS detection_confidence TINYINT(1); -- 1 (low) or 2 (high)
ALTER TABLE replays ADD COLUMN IF NOT EXISTS detected_from VARCHAR(50); -- 'manual', 'replay'

-- Add unique constraint for forum source
ALTER TABLE replays ADD UNIQUE KEY IF NOT EXISTS uq_instance_game (instance_uuid, game_id);

-- Add indexes for efficient queries
ALTER TABLE replays ADD KEY IF NOT EXISTS idx_parsed (parsed);
ALTER TABLE replays ADD KEY IF NOT EXISTS idx_match_id (match_id);
ALTER TABLE replays ADD KEY IF NOT EXISTS idx_last_checked (last_checked_at);
ALTER TABLE replays ADD KEY IF NOT EXISTS idx_end_time (end_time);
```

### 1.2 Update `matches` Table
**Change:** `replay_file_path` becomes URL to Wesnoth replay server  
**Format:** `https://replays.wesnoth.org/{version}/{year}/{month}/{day}/{replay_name}`

```sql
-- Update column comment to reflect URL format
-- matches.replay_file_path (VARCHAR(500) → VARCHAR(1000)) now stores full URL to replay server
-- Example: "https://replays.wesnoth.org/1.18/2026/02/21/game_12345.wrz"

-- If column exists with old size, increase it
ALTER TABLE matches MODIFY COLUMN replay_file_path VARCHAR(1000);

-- Note: matches table does NOT need detection_confidence or detected_from
-- Those are only in replays table. Matches just links to replay URL.
```

### 1.3 URL Construction Format
```
URL Pattern: https://replays.wesnoth.org/{wesnoth_version}/{year}/{month}/{day}/{replay_name}

Fields:
- {wesnoth_version}: From replays.wesnoth_version (e.g., "1.18")
- {year}: From replays.end_time YEAR() (e.g., "2026")
- {month}: From replays.end_time MONTH() (e.g., "02")
- {day}: From replays.end_time DAY() (e.g., "21")
- {replay_name}: From replays.replay_filename (e.g., "game_12345")

Example URL: https://replays.wesnoth.org/1.18/2026/02/21/game_12345.wrz
```

## Phase 2: Job Logic Refactor

### 2.1 New Flow: `syncGamesFromForum`
**Trigger:** Every 60 seconds  
**Purpose:** Sync new games from forum database

```typescript
async execute() {
  // 1. Get last_check_timestamp from system_settings
  const lastCheck = await this.getSystemSetting('replay_last_check_timestamp');
  
  // 2. Query forum.wesnothd_game_info WHERE END_TIME > lastCheck
  const newGames = await this.fetchNewGamesFromForum(new Date(lastCheck));
  
  // 3. For each game:
  //    a) Check if it has tournament addon (via wesnothd_game_content_info)
  //    b) If NOT tournament addon, skip
  //    c) If YES tournament addon:
  //       - Check if replay already in replays table
  //       - If not, insert new replay record with status='pending'
  //       - If exists, update last_checked_at
  
  // 4. Update system_settings 'replay_last_check_timestamp' = NOW()
  
  // 5. Return sync summary
}
```

### 2.2 Refactored: `processNewReplays`
**Purpose:** Parse replays for victory conditions and create/update matches

```typescript
async execute() {
  // 1. Query replays WHERE parsed=0 
  //             AND (last_checked_at IS NULL OR last_checked_at < NOW() - INTERVAL 5 SECOND)
  
  const pendingReplays = await this.getPendingReplaysParse();
  
  // 2. For each replay:
  //    a) Load replay file
  //    b) Parse ONLY victory_conditions from [side] section
  //    c) Load game info from wesnothd_game_info + wesnothd_game_player_info
  //    d) Load tournament addon info from wesnothd_game_content_info
  //    e) Determine confidence_level:
  //       - confidence=2 if victory detected with clear winner
  //       - confidence=1 if ambiguous or partial victory detected
  //    f) Call createOrUpdateMatch(game, victoryInfo, confidence)
  
  // 3. Update parsed=1 on replays table
  // 4. Update system_settings 'replay_last_integration_timestamp' = NOW()
}
```

### 2.3 New: `createOrUpdateMatch`
**Purpose:** Create or update match record based on confidence level from replay detection

```typescript
async createOrUpdateMatch(
  replay: Replay,
  gameInfo: GameInfo,
  playerInfos: PlayerInfo[],
  victoryConditions: VictoryCondition[],
  confidenceLevel: 1 | 2
) {
  // 1. Check if users exist in users_extension
  for (player of playerInfos) {
    const user = await getUserByUsername(player.USER_NAME);
    if (!user) {
      // Auto-create user with basic info from forum
      user = await createUserFromForumData(player);
    }
  }
  
  // 2. Determine winner from victoryConditions
  const winnerUserId = getWinnerFromVictory(victoryConditions, playerInfos);
  
  // 3. Build replay URL
  const replayUrl = buildReplayUrl({
    version: gameInfo.wesnoth_version,      // e.g., "1.18"
    year: replay.end_time.getFullYear(),    // e.g., 2026
    month: replay.end_time.getMonth() + 1,  // e.g., 02
    day: replay.end_time.getDate(),         // e.g., 21
    name: replay.replay_filename             // e.g., "game_12345"
  });
  // Result: "https://replays.wesnoth.org/1.18/2026/02/21/game_12345.wrz"
  
  // 4. Check if match already exists for this replay
  let match = await getMatchByReplayId(replay.id);
  
  if (!match) {
    // 5a. If confidence=2: Create match with status='confirmed'
    if (confidenceLevel === 2) {
      match = await createMatch({
        player1_id: playerInfos[0].user_id,
        player2_id: playerInfos[1].user_id,
        winner_id: winnerUserId,
        loser_id: winnerUserId === playerInfos[0].user_id ? playerInfos[1].user_id : playerInfos[0].user_id,
        status: 'confirmed',
        replay_file_path: replayUrl, // Now contains full URL to Wesnoth replay server
        map: gameInfo.map,
        winner_faction: getFactionForPlayer(playerInfos, winnerUserId),
        loser_faction: getFactionForPlayer(playerInfos, loserId),
        // ... other fields
      });
      // Calculate and apply ELO changes immediately
      await applyEloChanges(match);
    }
    
    // 5b. If confidence=1: Create match with status='pending_report'
    else if (confidenceLevel === 1) {
      match = await createMatch({
        player1_id: playerInfos[0].user_id,
        player2_id: playerInfos[1].user_id,
        winner_id: likelyWinnerUserId, // Best guess
        loser_id: likelyLoserUserId,
        status: 'pending_report',
        replay_file_path: replayUrl, // Still has full URL
        map: gameInfo.map,
        // ... other fields
      });
      // Don't apply ELO yet - waiting for player confirmation
    }
  } else {
    // Update existing match if needed
    if (match.status === 'pending' && confidenceLevel >= 1) {
      match.status = confidenceLevel === 2 ? 'confirmed' : 'pending_report';
      match.replay_file_path = replayUrl;
      await updateMatch(match);
    }
  }
  
  // 6. Update replays table (this IS where detection_confidence and detected_from live)
  await updateReplay({ 
    id: replay.id,
    parsed: 1,
    match_id: match.id,
    detection_confidence: confidenceLevel,     // Stored in replays table
    detected_from: 'replay',                    // Stored in replays table
    victory_conditions_detected: 1,
    replay_url: replayUrl
  });
  
  // 7. Log audit event
  await logAuditEvent({
    event_type: 'MATCH_AUTO_REPORTED',
    details: {
      match_id: match.id,
      replay_id: replay.id,
      confidence_level: confidenceLevel,
      status: match.status,
      player1: playerInfos[0].USER_NAME,
      player2: playerInfos[1].USER_NAME
    }
  });
}
```

## Phase 3: Frontend Changes

### 3.1 New Endpoint: `GET /api/matches/pending-reporting`
**Purpose:** List matches with status='pending_report' for current user

```typescript
GET /api/matches/pending-reporting?filter=as_winner|as_loser|all

Response: [
  {
    id: "match_id",
    opponent: { id, nickname, rating },
    map: { name, faction },
    game_name: string,
    detected_victory: {
      winner_side: 1 | 2,
      conditions: ["objectives", "units"],
      confidence: 1 | 2
    },
    timestamp: date,
    status: "pending_report",
    actions: ["confirm_as_winner", "confirm_as_loser", "reject", "dispute"]
  }
]
```

### 3.2 Updated Match: Confirm Reporting Panel
**Location:** Dashboard → "My Matches" → "Pending Reporting" tab  
**Features:**
- Shows detected victory info (pre-filled from replay)
- User can confirm as winner or loser (or dispute)
- Rate opponent (1-5 stars)
- Add comments
- Automatically sets status to 'confirmed' and applies ELO if just auto-created with confidence=1

```typescript
interface ConfirmReportPayload {
  confirmed_as_winner: boolean; // User is confirming their role
  opponent_rating: 1 | 5;
  comment: string;
}
```

### 3.3 Endpoint: `POST /api/matches/:id/confirm-report`
**Purpose:** Player confirms a pending_report match

```typescript
POST /api/matches/match_id/confirm-report
{
  confirmed_as_winner: true | false,
  opponent_rating: 1 | 5,
  comment: string
}

Response:
{
  success: true,
  match_updated: {
    id, 
    status: 'confirmed',
    winner_elo_change, 
    loser_elo_change
  }
}
```

### 3.4 Endpoint: `POST /api/matches/:id/reject-report`
**Purpose:** Player disputes/rejects an auto-reported match

```typescript
POST /api/matches/match_id/reject-report
{
  reason: string
}

Response:
{
  success: true,
  match_status: 'disputed'
}
```

## Phase 4: Replay Download Functionality

### 4.1 Updated Replay Download Endpoint
**Current:** Serve replay file from local `uploads/` directory  
**New:** Return URL to official Wesnoth replay server

```typescript
GET /api/matches/:id/replay-download

Response:
{
  success: true,
  replay_url: "https://replays.wesnoth.org/1.18/2026/02/21/game_12345.wrz",
  filename: "game_12345.wrz",
  version: "1.18",
  size_mb: 2.5,
  // Optional: stream directly if needed
  redirect_url: "https://replays.wesnoth.org/1.18/2026/02/21/game_12345.wrz"
}
```

### 4.2 Frontend Changes
**Before:** Download button triggered local file download  
**After:** Button opens Wesnoth replay server URL (or direct download if needed)

```typescript
// Frontend logic
const downloadReplay = (match: Match) => {
  if (!match.replay_file_path) {
    showError("Replay not available");
    return;
  }
  
  // Option 1: Direct link (user's browser downloads from Wesnoth server)
  window.open(match.replay_file_path, '_blank');
  
  // Option 2: Track download via backend
  await api.post(`/api/matches/${match.id}/record-replay-download`);
};
```

### 4.3 Tracking Replay Downloads (Optional)
```typescript
POST /api/matches/:id/record-replay-download

// Increments replay_downloads counter for stats
// Useful for tracking which replays are most viewed
```

## Key Benefits
✅ **Source of Truth:** Forum database is now authoritative for game events  
✅ **Simplified Schema:** No match_reports table - reuse matches table with new status  
✅ **No New Infrastructure:** Use existing system_settings for sync timestamps  
✅ **Auto Reporting (confidence=2):** Matches created immediately with ELO calculated  
✅ **Player Confirmation (confidence=1):** Pending reporting matches wait for player confirmation before ELO  
✅ **Auto User Registration:** Players not in tournament DB auto-created from forum data  
✅ **Simpler Code:** Fewer tables, fewer synchronization points, clearer data flow  
✅ **Faster Processing:** Direct DB queries instead of filesystem polling  

## Data Flow Diagram
```
Forum Database (wesnothd_game_*)
        ↓ (sync every 60s)
    [syncGamesFromForum]
        ↓
    replays table (status: pending)
        ↓ (parse every 30s)
    [processNewReplays] → Load replay file
        ↓
    [Extract victory_conditions only]
        ↓
    [createOrUpdateMatch] → Determine confidence
        ↓
        ├─ confidence=2 → Match created with status='confirmed' + ELO applied
        └─ confidence=1 → Match created with status='pending_report' + NO ELO yet
        ↓
    matches table
        ↓ (user confirms)
    [confirm-report] → Apply ELO if not already applied
        ↓
    Final match with winner/loser/ELO changes
```

## Connection Details Required

1. **Forum Database Access:**
   - Same MariaDB instance or separate server?
   - Connection credentials (already configured for phpBB connection?)
   - Schema name: `forum` (or different?)

2. **Game Data Retention:**
   - How long does wesnothd keep game records? (days/months?)
   - Does END_TIME represent actual game end or server timestamp?
   - Is REPLAY_NAME always present when game completes?

3. **Tournament Addon Integration:**
   - What ADDON_ID identifies tournament matches?
   - Are there other addons that should be filtered out?
   - How to distinguish tournament vs casual play?

4. **Confidence Level Thresholds:**
   - What makes a victory detection "high confidence" (2)?
   - What scenarios drop to "low confidence" (1)?
   - Should certain victory conditions always be confidence=2?

## Phase 5: Implementation Order

### Week 1: Database Schema & Forum Connection
- [ ] 1.1 Migrate replays table schema (add instance_uuid, game_id, wesnoth_version, detection_* columns)
- [ ] 1.2 Update matches.replay_file_path to VARCHAR(1000) for full URLs
- [ ] Create database migration for new columns
- [ ] Set up forum database connection module (wesnothd_game_* tables)
- [ ] 2.1 Implement `syncGamesFromForum` job

### Week 2: Replay Processing & Match Auto-Creation
- [ ] 2.2 Refactor `processNewReplays` (minimal parsing - victory only)
- [ ] 2.3 Implement `createOrUpdateMatch` with URL building logic
- [ ] Add URL construction function: `buildReplayUrl(version, year, month, day, filename)`
- [ ] Add system_settings queries for timestamps
- [ ] Add audit logging for auto-created matches

### Week 3: Frontend & User Confirmations
- [ ] 3.1 Create `/api/matches/pending-reporting` endpoint
- [ ] 3.2 Build "Pending Reporting" panel in My Matches
- [ ] 3.3 Implement `/api/matches/:id/confirm-report` endpoint
- [ ] 3.4 Implement `/api/matches/:id/reject-report` endpoint
- [ ] 4.1 Update `/api/matches/:id/replay-download` to return replay URL
- [ ] Add toast notifications for auto-matched games

### Week 4: Testing & Optimization
- [ ] Integration tests with forum database mock
- [ ] End-to-end testing of full replay→match flow
- [ ] Test URL format with actual Wesnoth replay server
- [ ] Test confidence=1 vs confidence=2 handling
- [ ] Performance tuning (indexes, query optimization)
- [ ] Update documentation with URL format examples
