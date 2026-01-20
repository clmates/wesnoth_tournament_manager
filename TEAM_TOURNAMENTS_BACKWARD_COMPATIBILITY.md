# Team Tournaments - Backward Compatibility Analysis

## Summary
✅ **NO IMPACT** on existing tournament functionality (ranked/unranked tournaments)

The addition of `team_id` and `team_position` to `tournament_participants` is fully backward compatible because:

1. **Both fields are NULLABLE**
2. **Existing code doesn't reference these fields**
3. **All SQL queries work with NULL values**

---

## Changes Made to Schema

```sql
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL;
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS team_position SMALLINT CHECK (team_position IS NULL OR team_position IN (1, 2));
```

**Key Properties:**
- `team_id` → `NULL` for ranked/unranked tournaments (ON DELETE SET NULL for safety)
- `team_position` → `NULL` for ranked/unranked tournaments (CHECK constraint allows NULL)
- `IF NOT EXISTS` → Safe to run multiple times

---

## Backward Compatibility Analysis

### INSERT Operations
```typescript
// Existing code - still works perfectly
INSERT INTO tournament_participants (tournament_id, user_id, participation_status)
VALUES ($1, $2, 'accepted')
```
✅ `team_id` and `team_position` default to NULL → No changes needed

### SELECT Operations
```typescript
// Examples from codebase:
SELECT * FROM tournament_participants WHERE tournament_id = $1
SELECT tp.*, u.nickname FROM tournament_participants tp JOIN users u ON tp.user_id = u.id WHERE tp.id = $1
SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = $1
```
✅ All queries work fine with extra NULL columns - they're simply ignored if not used

### UPDATE Operations
```typescript
// Existing code - still works perfectly
UPDATE tournament_participants 
SET participation_status = $1 
WHERE id = $2 AND tournament_id = $3
```
✅ Updates don't reference team fields → No impact

### JOIN Queries & Statistics
```typescript
// Tiebreaker calculations - still works
SELECT * FROM tournament_participants 
WHERE tournament_id = $1 
ORDER BY tournament_points DESC, omp DESC, gwp DESC, ogp DESC
```
✅ Tiebreaker columns unaffected by new fields

---

## Code Review Checklist

| Operation | Location | Status | Details |
|-----------|----------|--------|---------|
| Insert new participant | `tournaments.ts:440` | ✅ | Only fills `tournament_id`, `user_id`, `participation_status` |
| Request to join | `tournaments.ts:481` | ✅ | Same INSERT pattern |
| Select participant | `tournaments.ts:547` | ✅ | `SELECT *` works with extra NULL columns |
| Update status | `tournaments.ts:561` | ✅ | Only updates `participation_status` |
| Count participants | `tournaments.ts:491` | ✅ | COUNT query unaffected |
| Tiebreaker query | `tournaments.ts:2177` | ✅ | Sorts by tournament_points/omp/gwp/ogp (unchanged) |
| Delete tournament | `tournaments.ts:368` | ✅ | Cascading delete of participants still works |

---

## Trigger Safety

New triggers check `IF NEW.team_id IS NOT NULL` before validating:
- Team member count limit
- Unique positions per team

**Result:** Triggers never fire for existing ranked/unranked tournaments (team_id = NULL)

---

## Migration Execution

The migration is **idempotent and safe**:
- Uses `IF NOT EXISTS` clauses
- Only adds columns (never removes existing data)
- All constraints allow NULL values
- Can be run against production safely

---

## Recommendations

### ✅ Safe to Execute
- Migration can be deployed immediately
- No application code changes needed
- Existing endpoints continue working unchanged

### 🔄 When Implementing Team Tournaments
1. Add logic to check `tournament.tournament_type` before accessing `team_id`
2. In team tournament flows, require filling `team_id` and `team_position`
3. For ranked/unranked, leave these fields NULL (current behavior maintained)

### 🧪 Testing
```sql
-- Verify backward compatibility
SELECT * FROM tournament_participants WHERE tournament_id = '<any-existing-tournament>';
-- Result should show NULL values for team_id and team_position

-- Verify constraint works
UPDATE tournament_participants SET team_position = 3; 
-- Should fail with CHECK constraint error
```

---

## Conclusion

**Backward Compatibility Level: 100%** ✅

No breaking changes to existing functionality. Existing tournaments (ranked/unranked) will continue to work unchanged with these NULL columns present but unused.
