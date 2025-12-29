# Deprecated Player Statistics Migrations

This folder contains obsolete migration files that have been consolidated into a single, unified migration.

## Why These Files Are Deprecated

Multiple migration attempts were made between 2025-12-28 and 2025-12-29 to implement the player statistics feature:
- Each attempt had incremental fixes
- Some contained syntax errors or incomplete implementations
- All were replaced by a single, consolidated, verified-working version

## Migration Files (Archived)

1. **20251228_player_match_statistics.sql** - Original migration without ON CONFLICT fixes
2. **20251228_fix_player_stats.sql** - Partial fix attempt
3. **20251228_fix_recalculate.sql** - Another fix iteration
4. **20251228_fix_recalculate_v2.sql** - Yet another iteration
5. **20251228_rebuild_player_stats.sql** - Rebuild attempt
6. **20251228_z_expand_player_stats.sql** - Schema expansion attempt
7. **20251229_add_opponent_stats_columns.sql** - Additional columns
8. **20251229_fix_player_stats_recalculation.sql** - Contains syntax error at position 7190

## Current Active Migration

All functionality is now provided by:
- **`backend/migrations/20251230_unified_player_statistics.sql`**

This unified migration:
- Combines all working code from the manual SUPABASE_MANUAL_MIGRATION.sql
- Includes all ON CONFLICT clauses to prevent duplicate key violations
- Has been verified to work in Supabase production
- Is the only player_statistics migration in active use

## Reference for Future Changes

If you need to modify player statistics functionality:
1. Edit `20251230_unified_player_statistics.sql` (the active migration)
2. Test changes in Supabase SQL Editor
3. Do NOT create new migrations in this folder
4. Do NOT revert to any files in the deprecated/ folder

## Historical Note

The ON CONFLICT solution was critical - without it, mass INSERT statements would fail with:
```
ERROR: 23505: duplicate key value violates unique constraint
```

All 7 INSERT statements now include conflict handling:
```sql
INSERT INTO player_match_statistics (...)
SELECT ...
ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), ...) 
DO UPDATE SET ...
```

This ensures idempotent, repeatable migrations.
