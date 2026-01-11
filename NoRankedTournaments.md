# Unranked Tournaments Feature Specification

**Status:** Design Complete | Ready for Implementation  
**Priority:** Feature 1 (Implement before Team Tournaments)  
**Date:** January 11, 2026

---

## 1. Overview

Unranked tournaments allow tournament organizers to create 1v1 matches without affecting player ELO ratings. These tournaments can use custom factions and maps distinct from ranked tournament assets, enabling experimental and casual play.

### Key Characteristics
- **Match Format:** 1v1 (single player vs single player)
- **ELO Impact:** NO - unranked matches do NOT affect player ratings
- **Factions/Maps:** Custom, tournament-specific (optionally created during tournament setup)
- **Reporting:** Standard match report workflow (reporter is either player A or B)
- **Visibility:** Unranked statistics excluded from global leaderboards and ratings

---

## 2. Business Requirements

### 2.1 Tournament Creation
- Tournament organizer can select **Radio Button Option: "Unranked (1v1)"** during tournament creation
- When unranked is selected:
  - Faction selection becomes **MULTI-SELECT** (pick existing or create new unranked factions)
  - Map selection becomes **MULTI-SELECT** (pick existing or create new unranked maps)
  - ELO-related fields and configurations are HIDDEN/DISABLED
  - Team configuration is HIDDEN/DISABLED
  - Player registration proceeds as normal (single players, no team assignments)

### 2.2 Faction & Map Management
- **Global Unranked Assets:** Factions and maps marked `is_ranked = false` are available globally across ALL unranked tournaments
- **Organizer Privileges:** Tournament organizers can create new unranked factions/maps during tournament admin setup
- **Reusability:** Once created, unranked factions/maps are reusable by any organizer
- **Filtering:** Unranked factions/maps are ONLY visible when creating/configuring unranked tournaments

### 2.3 Match Reporting
- Match reports for unranked tournaments follow the standard 1v1 workflow:
  - Reporter selects winning player and losing player
  - Report is submitted with match details
  - **NO ELO calculation occurs**
  - Match marked with `tournament_type = 'unranked'`
- Match results are recorded for tournament standings (wins/losses) but do NOT affect global ratings

### 2.4 Statistics & Leaderboards
- **Global Leaderboards:** Unranked matches are EXCLUDED from global player ratings
- **Tournament-Specific Stats:** Unranked tournament standings show only unranked matches
- **Admin Dashboard:** Unranked tournaments are visible but clearly labeled
- **Match History:** Players can view match history filtered by "Ranked" vs "Unranked" vs "All"

---

## 3. Database Schema Changes

### 3.1 Existing Tables - New Columns

#### `factions` Table
```sql
ALTER TABLE factions ADD COLUMN is_ranked BOOLEAN DEFAULT TRUE;
```
- `is_ranked = true`: Available for ranked tournaments (default for existing factions)
- `is_ranked = false`: Available only for unranked tournaments
- Migration: Set all existing factions to `is_ranked = true`

#### `maps` Table
```sql
ALTER TABLE maps ADD COLUMN is_ranked BOOLEAN DEFAULT TRUE;
```
- `is_ranked = true`: Available for ranked tournaments (default for existing maps)
- `is_ranked = false`: Available only for unranked tournaments
- Migration: Set all existing maps to `is_ranked = true`

#### `tournaments` Table
```sql
ALTER TABLE tournaments ADD COLUMN tournament_type VARCHAR(20) 
CHECK (tournament_type IN ('ranked', 'unranked', 'team'))
DEFAULT 'ranked';
```
- `tournament_type = 'ranked'`: Standard ranked 1v1 tournaments (default, backward compatible)
- `tournament_type = 'unranked'`: 1v1 without ELO impact
- `tournament_type = 'team'`: 2v2 team tournaments (for future feature)

#### `matches` Table
```sql
ALTER TABLE matches ADD COLUMN tournament_type VARCHAR(20);
```
- Stores the tournament type at match record time
- Used for filtering and statistics calculations
- Indexed for efficient queries: `CREATE INDEX idx_matches_tournament_type ON matches(tournament_type);`

### 3.2 Unranked Asset Association Tables

#### `tournament_unranked_factions` Table
```sql
CREATE TABLE tournament_unranked_factions (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  faction_id BIGINT NOT NULL REFERENCES factions(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tournament_id, faction_id)
);

CREATE INDEX idx_tournament_unranked_factions_tournament_id 
  ON tournament_unranked_factions(tournament_id);
CREATE INDEX idx_tournament_unranked_factions_faction_id 
  ON tournament_unranked_factions(faction_id);
```
- **Purpose:** Links tournament to its available unranked factions
- **Cascade Delete (Tournament → Association):** When tournament is deleted, all associations are automatically removed. Factions are NOT deleted and remain in global list.
- **Restrict on Delete (Faction):** Database prevents direct faction deletion if associations exist. Validation at application layer checks if faction is in active tournaments.

#### `tournament_unranked_maps` Table
```sql
CREATE TABLE tournament_unranked_maps (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  map_id BIGINT NOT NULL REFERENCES maps(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tournament_id, map_id)
);

CREATE INDEX idx_tournament_unranked_maps_tournament_id 
  ON tournament_unranked_maps(tournament_id);
CREATE INDEX idx_tournament_unranked_maps_map_id 
  ON tournament_unranked_maps(map_id);
```
- **Purpose:** Links tournament to its available unranked maps
- **Cascade Delete (Tournament → Association):** When tournament is deleted, all associations are automatically removed. Maps are NOT deleted and remain in global list.
- **Restrict on Delete (Map):** Database prevents direct map deletion if associations exist. Validation at application layer checks if map is in active tournaments.

---

## 4. Backend Implementation

### 4.1 Database Migration File
**File:** `backend/migrations/20260112_add_unranked_tournaments.sql`

```sql
-- Add is_ranked column to factions
ALTER TABLE factions ADD COLUMN is_ranked BOOLEAN DEFAULT TRUE;

-- Add is_ranked column to maps
ALTER TABLE maps ADD COLUMN is_ranked BOOLEAN DEFAULT TRUE;

-- Add tournament_type column to tournaments
ALTER TABLE tournaments ADD COLUMN tournament_type VARCHAR(20) 
CHECK (tournament_type IN ('ranked', 'unranked', 'team'))
DEFAULT 'ranked';

-- Add tournament_type column to matches
ALTER TABLE matches ADD COLUMN tournament_type VARCHAR(20);
CREATE INDEX idx_matches_tournament_type ON matches(tournament_type);

-- Create tournament_unranked_factions table
CREATE TABLE tournament_unranked_factions (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  faction_id BIGINT NOT NULL REFERENCES factions(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tournament_id, faction_id)
);

CREATE INDEX idx_tournament_unranked_factions_tournament_id 
  ON tournament_unranked_factions(tournament_id);
CREATE INDEX idx_tournament_unranked_factions_faction_id 
  ON tournament_unranked_factions(faction_id);

-- Create tournament_unranked_maps table
CREATE TABLE tournament_unranked_maps (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  map_id BIGINT NOT NULL REFERENCES maps(id) ON DELETE RESTRICT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tournament_id, map_id)
);

CREATE INDEX idx_tournament_unranked_maps_tournament_id 
  ON tournament_unranked_maps(tournament_id);
CREATE INDEX idx_tournament_unranked_maps_map_id 
  ON tournament_unranked_maps(map_id);
```

### 4.2 API Endpoints

#### A. Get Unranked Factions (Admin - Tournament Setup)
**Endpoint:** `GET /api/admin/unranked-factions`  
**Authentication:** Admin  
**Query Parameters:**
- `search?: string` - Filter by faction name (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Elves",
      "is_ranked": false,
      "created_at": "2026-01-11T10:00:00Z",
      "used_in_tournaments": 3
    }
  ]
}
```

#### B. Create New Unranked Faction (Admin - Tournament Setup)
**Endpoint:** `POST /api/admin/unranked-factions`  
**Authentication:** Admin  
**Request Body:**
```json
{
  "name": "Faction Name",
  "description": "Optional description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "name": "Faction Name",
    "is_ranked": false,
    "created_at": "2026-01-11T10:00:00Z"
  }
}
```

**Validation:**
- Faction name must be unique
- Faction name must be 1-100 characters
- Organizer must be tournament admin

#### C. Get Unranked Maps (Admin - Tournament Setup)
**Endpoint:** `GET /api/admin/unranked-maps`  
**Authentication:** Admin  
**Query Parameters:**
- `search?: string` - Filter by map name (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Forest of Fire",
      "is_ranked": false,
      "created_at": "2026-01-11T10:00:00Z",
      "used_in_tournaments": 2
    }
  ]
}
```

#### D. Create New Unranked Map (Admin - Tournament Setup)
**Endpoint:** `POST /api/admin/unranked-maps`  
**Authentication:** Admin  
**Request Body:**
```json
{
  "name": "Map Name",
  "description": "Optional description",
  "width": 100,
  "height": 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 42,
    "name": "Map Name",
    "is_ranked": false,
    "width": 100,
    "height": 100,
    "created_at": "2026-01-11T10:00:00Z"
  }
}
```

**Validation:**
- Map name must be unique
- Map name must be 1-100 characters
- Width/height must be positive integers
- Organizer must be tournament admin

#### E. Delete Unranked Faction (Admin)
**Endpoint:** `DELETE /api/admin/unranked-factions/:id`  
**Authentication:** Admin only  
**Response (Success):**
```json
{
  "success": true,
  "message": "Faction deleted successfully"
}
```

**Response (In Use by Active Tournament):**
```json
{
  "success": false,
  "error": "FACTION_IN_ACTIVE_TOURNAMENTS",
  "message": "Cannot delete faction - in use by active tournaments",
  "data": {
    "active_tournaments": [
      { "id": 1, "name": "Tournament A", "status": "REGISTRATION_OPEN" },
      { "id": 2, "name": "Tournament B", "status": "STARTED" }
    ]
  }
}
```

**Validation:**
- Faction must exist
- Faction must NOT be in use by any **active** tournament (status: CREATED, REGISTRATION_OPEN, STARTED, MATCHES_ONGOING)
- Faction CAN be deleted if only used by completed/cancelled tournaments
- User must be admin (organizers cannot delete)

#### F. Delete Unranked Map (Admin)
**Endpoint:** `DELETE /api/admin/unranked-maps/:id`  
**Authentication:** Admin only  
**Response (Success):**
```json
{
  "success": true,
  "message": "Map deleted successfully"
}
```

**Response (In Use by Active Tournament):**
```json
{
  "success": false,
  "error": "MAP_IN_ACTIVE_TOURNAMENTS",
  "message": "Cannot delete map - in use by active tournaments",
  "data": {
    "active_tournaments": [
      { "id": 3, "name": "Tournament C", "status": "STARTED" },
      { "id": 4, "name": "Tournament D", "status": "REGISTRATION_OPEN" }
    ]
  }
}
```

**Validation:**
- Map must exist
- Map must NOT be in use by any **active** tournament (status: CREATED, REGISTRATION_OPEN, STARTED, MATCHES_ONGOING)
- Map CAN be deleted if only used by completed/cancelled tournaments
- User must be admin (organizers cannot delete)

#### G. Get Unranked Faction Usage (Admin - Before Delete)
**Endpoint:** `GET /api/admin/unranked-factions/:id/usage`  
**Authentication:** Admin only  
**Response:**
```json
{
  "success": true,
  "data": {
    "faction_id": 1,
    "faction_name": "Elves",
    "total_tournaments_using": 5,
    "active_tournaments": [
      { "id": 1, "name": "Tournament A", "status": "REGISTRATION_OPEN" },
      { "id": 2, "name": "Tournament B", "status": "STARTED" }
    ],
    "completed_tournaments": [
      { "id": 10, "name": "Completed Tournament", "status": "COMPLETED" }
    ],
    "can_delete": false,
    "reason": "In use by 2 active tournaments"
  }
}
```

#### H. Get Unranked Map Usage (Admin - Before Delete)
**Endpoint:** `GET /api/admin/unranked-maps/:id/usage`  
**Authentication:** Admin only  
**Response:**
```json
{
  "success": true,
  "data": {
    "map_id": 1,
    "map_name": "Forest of Fire",
    "total_tournaments_using": 3,
    "active_tournaments": [
      { "id": 3, "name": "Tournament C", "status": "STARTED" }
    ],
    "completed_tournaments": [
      { "id": 20, "name": "Another Completed", "status": "COMPLETED" }
    ],
    "can_delete": false,
    "reason": "In use by 1 active tournament"
  }
}
```

#### I. Update Tournament Unranked Assets
**Endpoint:** `PUT /api/admin/tournaments/:id/unranked-assets`  
**Authentication:** Admin (tournament organizer only)  
**Request Body:**
```json
{
  "faction_ids": [1, 2, 3],
  "map_ids": [1, 2, 3, 4]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tournament unranked assets updated"
}
```

**Validation:**
- Tournament must have `tournament_type = 'unranked'`
- User must be tournament organizer
- At least 1 faction must be selected
- At least 1 map must be selected
- All faction_ids and map_ids must exist and be `is_ranked = false`
- Tournament must be in CREATED or REGISTRATION_OPEN status (not STARTED)

#### J. Get Tournament Unranked Assets (Public)
**Endpoint:** `GET /api/tournaments/:id/unranked-assets`  
**Authentication:** None (Public)  
**Response:**
```json
{
  "success": true,
  "tournament_type": "unranked",
  "data": {
    "factions": [
      { "id": 1, "name": "Elves" },
      { "id": 2, "name": "Humans" }
    ],
    "maps": [
      { "id": 1, "name": "Forest of Fire" },
      { "id": 2, "name": "Two Crossings" }
    ]
  }
}
```

**Validation:**
- Tournament must exist
- Only applies if tournament_type = 'unranked'

### 4.3 Match Reporting Changes

#### Match Report Endpoint Update
**Endpoint:** `POST /api/tournaments/:id/report-match`  

**Existing Logic Continues For Ranked Tournaments**

**New Logic For Unranked Tournaments:**
```typescript
// Pseudo-code for unranked match reporting
async function reportUnrankedMatch(tournamentId, matchData) {
  const tournament = await getTournament(tournamentId);
  
  if (tournament.tournament_type !== 'unranked') {
    return handleRankedMatch(matchData); // Existing logic
  }
  
  // Validation
  validateReporterIsPlayerInMatch(matchData.reporter_id);
  validateFactionInTournamentAssets(matchData.faction_a, matchData.faction_b);
  validateMapInTournamentAssets(matchData.map_id);
  
  // Record match WITHOUT ELO calculation
  const match = await createMatch({
    ...matchData,
    tournament_type: 'unranked',
    // ELO fields are NULL or 0 for unranked
    elo_change_a: null,
    elo_change_b: null
  });
  
  // Update tournament standings (wins/losses only)
  await updateTournamentStandings(tournamentId, match);
  
  // Do NOT trigger ELO recalculation
  
  return { success: true, match };
}
```

**Request Body:**
```json
{
  "player_a_id": 123,
  "player_b_id": 456,
  "winning_player_id": 123,
  "faction_a": "Elves",
  "faction_b": "Humans",
  "map": "Forest of Fire",
  "turns": 50,
  "replay_url": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Match reported successfully (no ELO change)",
  "match": {
    "id": 789,
    "tournament_type": "unranked",
    "elo_change_a": null,
    "elo_change_b": null,
    "standings_update": {
      "player_a": { "wins": 5, "losses": 2 },
      "player_b": { "wins": 4, "losses": 3 }
    }
  }
}
```

**Validation Rules:**
- Tournament must have `tournament_type = 'unranked'`
- Both players must be registered in tournament
- Faction A must be in tournament_unranked_factions
- Faction B must be in tournament_unranked_factions
- Map must be in tournament_unranked_maps
- Reporter must be either player_a_id or player_b_id
- Match status must be valid for unranked rules (no special restrictions)

### 4.4 Statistics & Leaderboard Changes

#### Player Rating Calculation
**Modification:** `backend/src/services/playerRatingService.ts`

```typescript
async function calculatePlayerRating(playerId: string) {
  // Query ONLY ranked matches
  const rankedMatches = await db.query(`
    SELECT * FROM matches 
    WHERE (player_a_id = $1 OR player_b_id = $1)
    AND tournament_type IN ('ranked', NULL)  -- NULL for backward compatibility
    AND status = 'completed'
  `, [playerId]);
  
  // Calculate ELO based only on ranked matches
  // Unranked matches are completely excluded
  
  return calculateEloFromMatches(rankedMatches);
}
```

#### Tournament Standings
```typescript
async function getTournamentStandings(tournamentId: string) {
  const tournament = await getTournament(tournamentId);
  
  // For unranked tournaments, show only tournament-specific wins/losses
  // For ranked tournaments, show ELO impact (existing logic)
  
  if (tournament.tournament_type === 'unranked') {
    return getUnrankedStandings(tournamentId);
  }
  return getRankedStandings(tournamentId);
}

async function getUnrankedStandings(tournamentId: string) {
  return db.query(`
    SELECT 
      player_id,
      COUNT(CASE WHEN winning_player_id = player_id THEN 1 END) as wins,
      COUNT(CASE WHEN winning_player_id != player_id THEN 1 END) as losses,
      ROUND(
        COUNT(CASE WHEN winning_player_id = player_id THEN 1 END)::numeric / 
        (COUNT(CASE WHEN winning_player_id = player_id THEN 1 END) + 
         COUNT(CASE WHEN winning_player_id != player_id THEN 1 END))::numeric * 100, 
        2
      ) as win_percentage,
      RANK() OVER (ORDER BY COUNT(CASE WHEN winning_player_id = player_id THEN 1 END) DESC) as ranking
    FROM matches
    WHERE tournament_id = $1 AND tournament_type = 'unranked'
    GROUP BY player_id
    ORDER BY wins DESC
  `, [tournamentId]);
}
```

#### Global Leaderboard Exclusion
```typescript
async function getGlobalLeaderboard() {
  // Query ONLY ranked matches for global ratings
  const query = `
    SELECT 
      user_id,
      current_elo as rating,
      ranking,
      (SELECT COUNT(*) FROM matches WHERE player_a_id = user_id OR player_b_id = user_id) as total_matches
    FROM player_ratings
    WHERE tournament_type IS NULL OR tournament_type = 'ranked'
    ORDER BY current_elo DESC
  `;
  
  // Unranked matches do NOT affect global leaderboard
  return db.query(query);
}
```

---

## 5. Frontend Implementation

### 5.1 Tournament Creation UI Changes

#### Tournament Type Selection (Radio Buttons)
**Location:** `frontend/src/components/TournamentForm.tsx`

**UI Layout:**
```
┌─ Tournament Type ────────────────────────────────┐
│  ◉ Ranked (1v1, affects player ratings)          │
│                                                    │
│  ○ Unranked (1v1, no rating impact)              │
│                                                    │
│  ○ Team Tournament (2v2, team-based)            │
└─────────────────────────────────────────────────┘
```

**Behavior:**
- Default selection: "Ranked"
- When "Ranked" selected:
  - Show standard faction/map single selects
  - Show ELO/rating configurations
  - Hide team options
  - Hide unranked options

- When "Unranked" selected:
  - Show unranked faction **MULTI-SELECT** with "Add New" button
  - Show unranked map **MULTI-SELECT** with "Add New" button
  - **HIDE** ELO/rating configurations
  - **HIDE** team options
  - Show info text: "Unranked matches do not affect player ratings"

- When "Team Tournament" selected:
  - Show team configuration options
  - **HIDE** standard faction/map selects (teams bring their own)
  - **HIDE** ELO configurations
  - **HIDE** unranked options

### 5.2 Unranked Faction Selection Component

**Component:** `frontend/src/components/UnrankedFactionSelect.tsx`

```typescript
interface UnrankedFactionSelectProps {
  selectedFactionIds: number[];
  onChange: (factionIds: number[]) => void;
  tournamentId?: number;
  disabled?: boolean;
}

// Features:
// - Multi-select dropdown showing all is_ranked=false factions
// - "Add New Faction" button opens modal
// - Show faction names with icon
// - Allow drag-to-reorder (optional)
// - Required: at least 1 faction selected
// - Show error if no factions available
```

**Behavior:**
- Initial load: Fetch all unranked factions via `GET /api/admin/unranked-factions`
- On selection: Update parent state
- "Add New" button opens modal with form:
  - Faction name input
  - Description textarea
  - Create button calls `POST /api/admin/unranked-factions`
  - On success: New faction appears in multi-select and is auto-selected
  - On error: Show error toast

### 5.3 Unranked Map Selection Component

**Component:** `frontend/src/components/UnrankedMapSelect.tsx`

```typescript
interface UnrankedMapSelectProps {
  selectedMapIds: number[];
  onChange: (mapIds: number[]) => void;
  tournamentId?: number;
  disabled?: boolean;
}

// Features:
// - Multi-select dropdown showing all is_ranked=false maps
// - "Add New Map" button opens modal
// - Show map names with thumbnail
// - Allow drag-to-reorder (optional)
// - Required: at least 1 map selected
// - Show error if no maps available
```

**Behavior:**
- Initial load: Fetch all unranked maps via `GET /api/admin/unranked-maps`
- On selection: Update parent state
- "Add New" button opens modal with form:
  - Map name input
  - Description textarea
  - Width/Height number inputs
  - Create button calls `POST /api/admin/unranked-maps`
  - On success: New map appears in multi-select and is auto-selected
  - On error: Show error toast

### 5.4 Match Report Component Updates

**File:** `frontend/src/components/MatchReport.tsx`

**Changes for Unranked Tournaments:**
```typescript
async function reportMatch(formData) {
  const tournament = await fetchTournament(tournamentId);
  
  if (tournament.tournament_type === 'unranked') {
    // Show simplified form without ELO fields
    // Faction select shows only tournament's unranked factions
    // Map select shows only tournament's unranked maps
    
    // Validate faction is in tournament.unranked_factions
    if (!tournament.unranked_factions.includes(formData.faction_a)) {
      showError('Selected faction not available in this tournament');
      return;
    }
    
    // Validate map is in tournament.unranked_maps
    if (!tournament.unranked_maps.includes(formData.map_id)) {
      showError('Selected map not available in this tournament');
      return;
    }
  }
  
  // Submit match report
  await submitMatch(formData);
}
```

**UI Changes:**
- For unranked tournaments:
  - **HIDE** ELO preview/prediction
  - **HIDE** "Rating will change" warnings
  - **SHOW** "This match does not affect your rating" message
  - Faction dropdown shows only unranked options
  - Map dropdown shows only unranked options

### 5.5 Tournament Standings Page Updates

**File:** `frontend/src/pages/TournamentStandings.tsx`

**Changes:**
```typescript
async function loadStandings(tournamentId) {
  const standings = await fetch(`/api/tournaments/${tournamentId}/standings`);
  
  if (standings.tournament_type === 'unranked') {
    // Display wins/losses/win_percentage instead of ELO
    return renderUnrankedStandings(standings);
  }
  
  // Existing ranked standings logic
  return renderRankedStandings(standings);
}
```

**Unranked Standings Table:**
| Rank | Player | Wins | Losses | Win % |
|------|--------|------|--------|-------|
| 1    | Player A | 8 | 2 | 80% |
| 2    | Player B | 7 | 3 | 70% |

### 5.6 Match History Filter

**File:** `frontend/src/components/MatchHistory.tsx`

**New Filter Option:**
```
Tournament Type: [ All ▼ ]
  - All
  - Ranked
  - Unranked
  - Team
```

**Behavior:**
- Filter player's match history by tournament type
- Default: Show all matches
- Selection updates query params and refetches

---

## 6. Validation & Business Logic

### 6.1 Tournament Creation Validation

| Scenario | Validation Rule | Error Message |
|----------|-----------------|---------------|
| Unranked selected, no factions | Must select ≥1 faction | "Select at least one faction" |
| Unranked selected, no maps | Must select ≥1 map | "Select at least one map" |
| Unranked selected, faction_a = faction_b | Cannot be same faction | "Factions must be different" |
| Unranked in STARTED status, try to update factions | Tournament must be CREATED/REGISTRATION | "Cannot modify assets after tournament starts" |
| Non-admin user creates unranked faction | Must be admin/organizer | "Insufficient permissions" |

### 6.2 Faction/Map Deletion Validation

| Scenario | Validation Rule | Error Message |
|----------|-----------------|---------------|
| Delete faction in use by **active** tournament | Blocked; return list | "Cannot delete faction - in use by X active tournaments" |
| Delete faction only in **completed/cancelled** tournaments | Allowed | Success message |
| Delete faction not used by any tournament | Allowed | Success message |
| Delete map in use by **active** tournament | Blocked; return list | "Cannot delete map - in use by X active tournaments" |
| Delete map only in **completed/cancelled** tournaments | Allowed | Success message |
| Delete map not used by any tournament | Allowed | Success message |
| Non-admin tries to delete faction | Blocked | "Insufficient permissions (admin only)" |
| Non-admin tries to delete map | Blocked | "Insufficient permissions (admin only)" |
| View faction usage (before delete) | Shows active/completed tournaments | List with can_delete flag |
| View map usage (before delete) | Shows active/completed tournaments | List with can_delete flag |

**Active Tournament Status Definition:**
- CREATED, REGISTRATION_OPEN, STARTED, MATCHES_ONGOING

**Completed Tournament Status Definition:**
- COMPLETED, CANCELLED, CANCELLED_IN_PROGRESS

### 6.3 Match Report Validation

| Scenario | Validation Rule | Error Message |
|----------|-----------------|---------------|
| Faction A not in tournament.unranked_factions | Must be in asset list | "Faction not available in this tournament" |
| Faction B not in tournament.unranked_factions | Must be in asset list | "Faction not available in this tournament" |
| Map not in tournament.unranked_maps | Must be in asset list | "Map not available in this tournament" |
| Player A == Player B | Cannot report match against self | "Players cannot be the same" |
| Reporter not in [Player A, Player B] | Reporter must be participant | "You must be a participant to report" |
| Tournament is ranked (not unranked) but using unranked factions | Must use ranked assets | "Use standard factions for ranked tournaments" |

### 6.3 Statistics Calculation Validation

| Data Point | Validation Rule |
|------------|-----------------|
| Player global rating | EXCLUDE all unranked matches |
| Player win/loss record (global) | EXCLUDE all unranked matches |
| Global leaderboard | ONLY include ranked matches |
| Tournament-specific standings | ONLY include matches from that tournament |
| Unranked tournament standings | Show wins/losses/% not ELO change |

---

## 7. Error Handling

### 7.1 Backend Error Responses

**Faction Creation Failed**
```json
{
  "success": false,
  "error": "DUPLICATE_FACTION_NAME",
  "message": "A faction with this name already exists"
}
```

**Map Creation Failed**
```json
{
  "success": false,
  "error": "INVALID_MAP_DIMENSIONS",
  "message": "Map dimensions must be between 10 and 200"
}
```

**Asset Not Found in Tournament**
```json
{
  "success": false,
  "error": "ASSET_NOT_IN_TOURNAMENT",
  "message": "Selected faction is not available in this tournament"
}
```

**Tournament Type Mismatch**
```json
{
  "success": false,
  "error": "INVALID_TOURNAMENT_TYPE",
  "message": "This operation is only available for unranked tournaments"
}
```

### 7.2 Frontend Error Handling

- **Network Errors:** Show "Unable to load factions. Please try again."
- **Validation Errors:** Show inline validation messages below inputs
- **Creation Errors:** Show error toast with 5-second timeout
- **Form Submission:** Disable submit button during API call, show spinner

---

## 8. Security & Permissions

### 8.1 Access Control

| Endpoint | Public | Auth | Admin | Organizer | Notes |
|----------|--------|------|-------|-----------|-------|
| GET /unranked-factions | ✗ | ✓ | ✓ | ✓ | Tournament admins only |
| POST /unranked-factions | ✗ | ✓ | ✓ | ✓ | Create new unranked factions |
| DELETE /unranked-factions/:id | ✗ | ✓ | ✓ | ✗ | Admin only; validates not in active tournaments |
| GET /unranked-factions/:id/usage | ✗ | ✓ | ✓ | ✗ | Admin only; shows usage before delete |
| GET /unranked-maps | ✗ | ✓ | ✓ | ✓ | Tournament admins only |
| POST /unranked-maps | ✗ | ✓ | ✓ | ✓ | Create new unranked maps |
| DELETE /unranked-maps/:id | ✗ | ✓ | ✓ | ✗ | Admin only; validates not in active tournaments |
| GET /unranked-maps/:id/usage | ✗ | ✓ | ✓ | ✗ | Admin only; shows usage before delete |
| GET /tournaments/:id/unranked-assets | ✓ | - | - | - | Public read for tournament info |
| POST /report-match (unranked) | ✗ | ✓ | - | - | Authenticated players only |

### 8.2 Data Validation

- **SQL Injection Prevention:** Use parameterized queries for all faction/map operations
- **Tournament Ownership:** Verify user is tournament organizer before asset updates
- **Asset Integrity:** Ensure faction/map IDs exist before linking to tournament
- **Type Safety:** Validate tournament_type enum in all queries
- **Audit Trail:** Log all faction/map creation with user_id and timestamp

---

## 9. Migration Path & Backward Compatibility

### 9.1 Existing Data Handling
- All existing tournaments default to `tournament_type = 'ranked'`
- All existing factions/maps default to `is_ranked = true`
- No existing data is modified during migration
- Ranked tournaments continue to work exactly as before

### 9.2 Deployment Strategy
1. Deploy database migration (add columns/tables)
2. Deploy backend routes and validation
3. Deploy frontend UI components
4. Test in dev/main environment
5. Merge to production

### 9.3 Rollback Plan
- Remove `tournament_type` column from tournaments (set all to NULL = 'ranked')
- Remove `is_ranked` column from factions and maps
- Drop `tournament_unranked_factions` and `tournament_unranked_maps` tables
- Remove new endpoints
- Revert frontend UI to single select for factions/maps

---

## 10. Testing Checklist

### 10.1 Backend Tests
- [ ] Create unranked faction successfully
- [ ] Duplicate faction name returns error
- [ ] Create unranked map successfully
- [ ] Invalid map dimensions return error
- [ ] Update tournament unranked assets successfully
- [ ] Non-organizer cannot update assets (403 Forbidden)
- [ ] Delete faction NOT in any tournament - succeeds
- [ ] Delete faction in use by **active** tournament - returns error with tournament list
- [ ] Delete faction only used by **completed** tournaments - succeeds
- [ ] Delete map NOT in any tournament - succeeds
- [ ] Delete map in use by **active** tournament - returns error with tournament list
- [ ] Delete map only used by **completed** tournaments - succeeds
- [ ] Get faction usage shows active and completed tournaments separately
- [ ] Get map usage shows active and completed tournaments separately
- [ ] Non-admin cannot delete faction (403 Forbidden)
- [ ] Non-admin cannot delete map (403 Forbidden)
- [ ] Non-admin cannot view faction usage (403 Forbidden)
- [ ] Non-admin cannot view map usage (403 Forbidden)
- [ ] Report unranked match does NOT calculate ELO
- [ ] Unranked match excluded from player rating calculation
- [ ] Unranked tournament standings show wins/losses only
- [ ] Global leaderboard excludes unranked matches
- [ ] Backward compatibility: ranked tournaments unaffected

### 10.2 Frontend Tests
- [ ] Tournament creation shows radio buttons correctly
- [ ] Selecting "Unranked" reveals faction/map multi-selects
- [ ] Selecting "Ranked" hides unranked options
- [ ] Add new faction modal works and adds to list
- [ ] Add new map modal works and adds to list
- [ ] At least 1 faction required before submit
- [ ] At least 1 map required before submit
- [ ] Admin can view faction usage before delete
- [ ] Admin can view map usage before delete
- [ ] Delete button disabled if faction/map in active tournament
- [ ] Delete button enabled if faction/map only in completed tournaments
- [ ] Delete shows confirmation with usage details
- [ ] Organizer cannot see delete buttons (no permission)
- [ ] Match report form validates faction in tournament
- [ ] Match report form validates map in tournament
- [ ] Unranked match report shows "no rating impact" message
- [ ] Tournament standings show wins/losses for unranked
- [ ] Match history filter works for all types

### 10.3 Integration Tests
- [ ] Create unranked tournament → report match → verify standings
- [ ] Create unranked faction → use in tournament → verify in match report
- [ ] Create unranked map → use in tournament → verify in match report
- [ ] Player plays ranked and unranked → global rating only from ranked
- [ ] Multiple tournaments using same unranked faction
- [ ] Multiple tournaments using same unranked map
- [ ] Delete faction not in any tournament → success
- [ ] Delete faction in **active** tournament → error (cannot delete)
- [ ] Delete faction only in **completed** tournament → success
- [ ] Delete map not in any tournament → success
- [ ] Delete map in **active** tournament → error (cannot delete)
- [ ] Delete map only in **completed** tournament → success
- [ ] Create faction → use in tournament A (STARTED) → try delete → error with tournament A in list
- [ ] Create faction → use in tournament A (COMPLETED) → delete → success
- [ ] Create faction → use in tournament A (ACTIVE) and tournament B (COMPLETED) → try delete → error showing only active
- [ ] Tournament ends/completes → faction becomes deletable if no other active tournaments use it

---

## 11. Implementation Order

1. **Phase 1: Database & Backend**
   - [ ] Run migration (create tables, add columns)
   - [ ] Implement faction/map endpoints (GET, POST)
   - [ ] Implement faction/map deletion with validation (DELETE)
   - [ ] Implement faction/map usage endpoints (GET /usage)
   - [ ] Implement asset association endpoints (PUT)
   - [ ] Update match report validation
   - [ ] Update standings calculation
   - [ ] Update rating calculation

2. **Phase 2: Frontend UI**
   - [ ] Create UnrankedFactionSelect component
   - [ ] Create UnrankedMapSelect component
   - [ ] Update TournamentForm with radio buttons
   - [ ] Update MatchReport component
   - [ ] Update TournamentStandings component
   - [ ] Add match history filter

3. **Phase 3: Testing & Deployment**
   - [ ] Run test checklist
   - [ ] Test in dev environment
   - [ ] Deploy to main branch
   - [ ] Final testing on main
   - [ ] Deploy to production
   - [ ] Monitor logs for errors

---

## 12. Success Criteria

✅ Organizer can create unranked tournaments with custom factions/maps  
✅ Players can register and participate in unranked tournaments  
✅ Unranked match reporting does NOT affect player ELO ratings  
✅ Global leaderboard excludes all unranked matches  
✅ Tournament-specific standings show only tournament matches  
✅ Unranked factions/maps are reusable across tournaments  
✅ Factions/maps remain in global list even after tournament deletion  
✅ Admin can delete factions/maps NOT in **active** tournaments  
✅ Admin cannot delete factions/maps in **active** tournaments (returns error list)  
✅ Admin can view usage details before attempting deletion  
✅ Organizers cannot delete factions/maps (admin-only operation)  
✅ Backward compatibility maintained for ranked tournaments  
✅ All validation rules enforced on frontend and backend  
✅ Proper error messages for all failure scenarios  
✅ Performance: Unranked queries do not slow down existing operations  

---

**Document Version:** 1.0  
**Last Updated:** January 11, 2026  
**Next Document:** TeamTournaments.md (Feature 2 specification)
