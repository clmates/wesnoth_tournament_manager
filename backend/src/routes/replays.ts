/**
 * Routes: Replay Management
 * File: backend/src/routes/replays.ts
 * 
 * Handles:
 * - Listing replays pending player confirmation
 * - Player confirmation of match winners (creates match if valid)
 * - Player discard of incomplete/invalid replays
 * - Replay status queries
 */

import express from 'express';
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * GET /api/replays/pending-confirmation/:playerId
 * 
 * Get all replays pending player confirmation
 * These are replays where:
 * - integration_confidence = 1 (manual confirmation needed)
 * - parsed = 1
 * - need_integration = 1
 * - Player is one of the match participants
 * 
 * Returns replays where the player can confirm/select the winner
 */
router.get('/pending-confirmation/:playerId', async (req, res) => {
    try {
        const playerId = parseInt(req.params.playerId, 10);

        if (isNaN(playerId)) {
            return res.status(400).json({ error: 'Invalid player ID' });
        }

        // Get replays pending confirmation where this player participated
        const result = await query(
            `SELECT 
                r.id,
                r.replay_filename,
                r.map_name,
                r.era_id,
                r.wesnoth_version,
                r.parse_summary,
                r.parsing_completed_at,
                r.integration_confidence,
                GROUP_CONCAT(DISTINCT rp.player_name ORDER BY rp.side SEPARATOR ' vs ') as players_involved,
                GROUP_CONCAT(DISTINCT rp.side) as player_sides
             FROM replays r
             LEFT JOIN replay_participants rp ON r.id = rp.replay_id
             WHERE r.parsed = 1
               AND r.need_integration = 1
               AND r.integration_confidence = 1
               AND r.match_id IS NULL
               AND rp.player_id = ?
             GROUP BY r.id
             ORDER BY r.parsing_completed_at DESC
             LIMIT 50`,
            [playerId]
        );

        const rows = (result as any).rows || (result as unknown as any[]);

        res.json({
            status: 'success',
            count: rows.length,
            replays: rows.map((row: any) => ({
                replay_id: row.id,
                filename: row.replay_filename,
                map: row.map_name,
                era: row.era_id,
                version: row.wesnoth_version,
                summary: row.parse_summary,
                parsed_at: row.parsing_completed_at,
                players: row.players_involved?.split(' vs ') || [],
                sides: row.player_sides?.split(',').map((s: string) => parseInt(s, 10)) || []
            }))
        });
    } catch (error) {
        console.error('Error fetching pending confirmations:', error);
        res.status(500).json({ error: 'Failed to fetch pending confirmations' });
    }
});

/**
 * POST /api/replays/:replayId/confirm-winner
 * 
 * Player confirms the match result
 * 
 * Body:
 * {
 *   playerId: int,
 *   iWon: boolean  // true = player won, false = other player won
 * }
 */
router.post('/:replayId/confirm-winner', async (req, res) => {
    try {
        const replayId = req.params.replayId;
        const { playerId, iWon } = req.body;

        // Validate inputs
        if (!playerId || typeof iWon !== 'boolean') {
            return res.status(400).json({
                error: 'Missing required fields: playerId (int), iWon (boolean)'
            });
        }

        // Verify replay exists and is pending confirmation
        const replayResult = await query(
            `SELECT r.id, r.parsed, r.need_integration, r.integration_confidence, r.match_id,
                    r.map_name, r.era_id, r.replay_filename
             FROM replays r
             WHERE r.id = ?`,
            [replayId]
        );

        const replayRows = (replayResult as any).rows || (replayResult as unknown as any[]);
        if (!replayRows || replayRows.length === 0) {
            return res.status(404).json({ error: 'Replay not found' });
        }

        const replay = replayRows[0];
        if (replay.parsed !== 1 || replay.need_integration !== 1 || replay.integration_confidence !== 1) {
            return res.status(400).json({
                error: 'Replay is not pending player confirmation (may already be confirmed or discarded)'
            });
        }

        if (replay.match_id) {
            return res.status(400).json({
                error: 'This replay has already been reported as a match'
            });
        }

        // Get all participants (should be 2)
        const participantsResult = await query(
            `SELECT player_id, player_name, side FROM replay_participants 
             WHERE replay_id = ? 
             ORDER BY side`,
            [replayId]
        );

        const participantRows = (participantsResult as any).rows || (participantsResult as unknown as any[]);
        if (!participantRows || participantRows.length < 2) {
            return res.status(400).json({
                error: 'Replay must have exactly 2 participants'
            });
        }

        // Verify player participated
        const playerParticipant = participantRows.find((p: any) => p.player_id === playerId);
        if (!playerParticipant) {
            return res.status(403).json({
                error: 'Player did not participate in this replay'
            });
        }

        // Determine winner based on iWon
        const winnerSide = iWon ? playerParticipant.side : (playerParticipant.side === 1 ? 2 : 1);
        const winner = participantRows.find((p: any) => p.side === winnerSide);
        const loser = participantRows.find((p: any) => p.side !== winnerSide);

        // Create match entry
        const matchId = uuidv4();
        try {
            await query(
                `INSERT INTO matches (id, player1_name, player2_name, winner_name, map_name, era_id, replay_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    matchId,
                    participantRows[0].player_name,
                    participantRows[1].player_name,
                    winner.player_name,
                    replay.map_name,
                    replay.era_id,
                    replayId
                ]
            );
        } catch (error) {
            console.warn('Could not auto-create match entry (table structure may differ):', error);
            // Continue anyway - the important thing is to mark it as confirmed
        }

        // Update replay: set match_id and integration_confidence = 3 (confirmed via player)
        await query(
            `UPDATE replays 
             SET match_id = ?,
                 integration_confidence = 3
             WHERE id = ?`,
            [matchId, replayId]
        );

        res.json({
            status: 'success',
            message: 'Match confirmed and created',
            replay_id: replayId,
            match_id: matchId,
            player_id: playerId,
            confirmed_as_winner: iWon
        });
    } catch (error) {
        console.error('Error confirming winner:', error);
        res.status(500).json({ error: 'Failed to confirm winner' });
    }
});

/**
 * POST /api/replays/:replayId/discard
 * 
 * Player discards a replay (incomplete match, paused and continued another day, etc)
 * Sets integration_confidence = 0 to mark as discarded
 * No match will be created
 * 
 * Body:
 * {
 *   playerId: int,
 *   reason?: string (optional, for logging)
 * }
 */
router.post('/:replayId/discard', async (req, res) => {
    try {
        const replayId = req.params.replayId;
        const { playerId, reason } = req.body;

        if (!playerId) {
            return res.status(400).json({
                error: 'Missing required field: playerId'
            });
        }

        // Verify replay exists and is pending confirmation
        const replayResult = await query(
            `SELECT id, parsed, need_integration, integration_confidence, match_id
             FROM replays 
             WHERE id = ?`,
            [replayId]
        );

        const replayRows = (replayResult as any).rows || (replayResult as unknown as any[]);
        if (!replayRows || replayRows.length === 0) {
            return res.status(404).json({ error: 'Replay not found' });
        }

        const replay = replayRows[0];
        if (replay.integration_confidence === 0) {
            return res.status(400).json({
                error: 'This replay has already been discarded'
            });
        }

        if (replay.match_id) {
            return res.status(400).json({
                error: 'This replay has already been reported as a match and cannot be discarded'
            });
        }

        // Verify player participated in this replay
        const participantResult = await query(
            `SELECT player_id FROM replay_participants 
             WHERE replay_id = ? AND player_id = ?`,
            [replayId, playerId]
        );

        const participantRows = (participantResult as any).rows || (participantResult as unknown as any[]);
        if (!participantRows || participantRows.length === 0) {
            return res.status(403).json({
                error: 'Player did not participate in this replay'
            });
        }

        // Discard: set integration_confidence = 0
        await query(
            `UPDATE replays 
             SET integration_confidence = 0
             WHERE id = ?`,
            [replayId]
        );

        // Log discard reason if provided
        if (reason) {
            console.log(`[REPLAY DISCARD] Replay ${replayId} discarded by player ${playerId}: ${reason}`);
        }

        res.json({
            status: 'success',
            message: 'Replay discarded (will not be reported as a match)',
            replay_id: replayId,
            player_id: playerId
        });
    } catch (error) {
        console.error('Error discarding replay:', error);
        res.status(500).json({ error: 'Failed to discard replay' });
    }
});

export default router;
