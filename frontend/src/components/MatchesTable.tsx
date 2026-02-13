import React from 'react';
import { useTranslation } from 'react-i18next';
import { matchService } from '../services/api';
import PlayerLink from './PlayerLink';
import StarDisplay from './StarDisplay';
import { useAuthStore } from '../store/authStore';

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

interface MatchesTableProps {
  matches: any[];
  currentPlayerId?: string;
  onDownloadReplay?: (matchId: string, replayFilePath: string) => void;
  onViewDetails?: (match: any) => void;
  onOpenConfirmation?: (match: any) => void;
}

type SortColumn = 'date' | 'winner' | 'loser' | 'map' | 'status' | '';
type SortDirection = 'asc' | 'desc';

const MatchesTable: React.FC<MatchesTableProps> = ({
  matches,
  currentPlayerId,
  onDownloadReplay,
  onViewDetails,
  onOpenConfirmation,
}) => {
  const { t } = useTranslation();
  const { isAuthenticated, userId } = useAuthStore();

  const [sortColumn, setSortColumn] = React.useState<SortColumn>('');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc');
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; url: string } | null>(null);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const winnerEloChange = (match: any) => (match.winner_elo_after || 0) - (match.winner_elo_before || 0);
  const loserEloChange = (match: any) => (match.loser_elo_after || 0) - (match.loser_elo_before || 0);

  const getSignedUrl = async (matchId: string): Promise<string | null> => {
    try {
      await matchService.incrementReplayDownloads(matchId);
      const downloadUrl = `${API_URL}/matches/${matchId}/replay/download`;
      console.log('🔽 Fetching signed URL from:', downloadUrl);
      const response = await fetch(downloadUrl, { method: 'GET' });
      
      // Check for HTTP errors
      if (!response.ok) {
        console.error('🔽 HTTP error:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Get content type to verify it's JSON
      const contentType = response.headers.get('content-type');
      console.log('🔽 Response content-type:', contentType);
      
      if (!contentType?.includes('application/json')) {
        const text = await response.text();
        console.error('🔽 Invalid content type. Expected JSON but got:', contentType);
        console.error('🔽 Response text (first 500 chars):', text.substring(0, 500));
        throw new Error(`Invalid response format: ${contentType || 'unknown'}`);
      }
      
      const data = await response.json();
      if (!data.signedUrl) {
        console.error('🔽 No signedUrl in response:', data);
        throw new Error('Missing signedUrl in response');
      }
      
      console.log('✅ Signed URL obtained successfully');
      return data.signedUrl;
    } catch (err) {
      console.error('❌ Error getting signed URL:', err);
      if (err instanceof Error) {
        alert(`Failed to get replay link: ${err.message}`);
      } else {
        alert('Failed to get replay link.');
      }
      return null;
    }
  };

  const handleDownloadReplay = async (e: React.MouseEvent, matchId: string, replayFilePath: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (onDownloadReplay) {
      await onDownloadReplay(matchId, replayFilePath);
      return;
    }

    const signedUrl = await getSignedUrl(matchId);
    if (!signedUrl) {
      // Error already shown in getSignedUrl
      return;
    }

    // Normal click: download
    window.location.href = signedUrl;
  };

  const handleDownloadContextMenu = async (e: React.MouseEvent, matchId: string) => {
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

  // Sorting logic for matches
  const sortedMatches = React.useMemo(() => {
    if (!sortColumn) return matches;
    const sorted = [...matches].sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortColumn) {
        case 'date':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case 'winner':
          aValue = a.winner_nickname?.toLowerCase?.() || '';
          bValue = b.winner_nickname?.toLowerCase?.() || '';
          break;
        case 'loser':
          aValue = a.loser_nickname?.toLowerCase?.() || '';
          bValue = b.loser_nickname?.toLowerCase?.() || '';
          break;
        case 'map':
          aValue = a.map?.toLowerCase?.() || '';
          bValue = b.map?.toLowerCase?.() || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [matches, sortColumn, sortDirection]);

  if (matches.length === 0) {
    return (
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse bg-white">
          <thead className="bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('date')}>{t('label_date')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('winner')}>{t('label_winner')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('loser')}>{t('label_loser')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('map')}>{t('label_map')}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>{t('label_status_actions') || 'Status / Actions'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500 italic">{t('matches_no_matches_found')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse bg-white">
        <thead className="bg-gray-100 border-b-2 border-gray-300">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('date')}>
              {t('label_date')}{sortColumn === 'date' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('winner')}>
              {t('label_winner')}{sortColumn === 'winner' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('loser')}>
              {t('label_loser')}{sortColumn === 'loser' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('map')}>
              {t('label_map')}{sortColumn === 'map' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('status')}>
              {t('label_status_actions') || 'Status / Actions'}{sortColumn === 'status' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedMatches.map((match) => (
            <tr key={match.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-700">{new Date(match.created_at).toLocaleDateString()}</td>

              <td className="px-4 py-3 text-sm">
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 min-w-0">
                      <PlayerLink nickname={match.winner_nickname} userId={match.winner_id} />
                    </div>
                    <StarDisplay rating={match.winner_rating} size="sm" />
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-semibold">{match.winner_faction}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-600">
                    <div>
                      <span className="font-semibold text-gray-700">ELO: </span>
                      <span>{match.winner_elo_before || 'N/A'}</span>
                      <span className={`ml-1 font-semibold ${winnerEloChange(match) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ({winnerEloChange(match) >= 0 ? '+' : ''}{winnerEloChange(match)})
                      </span>
                    </div>
                    {match.winner_ranking_pos && (
                      <div>
                        <span className="font-semibold text-gray-700">Rank: </span>
                        <span>{match.winner_ranking_pos}</span>
                        <span className={`ml-1 font-semibold ${(match.winner_ranking_change || 0) > 0 ? 'text-green-600' : (match.winner_ranking_change || 0) < 0 ? 'text-red-600' : ''}`}>
                          {(match.winner_ranking_change || 0) > 0 ? '↑' : (match.winner_ranking_change || 0) < 0 ? '↓' : ''}{Math.abs(match.winner_ranking_change || 0)}
                        </span>
                      </div>
                    )}
                  </div>
                  {match.winner_comments && (
                    <div className="text-xs text-gray-500 italic max-w-xs truncate" title={match.winner_comments}>{match.winner_comments}</div>
                  )}
                </div>
              </td>

              <td className="px-4 py-3 text-sm">
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 min-w-0">
                      <PlayerLink nickname={match.loser_nickname} userId={match.loser_id} />
                    </div>
                    <StarDisplay rating={match.loser_rating} size="sm" />
                    <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded font-semibold">{match.loser_faction}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-600">
                    <div>
                      <span className="font-semibold text-gray-700">ELO: </span>
                      <span>{match.loser_elo_before || 'N/A'}</span>
                      <span className={`ml-1 font-semibold ${loserEloChange(match) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ({loserEloChange(match) >= 0 ? '+' : ''}{loserEloChange(match)})
                      </span>
                    </div>
                    {match.loser_ranking_pos && (
                      <div>
                        <span className="font-semibold text-gray-700">Rank: </span>
                        <span>{match.loser_ranking_pos}</span>
                        <span className={`ml-1 font-semibold ${(match.loser_ranking_change || 0) > 0 ? 'text-green-600' : (match.loser_ranking_change || 0) < 0 ? 'text-red-600' : ''}`}>
                          {(match.loser_ranking_change || 0) > 0 ? '↑' : (match.loser_ranking_change || 0) < 0 ? '↓' : ''}{Math.abs(match.loser_ranking_change || 0)}
                        </span>
                      </div>
                    )}
                  </div>
                  {match.loser_comments && (
                    <div className="text-xs text-gray-500 italic max-w-xs truncate" title={match.loser_comments}>{match.loser_comments}</div>
                  )}
                </div>
              </td>

              <td className="px-4 py-3 text-sm text-gray-700">{match.map}</td>

              <td className="px-4 py-3 text-sm">
                <div className="space-y-2">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      match.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      match.status === 'disputed' ? 'bg-yellow-100 text-yellow-700' :
                      match.status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {match.status === 'confirmed' && t('match_status_confirmed')}
                      {match.status === 'unconfirmed' && t('match_status_unconfirmed')}
                      {match.status === 'disputed' && t('match_status_disputed')}
                      {match.status === 'cancelled' && t('match_status_cancelled')}
                      {!match.status && t('match_status_unconfirmed')}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {isAuthenticated && currentPlayerId === match.loser_id && (match.status === 'unconfirmed' || !match.status) && (
                      <button
                        className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition"
                        onClick={() => onOpenConfirmation && onOpenConfirmation(match)}
                        title={t('report_match_link')}
                      >
                        {t('report_match_link')}
                      </button>
                    )}
                    <button
                      className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition"
                      onClick={() => {
                        if (import.meta.env.VITE_DEBUG_LOGS === 'true') {
                          console.log('Details button clicked for match:', match);
                          console.log('onViewDetails prop exists:', !!onViewDetails);
                        }
                        if (onViewDetails) {
                          onViewDetails(match);
                        }
                      }}
                      title={t('view_match_details')}
                    >
                      {t('details_btn')}
                    </button>
                    {match.replay_file_path ? (
                      <button
                        className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition"
                        onClick={(e) => handleDownloadReplay(e, match.id, match.replay_file_path)}
                        onContextMenu={(e) => handleDownloadContextMenu(e, match.id)}
                        title={`${t('downloads')}: ${match.replay_downloads || 0} | ${t('replay_right_click')}`}
                      >
                        ⬇️ {match.replay_downloads || 0}
                      </button>
                    ) : (
                      <span className="px-2 py-1 text-xs text-gray-500">{t('no_replay')}</span>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

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

export default MatchesTable;
