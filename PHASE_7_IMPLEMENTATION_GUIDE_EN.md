# Phase 7 Implementation Guide
## Automated Replay Detection and Processing

**Date:** February 17, 2026  
**Status:** Ready for Development  
**Target Deployment:** March 2026

---

## Overview

This guide walks through implementing Phase 7 of the Wesnoth Tournament Manager integration: automated replay file detection and match reporting.

**Key Features:**
- ✅ Zero manual replay uploads
- ✅ Automatic file detection via inotify
- ✅ Progressive parsing (quick addon check → full analysis)
- ✅ Auto-generated match records
- ✅ Winner confirmation workflow

---

## Phase 7A: Database Migrations

### 1. Apply SQL Migration

```bash
# Connect to MariaDB
mysql -h $WESNOTH_DB_HOST -u $WESNOTH_DB_USER -p$WESNOTH_DB_PASSWORD $WESNOTH_DB_NAME < backend/migrations/phase_7_replay_processing.sql
```

### 2. Verify Tables Created

```sql
-- Check replays table
SHOW TABLES LIKE 'replays';

-- Check new columns in matches
DESCRIBE matches;
-- Should have: auto_reported, replay_id, detected_from, winner_comments, loser_confirmed_at

-- Verify indexes
SHOW INDEX FROM replays;
SHOW INDEX FROM matches WHERE Key_name IN ('idx_auto_reported', 'idx_replay_id');
```

### 3. Rollback (if needed)

The migration includes a rollback section commented out at the end. Uncomment and run if needed.

---

## Phase 7B: Install Dependencies

### 1. Add Required NPM Packages

```bash
cd backend
npm install --save inotify pako  # inotify for file watching, pako for gzip decompression
npm install --save-dev @types/inotify  # TypeScript types (if available)
npm install --save node-schedule  # For background job scheduling
```

### 2. Verify Installation

```bash
npm list | grep -E "inotify|pako|node-schedule"
```

---

## Phase 7C: Configure Environment

### 1. Copy Configuration Template

```bash
cp backend/.env.phase7.example backend/.env.phase7
```

### 2. Edit Configuration

```bash
nano backend/.env.phase7
```

**Critical Settings:**
```env
WESNOTH_REPLAY_DIR=/var/games/wesnoth/replays
REPLAY_ADDON_FILTER=tournament-addon  # Your tournament addon UUID
REPLAY_PARSER_INTERVAL_SECONDS=30
```

### 3. Merge Into .env

Add these variables to your main `.env` file:

```bash
# Extract settings
grep "^[A-Z_]=" backend/.env.phase7 >> backend/.env
```

### 4. Verify Debian Permissions

```bash
# Check replay directory is readable by app user
ls -la /var/games/wesnoth/replays

# App user should have read permission
# Typical setup:
# drwxr-xr-x wesnoth wesnoth /var/games/wesnoth/replays

# If needed, adjust permissions
sudo chown www-data:www-data /var/games/wesnoth/replays
sudo chmod 775 /var/games/wesnoth/replays
```

---

## Phase 7D: Integration Points

### 1. Main Application Setup (app.ts)

Add to your main application file:

```typescript
import ReplayMonitor from './services/replayMonitor';
import ParseNewReplaysJob from './jobs/parseNewReplays';
import schedule from 'node-schedule';

// Initialize replay monitor
const replayMonitor = new ReplayMonitor(db, logger);

// Initialize parse job
const parseJob = new ParseNewReplaysJob(db, logger);

// Start services on app startup
async function startReplayProcessing() {
    try {
        // Start file watcher
        await replayMonitor.start();
        
        // Schedule background parse job (every 30 seconds)
        schedule.scheduleJob(`*/${process.env.REPLAY_PARSER_INTERVAL_SECONDS || 30} * * * * *`, 
            async () => {
                const result = await parseJob.execute();
                logger.debug('Parse job cycle', result);
            }
        );
        
        logger.info('✅ Phase 7 Replay Processing started');
    } catch (error) {
        logger.error('Failed to start Phase 7 services', error);
        process.exit(1);
    }
}

// Call on startup
startReplayProcessing();

// Graceful shutdown
process.on('SIGTERM', async () => {
    await replayMonitor.stop();
    logger.info('Replay Monitor stopped');
});
```

### 2. Health Check Endpoint

Add to your API routes:

```typescript
// GET /api/health/phase7
app.get('/api/health/phase7', async (req, res) => {
    const monitorHealth = await replayMonitor.healthCheck();
    const jobStats = parseJob.getStats();
    
    res.json({
        replay_monitor: monitorHealth,
        parse_job: jobStats,
        status: monitorHealth.healthy ? 'healthy' : 'unhealthy'
    });
});
```

### 3. Confirmation Endpoints

Add to your matches routes (backend/src/routes/matches.ts):

```typescript
// POST /api/matches/{matchId}/confirm-as-winner
app.post('/api/matches/:matchId/confirm-as-winner', 
    requireAuth,
    async (req, res) => {
        const { matchId } = req.params;
        const { comment, opponent_rating } = req.body;
        const userId = req.user.id;
        
        try {
            // Verify user is the winner
            const match = await db.query(
                `SELECT * FROM matches WHERE id = ? AND winner_id = ?`,
                [matchId, userId]
            );
            
            if (match.length === 0) {
                return res.status(403).json({ error: 'Not match winner' });
            }
            
            // Update match status
            await db.query(
                `UPDATE matches 
                 SET status = 'confirmed', 
                     winner_comments = ?,
                     updated_at = NOW()
                 WHERE id = ?`,
                [comment, matchId]
            );
            
            res.json({ status: 'confirmed', message: 'Match confirmed' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);
```

---

## Phase 7E: Testing

### 1. Unit Tests

Create `backend/tests/replayParser.test.ts`:

```typescript
import ReplayParser from '../src/services/replayParser';

describe('ReplayParser', () => {
    it('should detect tournament addon in sample replay', async () => {
        const parser = new ReplayParser(db, logger);
        const result = await parser.quickAddonCheck('test_replays/tournament_game.rpy.gz');
        expect(result.has_tournament_addon).toBe(true);
    });
    
    it('should extract players from full parse', async () => {
        const result = await parser.fullReplayParse('test_replays/tournament_game.rpy.gz');
        expect(result.players.length).toBe(2);
        expect(result.victory.winner_side).toBeGreaterThan(0);
    });
});
```

### 2. Integration Test

Create test replay file:

```bash
# Create test directory
mkdir -p test_replays

# Copy a real tournament replay (if you have one)
cp /path/to/sample/replay.rpy.gz test_replays/
```

### 3. End-to-End Test

```bash
# 1. Start application
npm run dev

# 2. Monitor logs
tail -f logs/application.log

# 3. Copy test replay to watch directory
cp test_replays/sample.rpy.gz /var/games/wesnoth/replays/

# 4. Check database
mysql> SELECT * FROM replays ORDER BY detected_at DESC LIMIT 1;
mysql> SELECT * FROM matches WHERE auto_reported = 1 ORDER BY created_at DESC LIMIT 1;

# 5. Verify notifications (if relevant user is logged in)
```

---

## Phase 7F: Monitoring & Logging

### 1. Health Check Endpoint

```bash
curl http://localhost:3000/api/health/phase7
```

Expected response:

```json
{
    "replay_monitor": {
        "healthy": true,
        "running": true,
        "pending_replays": 2,
        "directory_accessible": true
    },
    "parse_job": {
        "last_run_at": "2025-02-17T14:30:00Z",
        "is_running": false,
        "total_parsed": 142,
        "total_errors": 3
    },
    "status": "healthy"
}
```

### 2. Log Analysis

```bash
# View recent parse job executions
grep "Parse job" logs/application.log | tail -20

# View tournament matches auto-created
grep "MATCH_AUTO_CREATED" logs/audit.log | tail -10

# View errors
grep "REPLAY_PARSED_ERROR" logs/audit.log
```

### 3. Database Queries

```sql
-- Check pending replays
SELECT COUNT(*) FROM replays WHERE parsed = 0;

-- Check auto-created matches
SELECT COUNT(*) FROM matches WHERE auto_reported = 1;

-- View parsing errors
SELECT replay_filename, parse_error_message 
FROM replays 
WHERE parse_status = 'error' 
ORDER BY parsing_completed_at DESC 
LIMIT 10;

-- Check parse job performance
SELECT 
    DATE_FORMAT(parsing_started_at, '%Y-%m-%d %H:%i') AS batch,
    COUNT(*) AS parsed,
    SUM(IF(parse_status = 'error', 1, 0)) AS errors,
    AVG(TIMESTAMPDIFF(SECOND, parsing_started_at, parsing_completed_at)) AS avg_duration_seconds
FROM replays 
WHERE parsing_completed_at IS NOT NULL 
GROUP BY DATE_FORMAT(parsing_started_at, '%Y-%m-%d %H:%i')
ORDER BY batch DESC 
LIMIT 20;
```

---

## Troubleshooting

### Issue: inotify not detecting files

**Symptom:** `WESNOTH_REPLAY_DIR directory readable` but replay files not detected

**Solution:**
1. Verify directory path: `ls -la /var/games/wesnoth/replays/`
2. Check permissions: App user needs READ-ONLY access (no write/delete needed)
3. Verify inotify: `node -e "const inotify = require('inotify'); console.log(inotify ? 'OK' : 'FAIL')"`
4. Check if watcher is actually running: `SELECT * FROM replays LIMIT 1;`

**Important:** Replay files are NEVER modified or deleted by the system - read-only access only.

### Issue: Replay parsing stalls

**Symptom:** Replay detected but stuck in `parsing` status

**Solution:**
1. Check database connection: `SELECT 1;` (should return 1)
2. Verify file isn't corrupted: `gunzip -c /path/to/replay.rpy.gz | head -20`
3. Check for deadlocks: `SHOW FULL PROCESSLIST;`
4. Manually mark as error: `UPDATE replays SET parse_status = 'error' WHERE id = '...';`

### Issue: High CPU usage

**Symptom:** parseNewReplays job consuming too much CPU

**Solution:**
1. Reduce REPLAY_MAX_CONCURRENT_PARSES
2. Increase REPLAY_PARSER_INTERVAL_SECONDS (e.g., 60 instead of 30)
3. Limit WML parse complexity (skip detailed analysis if not needed)

---

## Performance Benchmarks

Expected performance on typical Debian server:

| Metric | Value |
|--------|-------|
| inotify latency | < 100ms |
| Stage 1 (quick check) | < 1 second |
| Stage 2 (full parse) | 5-10 seconds |
| Auto-match creation | < 100ms |
| Memory footprint | ~50MB (app) + 2-5MB (inotify) |
| CPU impact | Negligible during quiet times, spikes during parsing |

---

## Next Steps

1. **After Phase 7A:** Verify database schema with `SHOW TABLES; DESCRIBE replays;`
2. **After Phase 7B:** Run `npm test` to verify dependencies
3. **After Phase 7C:** Test connectivity: `telnet $(echo $WESNOTH_REPLAY_DIR | head -c 20)`
4. **After Phase 7D:** Start app and check `GET /api/health/phase7`
5. **After Phase 7E:** Copy test replay and verify in database
6. **After Phase 7F:** Monitor logs for 24 hours, check metrics

---

## References

- [WESNOTH_REPLAY_PROCESSING_EN.md](../WESNOTH_REPLAY_PROCESSING_EN.md) - Complete technical spec
- [inotify Documentation](https://man7.org/linux/man-pages/man7/inotify.7.html) - Linux kernel documentation
- [Pako Library](https://github.com/nodeca/pako) - gzip decompression for Node.js

---

**Status:** ✅ Ready for Development  
**Last Updated:** February 17, 2026  
**Maintainer:** Wesnoth Tournament Manager Team
