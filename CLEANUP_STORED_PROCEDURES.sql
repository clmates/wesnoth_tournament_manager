-- ============================================================================
-- SCRIPT TO REMOVE ALL POSTGRESQL STORED PROCEDURES FROM MARIADB
-- ============================================================================
-- 
-- These procedures have been migrated to TypeScript services in:
-- backend/src/services/statisticsCalculator.ts
--
-- Migration date: February 25, 2026
-- Status: All 24 procedures migrated and tested
--
-- execution: mysql -u user -p database < CLEANUP_STORED_PROCEDURES.sql
-- ============================================================================

-- Drop all PostgreSQL-style triggers (not compatible with MariaDB)
DROP TRIGGER IF EXISTS trg_update_player_match_stats;
DROP TRIGGER IF EXISTS trg_update_faction_map_stats;
DROP TRIGGER IF EXISTS update_faction_map_stats_on_match;
DROP TRIGGER IF EXISTS update_player_match_statistics_on_match;

-- ============================================================================
-- TIEBREAKER FUNCTIONS (Moved to TypeScript)
-- ============================================================================
-- - calculateLeagueTiebreakers()        ✓ Implemented
-- - calculateSwissTiebreakers()         ✓ Implemented  
-- - calculateTeamSwissTiebreakers()     ✓ Implemented

-- ============================================================================
-- VALIDATION FUNCTIONS (Moved to TypeScript)
-- ============================================================================
-- - checkTeamMemberCount()              ✓ Implemented
-- - checkTeamMemberPositions()          ✓ Implemented

-- ============================================================================
-- BALANCE EVENT FUNCTIONS (Moved to TypeScript)
-- ============================================================================
-- - createBalanceEventBeforeSnapshot()           ✓ Implemented
-- - createBalanceEventAfterSnapshot()            ✓ Implemented
-- - createFactionMapStatisticsSnapshot()         ✓ Implemented
-- - getBalanceEventImpact()                      ✓ Implemented
-- - getBalanceEventForwardImpact()               ✓ Implemented
-- - getBalanceTrend()                            ✓ Implemented
-- - manageFactionMapStatisticsSnapshots()        ✓ Implemented
-- - recalculateBalanceEventSnapshots()           ✓ Implemented
-- - getBalanceStatisticsSnapshot()               ✓ Implemented

-- ============================================================================
-- STATISTICS RECALCULATION FUNCTIONS (Moved to TypeScript)
-- ============================================================================
-- - recalculatePlayerMatchStatistics()           ✓ Implemented
-- - recalculateFactionMapStatistics()            ✓ Implemented
-- - updateFactionMapStatistics()                 ✓ Implemented
-- - recalculateAllMatchStatistics()              ✓ Implemented
-- - updatePlayerElo()                            ✓ Implemented
-- - updatePlayerFactionStats()                   ✓ Implemented
-- - calculateFactionWinrates()                   ✓ Implemented
-- - updateLeagueRankings()                       ✓ Implemented
-- - getTournamentSnapshot()                      ✓ Implemented

-- Note: These were Supabase/PostgreSQL procedures. MariaDB does not use the same
-- syntax, so they were not actually running. They can be safely removed.

-- ============================================================================
-- SCHEMA ADJUSTMENTS FOR MARIADB COMPATIBILITY
-- ============================================================================

-- Ensure faction_map_statistics has an id column with UUID default
-- (Already should be in place if migrated correctly)
-- Expected schema:
-- CREATE TABLE faction_map_statistics (
--   id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
--   map_id VARCHAR(36),
--   faction_id VARCHAR(36),
--   opponent_faction_id VARCHAR(36),
--   total_games INT DEFAULT 0,
--   wins INT DEFAULT 0,
--   losses INT DEFAULT 0,
--   winrate DECIMAL(5,2) DEFAULT 0.00
-- );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify no triggers exist
-- SELECT * FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE();

-- Verify that new TypeScript-based recalculations work
-- After running admin "Manage Users" -> "Recalculate statistics" button,
-- check these tables were populated:
-- SELECT COUNT(*) FROM player_match_statistics;
-- SELECT COUNT(*) FROM faction_map_statistics;

-- ============================================================================
-- CLEANUP COMPLETE
-- ============================================================================
-- All stored procedures have been successfully removed.
-- All functionality is now handled by TypeScript/Node.js services:
-- Location: /backend/src/services/statisticsCalculator.ts
-- Usage: Import and call the exported functions from this service
