# Database Schema Update Instructions

## Current Status

The codebase has been updated to use the new tournament round configuration system:
- ✅ **Backend code** compiled successfully with new schema references
- ✅ **Frontend code** compiled successfully with new form logic
- ✅ **Schema.sql** updated with new structure
- ❓ **Database** - Needs to be updated to match the new schema

## What Changed in the Schema

### Removed Columns
- ❌ `tournaments.great_final` (boolean)

### Added Columns
- ✅ `tournaments.general_rounds` (integer)
- ✅ `tournaments.final_rounds` (integer)
- ✅ `tournaments.registration_closed_at` (timestamp)
- ✅ `tournaments.prepared_at` (timestamp)
- ✅ `tournament_rounds.round_type` (varchar with CHECK constraint)

### Updated Constraints
- ✅ `tournament_rounds.round_type` CHECK: `('general', 'final')` only (was: 'general', 'final_rounds', 'great_final')
- ✅ Match format auto-determined:
  - `round_type='general'` → `match_format='bo3'`
  - `round_type='final'` → `match_format='bo5'`

### New Status Lifecycle
- Old: `pending`, `in_progress`, `finished`
- New: `registration_open`, `registration_closed`, `prepared`, `in_progress`, `finished`

## How to Update Your Database

### Option 1: Fresh Database (Recommended for Development)

If you're starting fresh or willing to reset the database:

```bash
# Stop containers
docker-compose down -v

# Recreate and initialize
docker-compose up -d

# The schema will be applied automatically on container startup
```

### Option 2: Update Existing Database (Production)

If you have existing data:

**Step 1: Backup your database**
```bash
docker-compose exec postgres pg_dump -U postgres wesnoth_tournament > backup.sql
```

**Step 2: Apply the migration script**
```bash
docker-compose exec postgres psql -U postgres -d wesnoth_tournament -f /path/to/update_schema_to_v2.sql
```

Or manually from psql:
```sql
-- Connect to your database
psql -U postgres -h localhost -d wesnoth_tournament

-- Run the migration file
\i /path/to/backend/migrations/update_schema_to_v2.sql

-- Verify the changes
\d tournaments
\d tournament_rounds
```

**Step 3: Verify the migration**
```sql
-- Check columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tournaments' 
ORDER BY ordinal_position;

-- Check constraint exists
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'tournament_rounds' 
AND constraint_name LIKE '%round_type%';
```

### Option 3: Manual SQL Updates

If you prefer to apply changes manually:

```sql
-- Add new columns
ALTER TABLE tournaments 
  ADD COLUMN general_rounds INTEGER DEFAULT 0,
  ADD COLUMN final_rounds INTEGER DEFAULT 0,
  ADD COLUMN registration_closed_at TIMESTAMP,
  ADD COLUMN prepared_at TIMESTAMP;

-- Add round_type to tournament_rounds
ALTER TABLE tournament_rounds 
  ADD COLUMN round_type VARCHAR(20) DEFAULT 'general',
  ADD CONSTRAINT tournament_rounds_round_type_check 
    CHECK (round_type IN ('general', 'final'));

-- Update old data
UPDATE tournament_rounds 
SET round_type = 'final' 
WHERE round_type = 'final_rounds' OR round_type = 'great_final';

UPDATE tournament_rounds 
SET match_format = 'bo3' WHERE round_type = 'general';
UPDATE tournament_rounds 
SET match_format = 'bo5' WHERE round_type = 'final';

-- Update tournament status
UPDATE tournaments SET status = 'registration_open' WHERE status = 'pending';
UPDATE tournaments SET status = 'in_progress' WHERE status = 'active';

-- Create indexes
CREATE INDEX idx_tournament_rounds_type ON tournament_rounds(round_type);
CREATE INDEX idx_tournaments_status ON tournaments(status);
```

## Verification Checklist

After updating, verify:

- [ ] `tournaments` table has columns: `general_rounds`, `final_rounds`, `registration_closed_at`, `prepared_at`
- [ ] `tournament_rounds` table has column: `round_type` with CHECK constraint
- [ ] All `tournament_rounds.round_type` values are either 'general' or 'final'
- [ ] Match formats match round types:
  - All 'general' rounds have `match_format='bo3'`
  - All 'final' rounds have `match_format='bo5'`
- [ ] Tournament statuses are updated to new values (no 'pending' or 'active')
- [ ] No errors in application logs when creating tournaments

## If You Have Existing Tournaments

### Important: max_participants Requirement

The new system **requires** `max_participants` to be set for all tournaments. If you have existing tournaments with NULL:

```sql
-- Check for tournaments with NULL max_participants
SELECT id, name FROM tournaments WHERE max_participants IS NULL;

-- You must manually set these values:
UPDATE tournaments SET max_participants = 16 WHERE id = '<tournament_id>';
```

### Migrate Round Configuration

If you have existing `tournament_rounds` entries, you should populate `general_rounds` and `final_rounds` in the tournament record:

```sql
-- For each tournament, count the rounds by type:
UPDATE tournaments t SET 
  general_rounds = (
    SELECT COUNT(*) FROM tournament_rounds tr 
    WHERE tr.tournament_id = t.id AND tr.round_type = 'general'
  ),
  final_rounds = (
    SELECT COUNT(*) FROM tournament_rounds tr 
    WHERE tr.tournament_id = t.id AND tr.round_type = 'final'
  )
WHERE t.status != 'registration_open';
```

## Files Involved

- `backend/src/config/schema.sql` - Main schema definition (already updated)
- `backend/migrations/006_tournament_rounds.sql` - Migration file (updated)
- `backend/migrations/update_schema_to_v2.sql` - Comprehensive update script (NEW)

## Questions?

- Check `TOURNAMENT_ROUNDS_IMPLEMENTATION.md` for implementation details
- Check `TOURNAMENT_ROUNDS_SUMMARY.md` for conceptual overview
- See `backend/src/routes/tournaments.ts` for endpoint implementations
