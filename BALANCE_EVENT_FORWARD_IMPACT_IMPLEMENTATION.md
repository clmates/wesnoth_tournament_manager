# Balance Event Forward Impact Implementation

## Summary
Changed balance event impact analysis from "before/after 30-day comparison" to "from event date onwards" temporal view. This shows how balance changes affect stats from the moment they're applied until the next event or today.

## Changes Made

### 1. **Database Schema** (New Migration)
**File:** `backend/migrations/20251229_balance_event_forward_impact.sql`

- **New Function:** `get_balance_event_forward_impact(event_id UUID)`
- **Logic:**
  - Gets event date from `balance_events` table
  - Finds next event date (if exists), otherwise uses `CURRENT_DATE`
  - Returns all daily snapshots from `faction_map_statistics_history` between these dates
  - Calculates `days_since_event` for each snapshot
  - Applies optional faction/map filters from the event record

- **Returns:**
  ```
  map_id, map_name, faction_id, faction_name, opponent_faction_id, 
  opponent_faction_name, winrate, total_games, wins, losses, 
  snapshot_date, days_since_event
  ```

- **Key Query:**
  ```sql
  WHERE fms.snapshot_date BETWEEN v_event_date AND v_next_event_date
  ORDER BY fms.snapshot_date ASC, fms.map_id, fms.faction_id
  ```

### 2. **Backend API** 
**File:** `backend/src/routes/statistics.ts`

- **Endpoint:** `GET /statistics/history/events/:eventId/impact`
- **Updated Logic:** Now calls the new `get_balance_event_forward_impact()` function
- **Previous:** Called `get_balance_event_impact()` with daysBefore/daysAfter parameters
- **Advantage:** Database handles all date logic, endpoint is simpler

### 3. **Frontend Component**
**File:** `frontend/src/components/BalanceEventImpactPanel.tsx`

- **Interface Update:** `ImpactData` restructured
  ```typescript
  interface ImpactData {
    map_id: string;
    map_name: string;
    faction_id: string;
    faction_name: string;
    opponent_faction_id: string;
    opponent_faction_name: string;
    winrate: number;
    total_games: number;
    wins: number;
    losses: number;
    snapshot_date: string;      // NEW
    days_since_event: number;   // NEW (replaces before/after/change fields)
  }
  ```

- **Table Columns:** Now displays temporal progression from event date
  - Date | Days Since | Map | Faction | vs | Win Rate | Games

- **Color Logic:** Updated from positive/negative delta to winrate thresholds
  ```typescript
  const getChangeColorClass = (winrate: number): string => {
    if (winrate >= 60) return 'positive';      // Strong
    if (winrate >= 50) return 'neutral';       // Balanced
    return 'negative';                          // Weak
  };
  ```

### 4. **Translations** (5 Languages)
**Files:** `frontend/src/i18n/locales/{en,es,de,ru,zh}.json`

**Updated Keys:**
- `impact_analysis`: "Balance Statistics from Event Date" (was "Impact Analysis (30 days before/after)")
- `days_since`: "Days Since" (new)
- `games`: Localized plural for games/partidos (new)
- `vs`: Opponent label (new)
- `loading`: Loading indicator (new)
- `no_data_available`: Empty state message (new)

**Translations by Language:**
- **English:** "Balance Statistics from Event Date"
- **Spanish:** "Estadísticas de Balance desde Evento"
- **German:** "Balance-Statistiken ab Ereignis"
- **Russian:** "Статистика баланса с момента события"
- **Chinese:** "从事件开始的平衡统计"

## Data Flow

```
1. User selects a Balance Event
   ↓
2. Frontend calls GET /statistics/history/events/:eventId/impact
   ↓
3. Backend executes: SELECT * FROM get_balance_event_forward_impact($1)
   ↓
4. SQL Function:
   - Gets event_date from balance_events
   - Finds next_event_date or uses TODAY
   - Returns snapshots from faction_map_statistics_history 
     for date range [event_date, next_event_date]
   ↓
5. Frontend receives array of {snapshot_date, days_since_event, ...stats}
   ↓
6. Component renders chronological table showing progression
   from event date onwards
```

## Usage Example

**Scenario:** Balance event created 2025-11-26
- First available snapshot: 2025-12-23
- Next balance event: (none)
- Today: 2025-12-27

**Display:**
```
Date       | Days Since | Map       | Faction | vs      | Win Rate | Games
2025-12-23 | 27         | Great Rift| Elves   | vs Orcs | 52.3%    | 127
2025-12-26 | 30         | Great Rift| Elves   | vs Orcs | 51.8%    | 142
2025-12-27 | 31         | Great Rift| Elves   | vs Orcs | 53.2%    | 156
```

The data shown is all snapshots FROM the event date (or nearest available) onwards to today or the next event.

## Benefits

1. **Realistic Analysis:** Acknowledges that data may not exist before the event
2. **Simple Logic:** No complex before/after calculations needed
3. **User-Friendly:** Clear temporal progression of impact
4. **Scalable:** Works for any balance event regardless of data availability
5. **Consistent:** Same approach for all 5 language interfaces

## Related Features

- **Recalculate Snapshots:** Button on AdminBalanceEvents page to generate historical snapshots retroactively
- **Balance Event Creation:** Full event lifecycle managed in AdminBalanceEvents component
- **Dashboard View:** Overall statistics available in AdminDashboard and other pages

## Testing Checklist

- [ ] SQL migration applies without errors
- [ ] Function returns correct data range (event_date to next_event_date or today)
- [ ] days_since_event calculated correctly
- [ ] Frontend table displays all columns
- [ ] Translations render correctly for all 5 languages
- [ ] Winrate color classes apply based on thresholds
- [ ] Empty state message shows when no data available
- [ ] Date formatting respects user locale

## Performance Notes

- Daily snapshots created by `create_faction_map_statistics_snapshot()` function
- Queries against indexed `faction_map_statistics_history` table
- No real-time recalculation (uses pre-computed snapshots)
- Function includes optional faction/map filtering from event record
