import { Router } from 'express';
import { query } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { calculateELO, getUserLevel } from '../utils/auth.js';
import {
  calculateNewRating,
  calculateInitialRating,
  shouldPlayerBeRated,
  calculateTrend,
} from '../utils/elo.js';
import { updateBestOfSeriesDB, createNextMatchInSeries } from '../utils/bestOf.js';
import { checkAndCompleteRound } from '../utils/tournament.js';
import { supabase, uploadReplayToSupabase, downloadReplayFromSupabase, deleteReplayFromSupabase } from '../config/supabase.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

console.log('🔧 Registrando rutas de matches');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'replays');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`✅ Created uploads directory: ${uploadsDir}`);
}

// Use memory storage to avoid writing temp files before uploading to Supabase
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 512 * 1024 }, // 512KB max file size
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.gz' && ext !== '.bz2') {
      return cb(new Error('Only .gz and .bz2 replay files are allowed'));
    }
    cb(null, true);
  },
});

// Helper function to check if a round is complete and update round_end_date
async function checkAndUpdateRoundCompletion(roundId: string, tournamentId: string) {
  try {
    // Get all tournament_round_matches for this round
    const matchesResult = await query(
      `SELECT COUNT(*) as total_matches, 
              COUNT(CASE WHEN winner_id IS NOT NULL THEN 1 END) as completed_matches
       FROM tournament_round_matches 
       WHERE round_id = $1`,
      [roundId]
    );

    if (matchesResult.rows.length === 0) return;

    const { total_matches, completed_matches } = matchesResult.rows[0];

    // If all matches are completed, update round_end_date
    if (total_matches > 0 && parseInt(total_matches) === parseInt(completed_matches)) {
      await query(
        `UPDATE tournament_rounds 
         SET round_end_date = CURRENT_TIMESTAMP, round_status = 'completed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [roundId]
      );
      console.log(`✅ Round ${roundId} completed - updated round_end_date`);
    }
  } catch (error) {
    console.error('Error checking round completion:', error);
    // Don't throw - this is a background check
  }
}

// Helper function to handle series completion and check round completion
async function handleSeriesAndRoundCompletion(seriesUpdate: any, tournamentRoundMatchId: string, roundId: string, tournamentId: string, tournament_match_id: string) {
  try {
    // If series not complete and we need another match, create it
    if (seriesUpdate.shouldCreateNextMatch) {
      try {
        const nextMatchId = await createNextMatchInSeries(tournamentRoundMatchId, tournamentId, roundId);
        if (nextMatchId) {
          console.log(`Created next match in series: ${nextMatchId}`);
        }
      } catch (nextMatchError) {
        console.error('Error creating next match in series:', nextMatchError);
        // Don't fail if next match creation fails
      }
    } else {
      // Series is complete, check if round is complete
      try {
        const roundNumberResult = await query(
          `SELECT round_number FROM tournament_rounds WHERE id = $1`,
          [roundId]
        );
        const roundNumber = roundNumberResult.rows[0]?.round_number;
        
        if (roundNumber) {
          const isRoundComplete = await checkAndCompleteRound(tournamentId, roundNumber);
          if (isRoundComplete) {
            console.log(`✅ Round ${roundNumber} for tournament ${tournamentId} is now complete`);
          }
        }
      } catch (roundCompleteError) {
        console.error('Error checking round completion:', roundCompleteError);
        // Don't fail if round check fails
      }
    }
  } catch (error) {
    console.error('Error handling series and round completion:', error);
    // Don't throw - this is a background operation
  }
}

// Report match (JSON only, no file upload required)
router.post('/report-json', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { opponent_id, map, winner_faction, loser_faction, comments, rating, tournament_id, tournament_match_id } = req.body;

    if (!opponent_id || !map || !winner_faction || !loser_faction) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Enforce .gz and .bz2 uploads (defensive even with multer filter)
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (ext !== '.gz' && ext !== '.bz2') {
        console.warn('📤 [UPLOAD] Rejected file with invalid extension:', ext);
        return res.status(400).json({ error: 'Only .gz and .bz2 replay files are allowed' });
      }
    }

    // Get winner and opponent data (FIDE system)
    const winnerResult = await query(
      'SELECT elo_rating, is_rated, matches_played, trend, level FROM users WHERE id = $1',
      [req.userId]
    );
    const loserResult = await query(
      'SELECT elo_rating, is_rated, matches_played, trend, level FROM users WHERE id = $1',
      [opponent_id]
    );

    if (winnerResult.rows.length === 0 || loserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const winner = winnerResult.rows[0];
    const loser = loserResult.rows[0];

    // Use legacy calculateELO for now, store both old and new calculations
    const legacyEloChange = calculateELO(winner.elo_rating, loser.elo_rating, true);

    // Calculate FIDE ratings for both players
    const winnerNewRating = calculateNewRating(winner.elo_rating, loser.elo_rating, 'win', winner.matches_played);
    const loserNewRating = calculateNewRating(loser.elo_rating, winner.elo_rating, 'loss', loser.matches_played);

    // Insert match with legacy elo_change for now
    const matchResult = await query(
      `INSERT INTO matches (winner_id, loser_id, map, winner_faction, loser_faction, winner_comments, winner_rating, replay_file_path, tournament_id, elo_change, winner_elo_before, loser_elo_before, winner_level_before, loser_level_before)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        req.userId,
        opponent_id,
        map,
        winner_faction,
        loser_faction,
        comments,
        rating,
        null,
        tournament_id || null,
        legacyEloChange,
        winner.elo_rating,
        loser.elo_rating,
        winner.level || 'novato',
        loser.level || 'novato',
      ]
    );

    const matchId = matchResult.rows[0].id;

    // Calculate new trends: winner gets a win, loser gets a loss
    const currentWinnerTrend = winner.trend || '-';
    const currentLoserTrend = loser.trend || '-';
    const winnerTrend = calculateTrend(currentWinnerTrend, true);
    const loserTrend = calculateTrend(currentLoserTrend, false);

    // Update winner: increment matches_played and set new ELO
    const newWinnerMatches = winner.matches_played + 1;
    let winnerIsNowRated = winner.is_rated;
    let finalWinnerRating = winnerNewRating;

    // Check if winner should become unrated (drops below 1400 elo)
    if (winner.is_rated && finalWinnerRating < 1400) {
      winnerIsNowRated = false;
    }
    // Check if unrated winner should become rated (10 games minimum, rating >= 1400)
    else if (!winner.is_rated && newWinnerMatches >= 10 && finalWinnerRating >= 1400) {
      winnerIsNowRated = true;
    }

    await query(
      `UPDATE users 
       SET elo_rating = $1, 
           is_rated = $2, 
           matches_played = $3,
           total_wins = total_wins + 1,
           trend = $6,
           level = $5,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4`,
      [finalWinnerRating, winnerIsNowRated, newWinnerMatches, req.userId, getUserLevel(finalWinnerRating), winnerTrend]
    );

    // Update loser: increment matches_played and set new ELO
    const newLoserMatches = loser.matches_played + 1;
    let loserIsNowRated = loser.is_rated;
    let finalLoserRating = loserNewRating;

    // Check if loser should become unrated (drops below 1400 elo)
    if (loser.is_rated && finalLoserRating < 1400) {
      loserIsNowRated = false;
    }
    // Check if unrated loser should become rated (10 games minimum, rating >= 1400)
    else if (!loser.is_rated && newLoserMatches >= 10 && finalLoserRating >= 1400) {
      loserIsNowRated = true;
    }

    await query(
      `UPDATE users 
       SET elo_rating = $1, 
           is_rated = $2, 
           matches_played = $3,
           total_losses = total_losses + 1,
           trend = $6,
           level = $5,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4`,
      [finalLoserRating, loserIsNowRated, newLoserMatches, opponent_id, getUserLevel(finalLoserRating), loserTrend]
    );

    // Update match with after-match ELO and level ratings
    await query(
      `UPDATE matches 
       SET winner_elo_after = $1,
           winner_level_after = $2,
           loser_elo_after = $3,
           loser_level_after = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [finalWinnerRating, getUserLevel(finalWinnerRating), finalLoserRating, getUserLevel(finalLoserRating), matchId]
    );

    console.log(
      `Match ${matchId}: Winner ${req.userId} (${winner.elo_rating} -> ${finalWinnerRating}, rated: ${winnerIsNowRated}) vs Loser ${opponent_id} (${loser.elo_rating} -> ${finalLoserRating}, rated: ${loserIsNowRated})`
    );

    // If this is a tournament match, update tournament_matches and handle Best Of series
    if (tournament_id && tournament_match_id) {
      const updateResult = await query(
        `UPDATE tournament_matches 
         SET match_id = $1, match_status = 'completed', played_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [matchId, tournament_match_id]
      );
      console.log(`Updated tournament_matches ${tournament_match_id} with match_id ${matchId}. Rows affected: ${updateResult.rowCount}`);

      // Update tournament_participants stats for winner
      await query(
        `UPDATE tournament_participants 
         SET tournament_wins = COALESCE(tournament_wins, 0) + 1,
             tournament_points = COALESCE(tournament_points, 0) + 1
         WHERE tournament_id = $1 AND user_id = $2`,
        [tournament_id, req.userId]
      );

      // Update tournament_participants stats for loser
      await query(
        `UPDATE tournament_participants 
         SET tournament_losses = COALESCE(tournament_losses, 0) + 1
         WHERE tournament_id = $1 AND user_id = $2`,
        [tournament_id, opponent_id]
      );

      console.log(`Updated tournament_participants for ${tournament_id}: winner=${req.userId}, loser=${opponent_id}`);

      // Get tournament_round_match_id and round_id to update Best Of series
      const tmatchResult = await query(
        `SELECT tournament_round_match_id, round_id FROM tournament_matches WHERE id = $1`,
        [tournament_match_id]
      );

      if (tmatchResult.rows.length > 0 && tmatchResult.rows[0].tournament_round_match_id) {
        const tournamentRoundMatchId: string = tmatchResult.rows[0].tournament_round_match_id;
        const roundId: string = tmatchResult.rows[0].round_id;

        // Check if round is complete and update round_end_date if needed
        await checkAndUpdateRoundCompletion(roundId, tournament_id);
        
        try {
          // Update Best Of series state
          const seriesUpdate = await updateBestOfSeriesDB(tournamentRoundMatchId, req.userId!);
          console.log(
            `Best Of series ${tournamentRoundMatchId}: winner=${req.userId}, seriesComplete=${seriesUpdate.seriesComplete}, shouldCreateNext=${seriesUpdate.shouldCreateNextMatch}`
          );

          // If series not complete and we need another match, create it
          if (seriesUpdate.shouldCreateNextMatch) {
            try {
              const nextMatchId = await createNextMatchInSeries(tournamentRoundMatchId, tournament_id, roundId);
              if (nextMatchId) {
                console.log(`Created next match in series: ${nextMatchId}`);
              }
            } catch (nextMatchError) {
              console.error('Error creating next match in series:', nextMatchError);
              // Don't fail the response if next match creation fails
            }
          } else {
            // Series is complete, check if round is complete
            try {
              const roundNumberResult = await query(
                `SELECT round_number FROM tournament_rounds WHERE id = $1`,
                [roundId]
              );
              const roundNumber = roundNumberResult.rows[0]?.round_number;
              
              if (roundNumber) {
                const isRoundComplete = await checkAndCompleteRound(tournament_id, roundNumber);
                if (isRoundComplete) {
                  console.log(`✅ Round ${roundNumber} for tournament ${tournament_id} is now complete`);
                }
              }
            } catch (roundCompleteError) {
              console.error('Error checking round completion:', roundCompleteError);
              // Don't fail the response if round check fails
            }
          }
        } catch (seriesError) {
          console.error('Error updating Best Of series:', seriesError);
          // Don't fail the response if Best Of update fails
        }
      }
    }

    // Send email notification to loser
    // TODO: Implement email sending

    res.status(201).json({ id: matchId });
  } catch (error) {
    console.error('Match report-json error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to report match', details: error instanceof Error ? error.message : String(error) });
  }
});

// Report match (with file upload)
router.post('/report', authMiddleware, upload.single('replay'), async (req: AuthRequest, res) => {
  try {
    console.log('📤 [UPLOAD] Starting match report from user:', req.userId);
    console.log('📤 [UPLOAD] File info:', req.file ? { fieldname: req.file.fieldname, originalname: req.file.originalname, size: req.file.size } : 'NO FILE');
    
    const { opponent_id, map, winner_faction, loser_faction, comments, rating, tournament_id, tournament_match_id } = req.body;
    console.log('📤 [UPLOAD] Match details:', { opponent_id, map, winner_faction, loser_faction, tournament_id, tournament_match_id });

    if (!opponent_id || !map || !winner_faction || !loser_faction) {
      console.warn('📤 [UPLOAD] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get winner and opponent data (FIDE system)
    const winnerResult = await query(
      'SELECT elo_rating, is_rated, matches_played, trend, level FROM users WHERE id = $1',
      [req.userId]
    );
    const loserResult = await query(
      'SELECT elo_rating, is_rated, matches_played, trend, level FROM users WHERE id = $1',
      [opponent_id]
    );

    if (winnerResult.rows.length === 0 || loserResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const winner = winnerResult.rows[0];
    const loser = loserResult.rows[0];

    // Get current ranking positions for both players
    const winnerRankResult = await query(
      `SELECT COUNT(*) as rank 
       FROM users u2 
       WHERE u2.is_active = true 
         AND u2.is_blocked = false
         AND u2.is_rated = true
         AND u2.elo_rating >= 1400
         AND (u2.elo_rating > $1 OR (u2.elo_rating = $1 AND u2.id < $2))`,
      [winner.elo_rating, req.userId]
    );

    const loserRankResult = await query(
      `SELECT COUNT(*) as rank 
       FROM users u2 
       WHERE u2.is_active = true 
         AND u2.is_blocked = false
         AND u2.is_rated = true
         AND u2.elo_rating >= 1400
         AND (u2.elo_rating > $1 OR (u2.elo_rating = $1 AND u2.id < $2))`,
      [loser.elo_rating, opponent_id]
    );

    const winnerCurrentRank = parseInt(winnerRankResult.rows[0].rank) + 1;
    const loserCurrentRank = parseInt(loserRankResult.rows[0].rank) + 1;

    // Use legacy calculateELO for now, store both old and new calculations
    const legacyEloChange = calculateELO(winner.elo_rating, loser.elo_rating, true);

    // Calculate FIDE ratings for both players
    const winnerNewRating = calculateNewRating(winner.elo_rating, loser.elo_rating, 'win', winner.matches_played);
    const loserNewRating = calculateNewRating(loser.elo_rating, winner.elo_rating, 'loss', loser.matches_played);

    // Upload replay to Supabase if file exists
    let replayPath = null;
    if (req.file) {
      try {
        console.log('📤 [UPLOAD] Starting Supabase upload...');
        const fileBuffer = req.file.buffer;
        if (!fileBuffer) {
          throw new Error('Uploaded file buffer is missing');
        }
        console.log('📤 [UPLOAD] File buffer size:', fileBuffer.length, 'bytes');
        
        // Generate filename using the original filename's extension
        const ext = path.extname(req.file.originalname) || '.gz';
        const filename = `replay_${Date.now()}${ext}`;
        
        const uploadResult = await uploadReplayToSupabase(filename, fileBuffer);
        replayPath = uploadResult.path;
        console.log('✅ [UPLOAD] Replay uploaded to Supabase:', replayPath);
      } catch (uploadError) {
        console.error('❌ [UPLOAD] Error uploading to Supabase:', uploadError);
        // Don't fail the entire request if upload fails - we can retry later
      }
    }
    
    // Insert match with ranking positions
    const matchResult = await query(
      `INSERT INTO matches (winner_id, loser_id, map, winner_faction, loser_faction, winner_comments, loser_comments, winner_rating, replay_file_path, tournament_id, elo_change, winner_elo_before, loser_elo_before, winner_level_before, loser_level_before, winner_ranking_pos, loser_ranking_pos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
      [
        req.userId,
        opponent_id,
        map,
        winner_faction,
        loser_faction,
        comments,
        null, // loser_comments will be added when loser confirms/disputes
        rating,
        replayPath,
        tournament_id || null,
        legacyEloChange,
        winner.elo_rating,
        loser.elo_rating,
        winner.level || 'novato',
        loser.level || 'novato',
        winnerCurrentRank,
        loserCurrentRank,
      ]
    );

    const matchId = matchResult.rows[0].id;
    console.log('📤 [MATCH] Match created with ID:', matchId);
    console.log('✅ [UPLOAD] Replay stored in Supabase at:', replayPath);

    // Calculate new trends: winner gets a win, loser gets a loss
    const currentWinnerTrend = winner.trend || '-';
    const currentLoserTrend = loser.trend || '-';
    const winnerTrend = calculateTrend(currentWinnerTrend, true);
    const loserTrend = calculateTrend(currentLoserTrend, false);

    // Update winner: increment matches_played and set new ELO
    const newWinnerMatches = winner.matches_played + 1;
    let winnerIsNowRated = winner.is_rated;
    let finalWinnerRating = winnerNewRating;

    // Check if winner should become unrated (drops below 1400 elo)
    if (winner.is_rated && finalWinnerRating < 1400) {
      winnerIsNowRated = false;
    }
    // Check if unrated winner should become rated (10 games minimum, rating >= 1400)
    else if (!winner.is_rated && newWinnerMatches >= 10 && finalWinnerRating >= 1400) {
      winnerIsNowRated = true;
    }

    await query(
      `UPDATE users 
       SET elo_rating = $1, 
           is_rated = $2, 
           matches_played = $3,
           total_wins = total_wins + 1,
           trend = $6,
           level = $5,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4`,
      [finalWinnerRating, winnerIsNowRated, newWinnerMatches, req.userId, getUserLevel(finalWinnerRating), winnerTrend]
    );

    // Update loser: increment matches_played and set new ELO
    const newLoserMatches = loser.matches_played + 1;
    let loserIsNowRated = loser.is_rated;
    let finalLoserRating = loserNewRating;

    // Check if loser should become unrated (drops below 1400 elo)
    if (loser.is_rated && finalLoserRating < 1400) {
      loserIsNowRated = false;
    }
    // Check if unrated loser should become rated (10 games minimum, rating >= 1400)
    else if (!loser.is_rated && newLoserMatches >= 10 && finalLoserRating >= 1400) {
      loserIsNowRated = true;
    }

    await query(
      `UPDATE users 
       SET elo_rating = $1, 
           is_rated = $2, 
           matches_played = $3,
           total_losses = total_losses + 1,
           trend = $6,
           level = $5,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4`,
      [finalLoserRating, loserIsNowRated, newLoserMatches, opponent_id, getUserLevel(finalLoserRating), loserTrend]
    );

    // Calculate new ranking positions after ELO update
    const winnerNewRankResult = await query(
      `SELECT COUNT(*) as rank 
       FROM users u2 
       WHERE u2.is_active = true 
         AND u2.is_blocked = false
         AND u2.is_rated = true
         AND u2.elo_rating >= 1400
         AND (u2.elo_rating > $1 OR (u2.elo_rating = $1 AND u2.id < $2))`,
      [finalWinnerRating, req.userId]
    );

    const loserNewRankResult = await query(
      `SELECT COUNT(*) as rank 
       FROM users u2 
       WHERE u2.is_active = true 
         AND u2.is_blocked = false
         AND u2.is_rated = true
         AND u2.elo_rating >= 1400
         AND (u2.elo_rating > $1 OR (u2.elo_rating = $1 AND u2.id < $2))`,
      [finalLoserRating, opponent_id]
    );

    const winnerNewRank = parseInt(winnerNewRankResult.rows[0].rank) + 1;
    const loserNewRank = parseInt(loserNewRankResult.rows[0].rank) + 1;
    const winnerRankingChange = winnerCurrentRank - winnerNewRank;
    const loserRankingChange = loserCurrentRank - loserNewRank;

    // Update match with after-match ELO, level ratings, and ranking changes
    await query(
      `UPDATE matches 
       SET winner_elo_after = $1,
           winner_level_after = $2,
           loser_elo_after = $3,
           loser_level_after = $4,
           winner_ranking_change = $5,
           loser_ranking_change = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [finalWinnerRating, getUserLevel(finalWinnerRating), finalLoserRating, getUserLevel(finalLoserRating), winnerRankingChange, loserRankingChange, matchId]
    );

    console.log(
      `Match ${matchId}: Winner ${req.userId} (${winner.elo_rating} -> ${finalWinnerRating}, rated: ${winnerIsNowRated}) vs Loser ${opponent_id} (${loser.elo_rating} -> ${finalLoserRating}, rated: ${loserIsNowRated})`
    );

    // If this is a tournament match, update tournament_matches and handle Best Of series
    if (tournament_id && tournament_match_id) {
      const updateResult = await query(
        `UPDATE tournament_matches 
         SET match_id = $1, match_status = 'completed', played_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [matchId, tournament_match_id]
      );
      console.log(`Updated tournament_matches ${tournament_match_id} with match_id ${matchId}. Rows affected: ${updateResult.rowCount}`);

      // Update tournament_participants stats for winner
      await query(
        `UPDATE tournament_participants 
         SET tournament_wins = COALESCE(tournament_wins, 0) + 1,
             tournament_points = COALESCE(tournament_points, 0) + 1
         WHERE tournament_id = $1 AND user_id = $2`,
        [tournament_id, req.userId]
      );

      // Update tournament_participants stats for loser
      await query(
        `UPDATE tournament_participants 
         SET tournament_losses = COALESCE(tournament_losses, 0) + 1
         WHERE tournament_id = $1 AND user_id = $2`,
        [tournament_id, opponent_id]
      );

      console.log(`Updated tournament_participants for ${tournament_id}: winner=${req.userId}, loser=${opponent_id}`);

      // Get tournament_round_match_id and round_id to update Best Of series
      const tmatchResult = await query(
        `SELECT tournament_round_match_id, round_id FROM tournament_matches WHERE id = $1`,
        [tournament_match_id]
      );

      if (tmatchResult.rows.length > 0 && tmatchResult.rows[0].tournament_round_match_id) {
        const tournamentRoundMatchId: string = tmatchResult.rows[0].tournament_round_match_id;
        const roundId: string = tmatchResult.rows[0].round_id;

        // Check if round is complete and update round_end_date if needed
        await checkAndUpdateRoundCompletion(roundId, tournament_id);
        
        try {
          // Update Best Of series state
          const seriesUpdate = await updateBestOfSeriesDB(tournamentRoundMatchId, req.userId!);
          console.log(
            `Best Of series ${tournamentRoundMatchId}: winner=${req.userId}, seriesComplete=${seriesUpdate.seriesComplete}, shouldCreateNext=${seriesUpdate.shouldCreateNextMatch}`
          );

          // If series not complete and we need another match, create it
          if (seriesUpdate.shouldCreateNextMatch) {
            try {
              const nextMatchId = await createNextMatchInSeries(tournamentRoundMatchId, tournament_id, roundId);
              if (nextMatchId) {
                console.log(`Created next match in series: ${nextMatchId}`);
              }
            } catch (nextMatchError) {
              console.error('Error creating next match in series:', nextMatchError);
              // Don't fail the response if next match creation fails
            }
          } else {
            // Series is complete, check if round is complete
            try {
              const roundNumberResult = await query(
                `SELECT round_number FROM tournament_rounds WHERE id = $1`,
                [roundId]
              );
              const roundNumber = roundNumberResult.rows[0]?.round_number;
              
              if (roundNumber) {
                const isRoundComplete = await checkAndCompleteRound(tournament_id, roundNumber);
                if (isRoundComplete) {
                  console.log(`✅ Round ${roundNumber} for tournament ${tournament_id} is now complete`);
                }
              }
            } catch (roundCompleteError) {
              console.error('Error checking round completion:', roundCompleteError);
              // Don't fail the response if round check fails
            }
          }
        } catch (seriesError) {
          console.error('Error updating Best Of series:', seriesError);
          // Don't fail the response if Best Of update fails
        }
      }
    }

    // Send email notification to loser
    // TODO: Implement email sending

    res.status(201).json({ id: matchId });
  } catch (error) {
    console.error('Match report error:', error);
    res.status(500).json({ error: 'Failed to report match' });
  }
});

/**
 * Preview replay file (decompress and extract data)
 * Handles .gz and .bz2 files
 * MUST be BEFORE generic /:id routes
 */
router.options('/preview-replay', (req, res) => {
  console.log('✅ [PREVIEW] OPTIONS request received for /preview-replay');
  res.status(200).end();
});

router.post('/preview-replay', authMiddleware, upload.single('replay'), async (req: AuthRequest, res) => {
  try {
    console.log('✅ [PREVIEW] POST /preview-replay endpoint reached');
    console.log('[PREVIEW] User ID:', req.userId);
    console.log('[PREVIEW] File info:', req.file ? { fieldname: req.file.fieldname, originalname: req.file.originalname, size: req.file.size } : 'NO FILE');
    
    if (!req.file) {
      console.warn('[PREVIEW] No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;
    const fileExt = path.extname(fileName).toLowerCase();

    console.log(`📂 [PREVIEW] Previewing replay file: ${fileName} (${fileBuffer.length} bytes), ext: ${fileExt}`);

    let decompressed: Buffer;

    if (fileExt === '.gz') {
      console.log('[PREVIEW] Handling GZIP decompression');
      // Handle gzip decompression
      const { createGunzip } = await import('zlib');
      const { Readable } = await import('stream');

      const stream = Readable.from(fileBuffer);
      const gunzip = createGunzip();
      const chunks: Buffer[] = [];

      await new Promise((resolve, reject) => {
        stream
          .pipe(gunzip)
          .on('data', (chunk: Buffer) => chunks.push(chunk))
          .on('end', resolve)
          .on('error', reject);
      });

      decompressed = Buffer.concat(chunks);
      console.log('[PREVIEW] GZIP decompression complete, decompressed size:', decompressed.length);
    } else if (fileExt === '.bz2') {
      console.log('[PREVIEW] Handling BZ2 decompression');
      // Handle bzip2 decompression
      const bz2Module = await import('bz2');
      console.log('[PREVIEW] bz2Module:', Object.keys(bz2Module));
      console.log('[PREVIEW] bz2Module.default:', bz2Module.default);
      
      // Try different ways to access decompress function
      let decompress = bz2Module.decompress || bz2Module.default?.decompress;
      
      // If still not found, try accessing the module differently
      if (!decompress && typeof bz2Module === 'function') {
        // Sometimes the module itself is the decompress function
        decompress = bz2Module;
      }
      
      console.log('[PREVIEW] decompress type:', typeof decompress);

      if (typeof decompress !== 'function') {
        console.error('[PREVIEW] Could not find decompress function in bz2 module');
        console.error('[PREVIEW] Available keys:', Object.keys(bz2Module || {}));
        throw new Error('bz2.decompress is not available');
      }

      console.log('[PREVIEW] Calling bz2.decompress...');
      const decompressedData = decompress(fileBuffer);
      decompressed = Buffer.from(decompressedData);
      console.log('[PREVIEW] BZ2 decompression complete, decompressed size:', decompressed.length);
    } else {
      console.warn('[PREVIEW] Unsupported file extension:', fileExt);
      return res.status(400).json({ error: 'Unsupported file format. Only .gz and .bz2 files are allowed.' });
    }

    // Convert to string and extract replay info
    console.log('[PREVIEW] Converting decompressed data to string...');
    const xmlText = decompressed.toString('utf-8');

    // Extract map name
    const scenarioMatch = xmlText.match(/mp_scenario_name="([^"]+)"/);
    let map = scenarioMatch ? scenarioMatch[1] : null;
    if (map) {
      // Remove "2p — " prefix if present
      map = map.replace(/^2p\s*—\s*/, '');
    }
    console.log('[PREVIEW] Extracted map:', map);

    // Extract players from global side_users attribute (e.g., id1:Nick1,id2:Nick2)
    const sideUsersGlobal = xmlText.match(/side_users="([^"]+)"/);
    const playerNames: string[] = [];
    if (sideUsersGlobal && sideUsersGlobal[1]) {
      const pairs = sideUsersGlobal[1].split(',');
      for (const pair of pairs) {
        const parts = pair.split(':');
        const name = (parts[1] || parts[0]).trim();
        if (name) playerNames.push(name);
      }
    }

    // Extract factions in order of <side ...> blocks (fallback)
    const factionsInOrder: string[] = [];
    const factionRegex = /faction_name\s*=\s*_?"([^"]+)"/g;
    let factionMatch;
    while ((factionMatch = factionRegex.exec(xmlText)) !== null) {
      const raw = factionMatch[1];
      const clean = raw.replace(/^_/, '');
      factionsInOrder.push(clean);
    }

    // Extract factions from [old_side*] blocks mapping current_player -> faction_name (preferred) or faction
    const factionByPlayer: Record<string, string> = {};
    const oldSideBlockRegex = /\[old_side[^\]]*\][\s\S]*?(?=\[old_side|\Z)/g;
    let sideBlockMatch;
    while ((sideBlockMatch = oldSideBlockRegex.exec(xmlText)) !== null) {
      const text = sideBlockMatch[0];
      const playerMatch = text.match(/current_player="([^"]+)"/);
      if (!playerMatch) continue;
      const player = playerMatch[1];
      const factionNameMatch = text.match(/faction_name\s*=\s*_?"([^"]+)"/);
      const factionMatchLocal = text.match(/faction="([^"]+)"/);
      const rawFaction = (factionNameMatch?.[1] || factionMatchLocal?.[1] || '').trim();
      if (!rawFaction) continue;
      const cleanFaction = rawFaction.replace(/^_/, '');
      factionByPlayer[player] = cleanFaction;
    }

    // Build players array by index mapping
    const players: Array<{ id: string; name: string; faction: string }> = [];
    const count = Math.min(playerNames.length, factionsInOrder.length);
    for (let i = 0; i < count; i++) {
      const name = playerNames[i];
      const faction = factionByPlayer[name] ?? factionsInOrder[i] ?? 'Unknown';
      players.push({ id: name, name, faction });
    }

    // If playerNames are empty but old_side mapping exists, use it to populate players
    if (playerNames.length === 0 && Object.keys(factionByPlayer).length > 0) {
      for (const [name, faction] of Object.entries(factionByPlayer)) {
        players.push({ id: name, name, faction });
      }
    }
    console.log('[PREVIEW] Extracted players:', players);

    console.log('[PREVIEW] Sending successful response...');
    res.json({
      success: true,
      map,
      players,
      fileName,
    });
  } catch (error: any) {
    console.error('[PREVIEW] Error in preview-replay endpoint:', error);

    res.status(400).json({
      error: 'Failed to parse replay file',
      details: error.message,
    });
  }
});

// Confirm/dispute match - MUST be BEFORE generic /:id routes
router.post('/:id/confirm', authMiddleware, async (req: AuthRequest, res) => {
  try {
    console.log('✅ POST /:id/confirm alcanzado', req.params.id, req.body.action);
    const { id } = req.params;
    const { comments, rating, action } = req.body;

    const matchResult = await query('SELECT * FROM matches WHERE id = $1', [id]);
    console.log('Match query result:', matchResult.rows.length, 'rows');
    
    if (matchResult.rows.length === 0) {
      console.log('❌ Match not found:', id);
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];
    console.log('Match loser_id:', match.loser_id, 'Current user:', req.userId);

    // Verify that the user confirming is the loser
    if (match.loser_id !== req.userId) {
      console.log('❌ User is not the loser');
      return res.status(403).json({ error: 'Only the loser can confirm this match' });
    }

    if (action === 'confirm') {
      // Validate rating if provided
      if (rating && (rating < 1 || rating > 5)) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      // Update match confirmation - set status to 'confirmed'
      // NO stats or ELO changes - those were already applied when winner reported
      // Loser only confirms and optionally adds comments/rating
      await query(
        `UPDATE matches 
         SET status = 'confirmed', 
             loser_comments = $1, 
             loser_rating = $2,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [comments || null, rating || null, id]
      );

      console.log(
        `Match ${id} confirmed: Loser ${req.userId} confirmed the match result`
      );

      console.log('✅ Respondiendo con éxito - confirm');
      res.json({ message: 'Match confirmed successfully with your comments and rating' });
    } else if (action === 'dispute') {
      // Mark match as disputed (pending admin review)
      // NO stat reversal here - stats remain as calculated when match was reported
      // Stats are only reversed if admin validates the dispute
      await query(
        'UPDATE matches SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['disputed', id]
      );

      console.log(
        `Match ${id} disputed by loser ${req.userId}: Awaiting admin review. Stats remain unchanged.`
      );

      console.log('✅ Respondiendo con éxito - dispute');
      res.json({ message: 'Match disputed. Awaiting admin review.' });
    } else {
      res.status(400).json({ error: 'Invalid action. Use "confirm" or "dispute"' });
    }
  } catch (error) {
    console.error('Match confirmation error:', error);
    res.status(500).json({ error: 'Failed to update match' });
  }
});

// Get all disputed matches (admin view) - MUST be before /:id route
router.get('/disputed/all', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Verify admin status
    const adminResult = await query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await query(
      `SELECT m.*,
              w.nickname as winner_nickname,
              w.email as winner_email,
              l.nickname as loser_nickname,
              l.email as loser_email
       FROM matches m
       JOIN users w ON m.winner_id = w.id
       JOIN users l ON m.loser_id = l.id
       WHERE m.status = 'disputed'
       ORDER BY m.updated_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch disputed matches' });
  }
});

// Get all pending matches (admin view) - MUST be before /:id route
router.get('/pending/all', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Verify admin status
    const adminResult = await query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await query(
      `SELECT m.*,
              w.nickname as winner_nickname,
              w.email as winner_email,
              l.nickname as loser_nickname,
              l.email as loser_email
       FROM matches m
       JOIN users w ON m.winner_id = w.id
       JOIN users l ON m.loser_id = l.id
       WHERE m.status IN ('unconfirmed', 'pending')
       ORDER BY m.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending matches' });
  }
});

// Get pending matches for current user (as winner or loser) - MUST be before /:id route
router.get('/pending/user', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT m.*,
              w.nickname as winner_nickname,
              l.nickname as loser_nickname,
              CASE 
                WHEN m.winner_id = $1 THEN 'winner'
                WHEN m.loser_id = $1 THEN 'loser'
              END as user_role,
              CASE 
                WHEN m.winner_id = $1 AND m.status = 'confirmed' THEN true
                WHEN m.loser_id = $1 AND m.status IN ('unconfirmed', 'pending') THEN true
                ELSE false
              END as is_awaiting_action
       FROM matches m
       JOIN users w ON m.winner_id = w.id
       JOIN users l ON m.loser_id = l.id
       WHERE (m.winner_id = $1 OR m.loser_id = $1)
         AND m.status IN ('unconfirmed', 'pending')
       ORDER BY m.created_at DESC`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending matches' });
  }
});

// Admin action on disputed match - MUST be BEFORE /:matchId routes
router.post('/admin/:id/dispute', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'validate' or 'reject'

    // Verify admin status
    const adminResult = await query('SELECT is_admin FROM users WHERE id = $1', [req.userId]);
    if (adminResult.rows.length === 0 || !adminResult.rows[0].is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const matchResult = await query('SELECT * FROM matches WHERE id = $1', [id]);
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    if (match.status !== 'disputed') {
      return res.status(400).json({ error: 'Match is not disputed' });
    }

    if (action === 'validate') {
      // Admin validates the dispute - the match is invalid and must be cancelled
      // This means: CANCEL the match and REBUILD ALL STATS from scratch (global cascade recalculation)
      
      console.log(`Starting global cascade recalculation for cancelled match ${id} (winner: ${match.winner_id}, loser: ${match.loser_id})`);

      // STEP 1: Mark the match as cancelled
      await query(
        'UPDATE matches SET status = $1, admin_reviewed = true, admin_reviewed_at = CURRENT_TIMESTAMP, admin_reviewed_by = $2 WHERE id = $3',
        ['cancelled', req.userId, id]
      );

      // STEP 2: Get default ELO for new users (from users table default or environment)
      const defaultElo = 1400; // FIDE standard baseline for new users

      // STEP 3: Get ALL non-cancelled matches in chronological order
      const allNonCancelledMatches = await query(
        `SELECT m.id, m.winner_id, m.loser_id, m.created_at
         FROM matches m
         WHERE m.status IN ('confirmed', 'unconfirmed', 'pending', 'disputed')
         ORDER BY m.created_at ASC, m.id ASC`
      );

      // STEP 4: Initialize all users with baseline ELO and zero stats
      const userStates = new Map<string, {
        elo_rating: number;
        matches_played: number;
        total_wins: number;
        total_losses: number;
        trend: string;
      }>();

      const allUsersResult = await query('SELECT id FROM users');
      for (const userRow of allUsersResult.rows) {
        userStates.set(userRow.id, {
          elo_rating: defaultElo,
          matches_played: 0,
          total_wins: 0,
          total_losses: 0,
          trend: '-'
        });
      }

      // STEP 5: Replay ALL non-cancelled matches chronologically to rebuild correct stats
      for (const matchRow of allNonCancelledMatches.rows) {
        const winnerId = matchRow.winner_id;
        const loserId = matchRow.loser_id;

        // Ensure both users exist in state map
        if (!userStates.has(winnerId)) {
          userStates.set(winnerId, { elo_rating: defaultElo, matches_played: 0, total_wins: 0, total_losses: 0, trend: '-' });
        }
        if (!userStates.has(loserId)) {
          userStates.set(loserId, { elo_rating: defaultElo, matches_played: 0, total_wins: 0, total_losses: 0, trend: '-' });
        }

        const winner = userStates.get(winnerId)!;
        const loser = userStates.get(loserId)!;

        // Store before values
        const winnerEloBefore = winner.elo_rating;
        const loserEloBefore = loser.elo_rating;

        // Calculate new ratings
        const winnerNewRating = calculateNewRating(winner.elo_rating, loser.elo_rating, 'win', winner.matches_played);
        const loserNewRating = calculateNewRating(loser.elo_rating, winner.elo_rating, 'loss', loser.matches_played);

        // Update stats
        winner.elo_rating = winnerNewRating;
        loser.elo_rating = loserNewRating;
        winner.matches_played++;
        loser.matches_played++;
        winner.total_wins++;
        loser.total_losses++;
        winner.trend = calculateTrend(winner.trend, true);
        loser.trend = calculateTrend(loser.trend, false);

        // Update the match record with correct before/after ELO values
        await query(
          `UPDATE matches 
           SET winner_elo_before = $1, winner_elo_after = $2, 
               loser_elo_before = $3, loser_elo_after = $4
           WHERE id = $5`,
          [winnerEloBefore, winnerNewRating, loserEloBefore, loserNewRating, matchRow.id]
        );
      }

      // STEP 6: Update all users in the database with their recalculated stats
      for (const [userId, stats] of userStates.entries()) {
        // Determine is_rated status
        // Get current is_rated status from database
        const userCurrentResult = await query('SELECT is_rated FROM users WHERE id = $1', [userId]);
        const isCurrentlyRated = userCurrentResult.rows[0]?.is_rated || false;
        
        let isRated = isCurrentlyRated;
        
        // If rated and ELO falls below 1400, unrate the player
        if (isCurrentlyRated && stats.elo_rating < 1400) {
          isRated = false;
        }
        // If unrated, has 10+ matches, and ELO >= 1400, rate the player
        else if (!isCurrentlyRated && stats.matches_played >= 10 && stats.elo_rating >= 1400) {
          isRated = true;
        }
        
        await query(
          `UPDATE users 
           SET elo_rating = $1, 
               matches_played = $2,
               total_wins = $3,
               total_losses = $4,
               trend = $5,
               is_rated = $6,
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $7`,
          [stats.elo_rating, stats.matches_played, stats.total_wins, stats.total_losses, stats.trend, isRated, userId]
        );
      }

      // Reopen the associated tournament match for re-reporting
      const tournamentMatchResult = await query(
        `SELECT tm.id as tm_id FROM tournament_matches tm
         WHERE tm.match_id = $1`,
        [id]
      );

      if (tournamentMatchResult.rows.length > 0) {
        const tournamentMatch = tournamentMatchResult.rows[0];
        
        // Reopen the tournament match for re-reporting
        await query(
          `UPDATE tournament_matches 
           SET match_status = 'pending', winner_id = NULL, match_id = NULL, played_at = NULL
           WHERE id = $1`,
          [tournamentMatch.tm_id]
        );
        console.log(`Match ${id} reopened in tournament_matches ${tournamentMatch.tm_id} for re-reporting`);
      }

      console.log(`Match ${id} dispute validated by admin ${req.userId}: Match marked as cancelled, stats recalculated in global cascade for ${allNonCancelledMatches.rows.length} total matches`);
      res.json({ 
        message: 'Dispute validated. Match cancelled, stats reversed, ELO recalculated for all subsequent matches, and reopened for re-reporting.',
        reopened: tournamentMatchResult.rows.length > 0,
        totalMatchesProcessed: allNonCancelledMatches.rows.length
      });
    } else if (action === 'reject') {
      // Reject dispute - the dispute is not valid, match was correct
      // Simply mark as confirmed, NO stat changes, NO ELO recalculation
      await query(
        `UPDATE matches 
         SET status = $1, 
             admin_reviewed = true, 
             admin_reviewed_at = CURRENT_TIMESTAMP, 
             admin_reviewed_by = $2 
         WHERE id = $3`,
        ['confirmed', req.userId, id]
      );

      console.log(`Match ${id} dispute rejected by admin ${req.userId}: Match remains confirmed`);
      res.json({ message: 'Dispute rejected. Match confirmed.' });
    } else {
      res.status(400).json({ error: 'Invalid action. Use "validate" or "reject"' });
    }
  } catch (error) {
    console.error('Admin dispute resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// Get signed download URL for replay file - PUBLIC endpoint with expiring URLs
// Returns a 5-minute signed URL that client can use for direct download from Supabase
router.get('/:matchId/replay/download', async (req: AuthRequest, res) => {
  try {
    const { matchId } = req.params;
    console.log('📥 [DOWNLOAD] Signed URL request for match:', matchId);

    // Get match and replay file path from database
    const result = await query(
      'SELECT replay_file_path FROM matches WHERE id = $1',
      [matchId]
    );

    if (result.rows.length === 0) {
      console.warn('📥 [DOWNLOAD] Match not found:', matchId);
      return res.status(404).json({ error: 'Match not found' });
    }

    let replayFilePath = result.rows[0].replay_file_path;
    console.log('📥 [DOWNLOAD] Retrieved replay path from DB:', replayFilePath);

    if (!replayFilePath) {
      console.warn('📥 [DOWNLOAD] No replay file stored for match:', matchId);
      return res.status(404).json({ error: 'No replay file for this match' });
    }

    try {
      // Generate a short-lived signed URL (5 minutes) for direct download from Supabase
      console.log('📥 [DOWNLOAD] Generating signed URL for:', replayFilePath);
      const filename = path.basename(replayFilePath);
      const { data: signedData, error: signedError } = await supabase.storage
        .from('replays')
        .createSignedUrl(replayFilePath, 300); // 5 minutes expiration

      if (signedError || !signedData?.signedUrl) {
        console.error('❌ [DOWNLOAD] Failed to generate signed URL:', signedError?.message || 'No signed URL');
        return res.status(500).json({ error: 'Failed to generate download link' });
      }

      console.log('✅ [DOWNLOAD] Signed URL generated (5-min expiry), sending to client');

      // Return the signed URL to client (5-minute validity)
      res.json({
        signedUrl: signedData.signedUrl,
        filename: filename,
        expiresIn: 300
      });
    } catch (supabaseError) {
      console.error('❌ [DOWNLOAD] Supabase error:', supabaseError);
      res.status(500).json({ error: 'Failed to generate download link' });
    }
  } catch (error) {
    console.error('❌ [DOWNLOAD] Replay download error:', error);
    res.status(500).json({ error: 'Failed to download replay' });
  }
});

// Increment replay download count - MUST be BEFORE generic /:matchId routes
router.post('/:matchId/replay/download-count', async (req: AuthRequest, res) => {
  try {
    const { matchId } = req.params;
    console.log('📊 [COUNTER] Incrementing download count for match:', matchId);

    // Increment the download count
    const result = await query(
      'UPDATE matches SET replay_downloads = COALESCE(replay_downloads, 0) + 1 WHERE id = $1 RETURNING replay_downloads',
      [matchId]
    );

    if (result.rows.length === 0) {
      console.warn('📊 [COUNTER] Match not found:', matchId);
      return res.status(404).json({ error: 'Match not found' });
    }

    console.log('✅ [COUNTER] Download count updated to:', result.rows[0].replay_downloads);
    res.json({ replay_downloads: result.rows[0].replay_downloads });
  } catch (error) {
    console.error('❌ [COUNTER] Error incrementing replay downloads:', error);
    res.status(500).json({ error: 'Failed to increment download count' });
  }
});

// Get all matches (both confirmed and unconfirmed) - Requires authentication
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    // Get page from query params, default to 1
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get filter params from query
    const winnerFilter = (req.query.winner as string)?.trim() || '';
    const loserFilter = (req.query.loser as string)?.trim() || '';
    const mapFilter = (req.query.map as string)?.trim() || '';
    const statusFilter = (req.query.status as string)?.trim() || '';
    const confirmedFilter = (req.query.confirmed as string)?.trim() || '';

    // Build WHERE clause dynamically
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramCount = 1;

    if (winnerFilter) {
      whereConditions.push(`w.nickname ILIKE $${paramCount}`);
      params.push(`%${winnerFilter}%`);
      paramCount++;
    }

    if (loserFilter) {
      whereConditions.push(`l.nickname ILIKE $${paramCount}`);
      params.push(`%${loserFilter}%`);
      paramCount++;
    }

    if (mapFilter) {
      whereConditions.push(`m.map ILIKE $${paramCount}`);
      params.push(`%${mapFilter}%`);
      paramCount++;
    }

    if (statusFilter) {
      whereConditions.push(`m.status = $${paramCount}`);
      params.push(statusFilter);
      paramCount++;
    }

    if (confirmedFilter) {
      whereConditions.push(`m.status = $${paramCount}`);
      params.push(confirmedFilter);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count of filtered matches
    const countQuery = `SELECT COUNT(*) as total FROM matches m 
                        JOIN users w ON m.winner_id = w.id 
                        JOIN users l ON m.loser_id = l.id 
                        ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Get matches for current page with filters
    params.push(limit);
    params.push(offset);
    const result = await query(
      `SELECT m.*, 
              w.nickname as winner_nickname,
              l.nickname as loser_nickname
       FROM matches m
       JOIN users w ON m.winner_id = w.id
       JOIN users l ON m.loser_id = l.id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        showing: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Routes are now properly ordered with specific paths first

export default router;

