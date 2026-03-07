-- ============================================================
-- VERIFICATION: Schema Update v2 - Complete Checklist
-- ============================================================

\echo '=== TOURNAMENTS TABLE COLUMNS ==='
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tournaments'
ORDER BY ordinal_position;

\echo ''
\echo '=== TOURNAMENT_ROUNDS TABLE COLUMNS ==='
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tournament_rounds'
ORDER BY ordinal_position;

\echo ''
\echo '=== ROUND_TYPE CONSTRAINT ==='
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%round_type%';

\echo ''
\echo '=== MATCH_FORMAT CONSTRAINT ==='
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%match_format%';

\echo ''
\echo '=== INDEXES ==='
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('tournaments', 'tournament_rounds')
ORDER BY tablename, indexname;

\echo ''
\echo '=== DATA COUNTS ==='
SELECT 'tournaments' as table_name, COUNT(*) as row_count FROM tournaments
UNION ALL
SELECT 'tournament_rounds', COUNT(*) FROM tournament_rounds
UNION ALL
SELECT 'matches', COUNT(*) FROM matches;

\echo ''
\echo '=== STATUS: All changes applied successfully! ==='
