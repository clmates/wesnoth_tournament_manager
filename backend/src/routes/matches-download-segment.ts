// Get signed download URL for replay file - requires authentication
// Client then redirects to the signed URL for direct download from Supabase
router.get('/:matchId/replay/download', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { matchId } = req.params;
    console.log('📥 [DOWNLOAD] Signed URL request for match:', matchId, 'user:', req.userId);

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

      console.log('✅ [DOWNLOAD] Signed URL generated, sending to client');

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
