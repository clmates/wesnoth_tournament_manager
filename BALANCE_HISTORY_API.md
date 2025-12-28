# Balance History API Documentation

## Overview

The Balance History system enables tracking and analysis of game balance changes over time. It consists of:

1. **Daily Snapshots** - Automatic daily captures of faction/map statistics (`faction_map_statistics_history`)
2. **Balance Events** - Explicit records of patches, nerfs, buffs (`balance_events`)
3. **Impact Analysis** - Before/after comparison tools to measure patch effectiveness
4. **Trend Analysis** - Historical winrate trends for specific matchups

## Database Schema

### `faction_map_statistics_history` Table

Daily snapshot of balance statistics for every faction/map/opponent combination.

```sql
- id: UUID (primary key)
- snapshot_date: DATE (UNIQUE per matchup)
- snapshot_timestamp: TIMESTAMP
- map_id: UUID (FK → game_maps)
- faction_id: UUID (FK → factions)
- opponent_faction_id: UUID (FK → factions)
- total_games: INT (number of matches in snapshot)
- wins: INT
- losses: INT
- winrate: DECIMAL(5,2) (0-100%)
- sample_size_category: VARCHAR('small'|'medium'|'large')
- confidence_level: DECIMAL(5,2) (0-100%)
- created_at: TIMESTAMP
```

**Confidence Levels:**
- `small` (<10 games) - 25% confidence
- `medium` (10-50 games) - 50-75% confidence
- `large` (50+ games) - 95% confidence

### `balance_events` Table

Explicit records of balance changes for analysis and documentation.

```sql
- id: UUID (primary key)
- event_date: TIMESTAMP (when the change went live)
- patch_version: VARCHAR(20) (e.g., "1.14.2")
- event_type: VARCHAR(50) - BUFF|NERF|REWORK|HOTFIX|GENERAL_BALANCE_CHANGE
- faction_id: UUID (nullable - faction affected, or NULL for global)
- map_id: UUID (nullable - map affected, or NULL for all maps)
- description: TEXT (what was changed)
- notes: TEXT (optional additional context)
- created_by: UUID (user who logged the event)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## API Endpoints

### 1. Get Balance Trend

**Endpoint:** `GET /statistics/history/trend`

Get winrate trend for a specific faction/map matchup over a date range.

**Query Parameters:**
- `mapId` (required) - UUID of map
- `factionId` (required) - UUID of faction
- `opponentFactionId` (required) - UUID of opponent faction
- `dateFrom` (required) - Start date (ISO format: YYYY-MM-DD)
- `dateTo` (required) - End date (ISO format: YYYY-MM-DD)

**Example Request:**
```
GET /statistics/history/trend?mapId=abc123&factionId=def456&opponentFactionId=ghi789&dateFrom=2024-12-01&dateTo=2024-12-31
```

**Response:**
```json
[
  {
    "snapshot_date": "2024-12-01",
    "total_games": 15,
    "wins": 10,
    "losses": 5,
    "winrate": 66.67,
    "confidence_level": 50.0,
    "sample_size_category": "medium"
  },
  {
    "snapshot_date": "2024-12-02",
    "total_games": 18,
    "wins": 11,
    "losses": 7,
    "winrate": 61.11,
    "confidence_level": 50.0,
    "sample_size_category": "medium"
  }
]
```

---

### 2. List Balance Events

**Endpoint:** `GET /statistics/history/events`

Retrieve all balance events with optional filtering.

**Query Parameters:**
- `factionId` (optional) - Filter by affected faction
- `mapId` (optional) - Filter by affected map
- `eventType` (optional) - Filter by type (BUFF, NERF, REWORK, HOTFIX, GENERAL_BALANCE_CHANGE)
- `limit` (optional) - Results per page (default: 50)
- `offset` (optional) - Pagination offset (default: 0)

**Example Request:**
```
GET /statistics/history/events?eventType=NERF&factionId=abc123&limit=20
```

**Response:**
```json
[
  {
    "id": "evt-001",
    "event_date": "2024-12-20T08:00:00Z",
    "patch_version": "1.14.2",
    "event_type": "NERF",
    "description": "Reduced Undead resurrection chance from 30% to 20%",
    "faction_name": "Undead",
    "map_name": null,
    "created_by_name": "game_designer"
  },
  {
    "id": "evt-002",
    "event_date": "2024-12-18T10:30:00Z",
    "patch_version": "1.14.1",
    "event_type": "BUFF",
    "description": "Increased Elvish Marksman damage by 5%",
    "faction_name": "Elves",
    "map_name": null,
    "created_by_name": "game_designer"
  }
]
```

---

### 3. Get Balance Event Impact

**Endpoint:** `GET /statistics/history/events/:eventId/impact`

Compare balance before and after a specific event.

**Path Parameters:**
- `eventId` - UUID of balance event

**Query Parameters:**
- `daysBefore` (optional) - Days before event to include (default: 30)
- `daysAfter` (optional) - Days after event to include (default: 30)

**Example Request:**
```
GET /statistics/history/events/evt-001/impact?daysBefore=30&daysAfter=30
```

**Response:**
```json
[
  {
    "map_id": "map-001",
    "map_name": "Highlands",
    "faction_id": "und-001",
    "faction_name": "Undead",
    "opponent_faction_id": "elf-001",
    "opponent_faction_name": "Elves",
    "winrate_before": 64.5,
    "winrate_after": 58.3,
    "winrate_change": -6.2,
    "sample_size_before": 45,
    "sample_size_after": 52,
    "games_before": 1350,
    "games_after": 1560
  },
  {
    "map_id": "map-002",
    "map_name": "Coastal",
    "faction_id": "und-001",
    "faction_name": "Undead",
    "opponent_faction_id": "elf-001",
    "opponent_faction_name": "Elves",
    "winrate_before": 52.1,
    "winrate_after": 49.8,
    "winrate_change": -2.3,
    "sample_size_before": 36,
    "sample_size_after": 41,
    "games_before": 1080,
    "games_after": 1230
  }
]
```

---

### 4. Get Snapshot Data

**Endpoint:** `GET /statistics/history/snapshot`

Get all balance data as it was on a specific date.

**Query Parameters:**
- `date` (required) - Snapshot date (ISO format: YYYY-MM-DD)
- `minGames` (optional) - Minimum games for inclusion (default: 2)

**Example Request:**
```
GET /statistics/history/snapshot?date=2024-12-20&minGames=5
```

**Response:**
```json
[
  {
    "map_id": "map-001",
    "map_name": "Highlands",
    "faction_id": "und-001",
    "faction_name": "Undead",
    "opponent_faction_id": "elf-001",
    "opponent_faction_name": "Elves",
    "total_games": 45,
    "wins": 29,
    "losses": 16,
    "winrate": 64.44,
    "sample_size_category": "medium",
    "confidence_level": 75.0,
    "snapshot_date": "2024-12-20"
  }
]
```

---

### 5. Create Balance Event (Admin Only)

**Endpoint:** `POST /statistics/history/events`

Record a new balance change. Requires admin authentication.

**Request Body:**
```json
{
  "event_date": "2024-12-20T08:00:00Z",
  "patch_version": "1.14.2",
  "event_type": "NERF",
  "description": "Reduced Undead resurrection chance from 30% to 20%",
  "faction_id": "und-001",
  "map_id": null,
  "notes": "Undead was too strong in late game"
}
```

**Fields:**
- `event_date` (required) - When the change went live
- `patch_version` (optional) - Version number
- `event_type` (required) - One of: BUFF, NERF, REWORK, HOTFIX, GENERAL_BALANCE_CHANGE
- `description` (required) - What was changed
- `faction_id` (optional) - Affected faction (NULL for non-faction-specific)
- `map_id` (optional) - Affected map (NULL for all maps)
- `notes` (optional) - Additional context

**Response (201 Created):**
```json
{
  "id": "evt-003",
  "event_date": "2024-12-20T08:00:00Z",
  "patch_version": "1.14.2",
  "event_type": "NERF",
  "description": "Reduced Undead resurrection chance from 30% to 20%",
  "created_at": "2024-12-20T10:30:00Z"
}
```

---

### 6. Create Manual Snapshot (Admin Only)

**Endpoint:** `POST /statistics/history/snapshot`

Manually trigger a snapshot for a specific date. Useful for backfilling historical data.

**Request Body:**
```json
{
  "date": "2024-12-01"
}
```

**Response:**
```json
{
  "message": "Snapshot created successfully",
  "snapshots_created": 42,
  "snapshots_skipped": 0,
  "date": "2024-12-01"
}
```

---

## Usage Examples

### Example 1: Verify Patch Effectiveness

You apply a nerf to Undead on Dec 20. Get impact analysis:

```bash
curl "http://api/statistics/history/events/evt-001/impact?daysBefore=30&daysAfter=30"
```

This shows how Undead's winrate changed across all maps/matchups 30 days before and after the patch.

### Example 2: Monitor Specific Matchup

Track how Undead vs Elves evolved on Highlands:

```bash
curl "http://api/statistics/history/trend?mapId=map-001&factionId=und-001&opponentFactionId=elf-001&dateFrom=2024-12-01&dateTo=2024-12-31"
```

Plot the returned data to visualize the trend.

### Example 3: Compare Two Balance States

Get snapshot before balance changes:

```bash
curl "http://api/statistics/history/snapshot?date=2024-12-19"
```

And after:

```bash
curl "http://api/statistics/history/snapshot?date=2024-12-21"
```

Compare the winrates manually or in frontend.

---

## Database Functions

### `create_faction_map_statistics_snapshot(date)`

Creates a snapshot of current statistics for a given date.

**Called by:**
- `daily_snapshot_faction_map_statistics()` (automatic daily)
- Manual admin request via endpoint

**Returns:** (snapshots_created INT, snapshots_skipped INT)

### `daily_snapshot_faction_map_statistics()`

Scheduled function to create snapshots for the previous day.

**How to Schedule:**

**Option A: Using pg_cron extension**
```sql
-- Install pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily at 00:30 UTC
SELECT cron.schedule('daily_faction_balance_snapshot', '30 0 * * *', 'SELECT daily_snapshot_faction_map_statistics()');
```

**Option B: Application-level scheduling (Node.js)**
```javascript
import cron from 'node-cron';

// Run daily at 00:30 UTC
cron.schedule('30 0 * * *', async () => {
  console.log('Creating daily balance snapshot...');
  const result = await query('SELECT daily_snapshot_faction_map_statistics()');
  console.log('Snapshot complete');
});
```

### `get_balance_event_impact(event_id, days_before, days_after)`

Compares balance before and after a balance event.

**Returns columns:**
- map_id, map_name
- faction_id, faction_name
- opponent_faction_id, opponent_faction_name
- winrate_before, winrate_after, winrate_change
- sample_size_before, sample_size_after
- games_before, games_after

### `get_balance_trend(map_id, faction_id, opponent_faction_id, date_from, date_to)`

Returns historical winrate trend for a specific matchup.

**Returns columns:**
- snapshot_date
- total_games, wins, losses
- winrate
- confidence_level
- sample_size_category

---

## Setup Instructions

### 1. Apply Migration

```bash
cd backend
npm run migrate -- --file 20251228_balance_history.sql
```

### 2. Configure Automatic Snapshots

**Using pg_cron (recommended for PostgreSQL 10+):**

```sql
-- Connect to database
psql -d your_database

-- Install extension (one time)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily snapshot
SELECT cron.schedule('daily_faction_balance_snapshot', '30 0 * * *', 'SELECT daily_snapshot_faction_map_statistics()');

-- Verify scheduling
SELECT * FROM cron.job;
```

**Or use application-level cron:**

```bash
npm install node-cron
```

Then in your app initialization:
```javascript
import cron from 'node-cron';
import { query } from '../config/database.js';

cron.schedule('30 0 * * *', async () => {
  try {
    await query('SELECT daily_snapshot_faction_map_statistics()');
    console.log('Daily balance snapshot created');
  } catch (error) {
    console.error('Failed to create snapshot:', error);
  }
});
```

### 3. Backfill Historical Data (Optional)

If you want snapshots for dates before the migration:

```bash
# Create snapshot for last 30 days
for i in {30..1}; do
  DATE=$(date -d "-$i days" +%Y-%m-%d)
  curl -X POST http://api/statistics/history/snapshot \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"date\": \"$DATE\"}"
done
```

---

## Frontend Integration

### Display Balance Trend Chart

```typescript
// Get trend data
const trend = await fetch(`/statistics/history/trend?mapId=${mapId}&factionId=${factionId}&opponentFactionId=${opponentId}&dateFrom=2024-12-01&dateTo=2024-12-31`);
const data = await trend.json();

// Plot with chart library (e.g., Chart.js, Recharts)
const dates = data.map(d => d.snapshot_date);
const winrates = data.map(d => d.winrate);

// Create chart...
```

### Show Balance Event Timeline

```typescript
// Get events
const events = await fetch('/statistics/history/events');
const eventList = await events.json();

// Render timeline with annotations...
```

### Before/After Comparison

```typescript
// Get impact of event
const impact = await fetch(`/statistics/history/events/${eventId}/impact`);
const comparison = await impact.json();

// Show delta winrates and sample sizes...
```

---

## Notes

- Snapshots are created daily at 00:30 UTC by default
- Each snapshot captures data exactly as it appears in `faction_map_statistics` at that moment
- Only matchups with at least 1 game are included in snapshots
- Confidence levels help identify statistically significant changes
- Balance events should be logged when patches go live for proper before/after analysis
- Historical data enables measuring patch effectiveness and long-term balance trends
