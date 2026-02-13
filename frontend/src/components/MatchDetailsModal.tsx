import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { matchService } from '../services/api';
import StarDisplay from './StarDisplay';

// Get API URL for direct backend calls
const getApiUrl = (): string => {
  if (window.location.hostname === 'main.wesnoth-tournament-manager.pages.dev') {
    return 'https://wesnothtournamentmanager-main.up.railway.app/api';
  } else if (window.location.hostname === 'wesnoth-tournament-manager.pages.dev') {
    return 'https://wesnothtournamentmanager-production.up.railway.app/api';
  } else if (window.location.hostname.includes('feature-unranked-tournaments')) {
    return 'https://wesnothtournamentmanager-wesnothtournamentmanager-pr-1.up.railway.app/api';
  } else {
    return '/api';
  }
};
const API_URL = getApiUrl();

interface MatchDetailsModalProps {
  match: any;
  isOpen: boolean;
  onClose: () => void;
  onDownloadReplay?: (matchId: string | null, replayFilePath: string, tournamentMatchId?: string) => void;
  onCancelSuccess?: () => void;
}

const MatchDetailsModal: React.FC<MatchDetailsModalProps> = ({ match, isOpen, onClose, onDownloadReplay, onCancelSuccess }) => {
  const { t } = useTranslation();
  const { userId } = useAuthStore();
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string } | null>(null);
  
  if (!isOpen || !match) {
    return null;
  }

  const winnerEloChange = (match: any) => (match.winner_elo_after || 0) - (match.winner_elo_before || 0);
  const loserEloChange = (match: any) => (match.loser_elo_after || 0) - (match.loser_elo_before || 0);

  // Check if current user is the reporter (winner) and match can be cancelled
  const isReporter = match.winner_id === userId;
  const canCancel = isReporter && ['unconfirmed', 'confirmed'].includes(match.status);

  const handleCancelReport = async () => {
    try {
      setCancelLoading(true);
      setCancelError(null);
      await matchService.cancelOwnMatch(match.id);
      setCancelSuccess(true);
      setTimeout(() => {
        if (onCancelSuccess) {
          onCancelSuccess();
        }
        onClose();
      }, 1500);
    } catch (error: any) {
      setCancelError(error?.response?.data?.error || 'Failed to cancel match report');
    } finally {
      setCancelLoading(false);
    }
  };

  const getSignedUrl = async (matchId: string | null): Promise<string | null> => {
    try {
      if (!matchId) {
        console.error('🔽 [MODAL] getSignedUrl called with null/undefined matchId');
        return null;
      }

      console.log('🔽 [MODAL] Starting getSignedUrl for matchId:', matchId);
      console.log('🔽 [MODAL] Match object:', JSON.stringify({
        id: match?.id,
        match_id: match?.match_id,
        replay_file_path: match?.replay_file_path
      }, null, 2));

      // Increment replay downloads  
      try {
        console.log('🔽 [MODAL] Incrementing download count for:', matchId);
        await matchService.incrementReplayDownloads(matchId);
        console.log('✅ [MODAL] Download count incremented');
      } catch (err) {
        console.warn('⚠️ [MODAL] Failed to increment download count:', err);
        // Continue anyway, this is not critical
      }

      const downloadUrl = `${API_URL}/matches/${matchId}/replay/download`;
      console.log('🔽 [MODAL] Fetching signed URL from:', downloadUrl);
      const response = await fetch(downloadUrl, { 
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Check for HTTP errors
      console.log('🔽 [MODAL] Response status:', response.status, response.statusText);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔽 [MODAL] HTTP error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      // Get content type to verify it's JSON
      const contentType = response.headers.get('content-type');
      console.log('🔽 [MODAL] Response content-type:', contentType);
      
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        console.error('🔽 [MODAL] Invalid content type. Expected JSON but got:', contentType);
        console.error('🔽 [MODAL] Response text (first 500 chars):', text.substring(0, 500));
        throw new Error(`Invalid response format: ${contentType || 'unknown'}`);
      }
      
      const data = await response.json();
      console.log('🔽 [MODAL] Response JSON:', JSON.stringify({
        hasSignedUrl: !!data.signedUrl,
        filename: data.filename,
        expiresIn: data.expiresIn
      }, null, 2));

      if (!data.signedUrl) {
        console.error('🔽 [MODAL] No signedUrl in response:', data);
        throw new Error('Missing signedUrl in response');
      }
      
      console.log('✅ [MODAL] Signed URL obtained successfully');
      return data.signedUrl;
    } catch (err) {
      console.error('❌ [MODAL] Error getting signed URL:', err);
      if (err instanceof Error) {
        alert(`Failed to get replay link: ${err.message}`);
      } else {
        alert('Failed to get replay link.');
      }
      return null;
    }
  };

  const handleDownloadReplay = async (e: React.MouseEvent, matchId: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    // Convert matchId to string and validate
    const idStr = matchId ? String(matchId).trim() : null;
    console.log('🔽 [MODAL] handleDownloadReplay called with:', { rawMatchId: matchId, stringId: idStr });

    if (onDownloadReplay) {
      // Pass the correct IDs: matchId for the matches table, and match.id as tournament match ID if needed
      onDownloadReplay(idStr, match.replay_file_path, match.id ? String(match.id) : undefined);
      return;
    }

    if (!idStr) {
      console.error('❌ [MODAL] No valid match ID for download:', { match_id: match?.match_id, id: match?.id });
      alert('Error: No match ID available for download');
      return;
    }

    const signedUrl = await getSignedUrl(idStr);
    if (!signedUrl) {
      // Error already shown in getSignedUrl
      return;
    }

    // Normal click: download
    window.location.href = signedUrl;
  };

  const handleDownloadContextMenu = async (e: React.MouseEvent, matchId: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    const signedUrl = await getSignedUrl(matchId);
    if (signedUrl) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        url: signedUrl,
      });
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      alert(t('replay_copied'));
      setContextMenu(null);
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 animate-fadeIn" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-11/12 max-h-screen overflow-y-auto border border-gray-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b-2 border-gray-100 px-6 py-6 bg-gray-50">
          <h2 className="text-2xl font-semibold text-gray-800 m-0">Match Details</h2>
          <button 
            className="bg-none border-none text-gray-400 text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded hover:text-gray-800 hover:bg-gray-100 transition-all"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6">
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6 pb-4 border-b border-gray-200">
              <div>
                <label className="text-gray-600 text-sm font-semibold">Date:</label>
                <span className="text-gray-800 text-sm block">{new Date(match.played_at || match.created_at).toLocaleString()}</span>
              </div>
              <div>
                <label className="text-gray-600 text-sm font-semibold">Map:</label>
                <span className="text-gray-800 text-sm block">{match.map}</span>
              </div>
              <div>
                <label className="text-gray-600 text-sm font-semibold">Status:</label>
                <div className="text-sm">
                  {match.status === 'confirmed' && <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">✓ Confirmed</span>}
                  {match.status === 'unconfirmed' && <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">⏳ Unconfirmed</span>}
                  {match.status === 'disputed' && <span className="inline-block px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">⚠ Disputed</span>}
                  {match.status === 'cancelled' && <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">✗ Cancelled</span>}
                  {!match.status && <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">⏳ Unconfirmed</span>}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">Statistic</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 bg-green-50">Winner</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700 bg-red-50">Loser</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Player</td>
                    <td className="px-4 py-3 text-center text-gray-800">{match.winner_nickname}</td>
                    <td className="px-4 py-3 text-center text-gray-800">{match.loser_nickname}</td>
                  </tr>

                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Faction</td>
                    <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">{match.winner_faction}</span></td>
                    <td className="px-4 py-3 text-center"><span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">{match.loser_faction}</span></td>
                  </tr>

                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Rating</td>
                    <td className="px-4 py-3 text-center text-gray-800"><StarDisplay rating={match.winner_rating} size="md" /></td>
                    <td className="px-4 py-3 text-center text-gray-800"><StarDisplay rating={match.loser_rating} size="md" /></td>
                  </tr>

                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">ELO Before</td>
                    <td className="px-4 py-3 text-center text-gray-800">{match.winner_elo_before || 'N/A'}</td>
                    <td className="px-4 py-3 text-center text-gray-800">{match.loser_elo_before || 'N/A'}</td>
                  </tr>

                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">ELO After</td>
                    <td className="px-4 py-3 text-center text-gray-800">{match.winner_elo_after || 'N/A'}</td>
                    <td className="px-4 py-3 text-center text-gray-800">{match.loser_elo_after || 'N/A'}</td>
                  </tr>

                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">ELO Change</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${winnerEloChange(match) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {winnerEloChange(match) >= 0 ? '+' : ''}{winnerEloChange(match)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${loserEloChange(match) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {loserEloChange(match) >= 0 ? '+' : ''}{loserEloChange(match)}
                      </span>
                    </td>
                  </tr>

                  {(match.winner_comments || match.loser_comments) && (
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Comments</td>
                      <td className="px-4 py-3 text-center text-gray-800 text-xs max-w-xs truncate" title={match.winner_comments || undefined}>{match.winner_comments || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-800 text-xs max-w-xs truncate" title={match.loser_comments || undefined}>{match.loser_comments || '-'}</td>
                    </tr>
                  )}

                  {match.replay_file_path && (
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-700 bg-gray-50">Replay</td>
                      <td colSpan={2} className="px-4 py-3 text-center">
                        <button 
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition-colors"
                          onClick={(e) => {
                            // Use match_id if available (for ranked tournaments), otherwise use id (for regular matches or unranked)
                            const downloadId = match.match_id || match.id;
                            if (!downloadId) {
                              alert('Error: No valid match ID found for download');
                              return;
                            }
                            handleDownloadReplay(e, downloadId);
                          }}
                          onContextMenu={(e) => {
                            const downloadId = match.match_id || match.id;
                            if (!downloadId) {
                              alert('Error: No valid match ID found for download');
                              return;
                            }
                            handleDownloadContextMenu(e, downloadId);
                          }}
                          title={`Downloads: ${match.replay_downloads || 0} | ${t('replay_right_click')}`}
                        >
                          ⬇️ Download ({match.replay_downloads || 0})
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3 justify-center">
          {canCancel && (
            <button 
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                cancelSuccess 
                  ? 'bg-green-500 text-white' 
                  : cancelLoading
                  ? 'bg-red-300 text-white cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
              onClick={handleCancelReport}
              disabled={cancelLoading || cancelSuccess}
            >
              {cancelLoading ? '⏳ Cancelling...' : cancelSuccess ? '✓ Report Cancelled' : '✗ Cancel Report'}
            </button>
          )}
          {cancelError && (
            <div className="text-red-600 text-sm self-center">
              {cancelError}
            </div>
          )}
          <button 
            className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg font-semibold transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Context Menu para descargas */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-[180px]"
            style={{
              left: contextMenu.x <= window.innerWidth - 200 ? `${contextMenu.x}px` : 'auto',
              right: contextMenu.x > window.innerWidth - 200 ? `${window.innerWidth - contextMenu.x}px` : 'auto',
              top: contextMenu.y <= window.innerHeight - 140 ? `${contextMenu.y}px` : 'auto',
              bottom: contextMenu.y > window.innerHeight - 140 ? `${window.innerHeight - contextMenu.y}px` : 'auto',
            }}
          >
            <button
              className="block w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 border-b border-gray-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(contextMenu.url);
              }}
            >
              📋 {t('replay_copy_link')}
            </button>
            <button
              className="block w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 border-b border-gray-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                window.open(contextMenu.url, '_blank');
                setContextMenu(null);
              }}
            >
              🔗 {t('replay_open_tab')}
            </button>
            <button
              className="block w-full text-left px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 transition-colors rounded-b-lg"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = contextMenu.url;
                setContextMenu(null);
              }}
            >
              ⬇️ {t('replay_download_action')}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MatchDetailsModal;
