import React from 'react';
import { useTranslation } from 'react-i18next';
import { matchService } from '../services/api';
import PlayerLink from './PlayerLink';
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

  const handleDownloadReplay = async (matchId: string, replayFilePath: string) => {
    try {
      if (onDownloadReplay) {
        await onDownloadReplay(matchId, replayFilePath);
        return;
      }
      await matchService.incrementReplayDownloads(matchId);
      const downloadUrl = `${API_URL}/matches/${matchId}/replay/download`;
      const response = await fetch(downloadUrl, { method: 'GET' });
      if (!response.ok) throw new Error(`Download failed with status ${response.status}`);
      const { signedUrl } = await response.json();
      window.location.href = signedUrl;
    } catch (err) {
      console.error('Error downloading replay:', err);
    }
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
      <div className="games-table-wrapper">
        <table className="games-table">
          <thead>
            <tr>
              <th className="date-col sortable" onClick={() => handleSort('date')}>{t('label_date')}</th>
              <th className="winner-col sortable" onClick={() => handleSort('winner')}>{t('label_winner')}</th>
              <th className="loser-col sortable" onClick={() => handleSort('loser')}>{t('label_loser')}</th>
              <th className="map-col sortable" onClick={() => handleSort('map')}>{t('label_map')}</th>
              <th className="status-actions-col sortable" onClick={() => handleSort('status')}>{t('label_status_actions') || 'Status / Actions'}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="no-matches">{t('matches_no_matches_found')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="games-table-wrapper">
      <table className="games-table">
        <thead>
          <tr>
            <th className="date-col sortable" onClick={() => handleSort('date')}>
              {t('label_date')}{sortColumn === 'date' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
            </th>
            <th className="winner-col sortable" onClick={() => handleSort('winner')}>
              {t('label_winner')}{sortColumn === 'winner' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
            </th>
            <th className="loser-col sortable" onClick={() => handleSort('loser')}>
              {t('label_loser')}{sortColumn === 'loser' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
            </th>
            <th className="map-col sortable" onClick={() => handleSort('map')}>
              {t('label_map')}{sortColumn === 'map' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
            </th>
            <th className="status-actions-col sortable" onClick={() => handleSort('status')}>
              {t('label_status_actions') || 'Status / Actions'}{sortColumn === 'status' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedMatches.map((match) => (
            <tr key={match.id} className={`game-row`}>
              <td className="date-col">{new Date(match.created_at).toLocaleDateString()}</td>

              <td className="winner-col">
                <div className="player-block">
                  <div className="first-row">
                    <div className="player-name">
                      <PlayerLink nickname={match.winner_nickname} userId={match.winner_id} />
                    </div>
                    <div className="faction-badge">{match.winner_faction}</div>
                    <div className="elo-info">
                      <span className="elo-value">{match.winner_elo_before || 'N/A'}</span>
                      <span className={`elo-change ${winnerEloChange(match) >= 0 ? 'positive' : 'negative'}`}>
                        ({winnerEloChange(match) >= 0 ? '+' : ''}{winnerEloChange(match)})
                      </span>
                    </div>
                    <div className="rating-info">
                      <span className="rating-value">{match.winner_ranking_pos || 'N/A'}</span>
                      <span className={`rating-change ${(match.winner_ranking_change || 0) > 0 ? 'positive' : (match.winner_ranking_change || 0) < 0 ? 'negative' : ''}`}>
                        {(match.winner_ranking_change || 0) > 0 ? '↑' : (match.winner_ranking_change || 0) < 0 ? '↓' : ''}{Math.abs(match.winner_ranking_change || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="comments-row">
                    {match.winner_comments && (
                      <div className="player-comment" title={match.winner_comments}>{match.winner_comments}</div>
                    )}
                  </div>
                </div>
              </td>

              <td className="loser-col">
                <div className="player-block">
                  <div className="first-row">
                    <div className="player-name">
                      <PlayerLink nickname={match.loser_nickname} userId={match.loser_id} />
                    </div>
                    <div className="faction-badge">{match.loser_faction}</div>
                    <div className="elo-info">
                      <span className="elo-value">{match.loser_elo_before || 'N/A'}</span>
                      <span className={`elo-change ${loserEloChange(match) >= 0 ? 'positive' : 'negative'}`}>
                        ({loserEloChange(match) >= 0 ? '+' : ''}{loserEloChange(match)})
                      </span>
                    </div>
                    <div className="rating-info">
                      <span className="rating-value">{match.loser_ranking_pos || 'N/A'}</span>
                      <span className={`rating-change ${(match.loser_ranking_change || 0) > 0 ? 'positive' : (match.loser_ranking_change || 0) < 0 ? 'negative' : ''}`}>
                        {(match.loser_ranking_change || 0) > 0 ? '↑' : (match.loser_ranking_change || 0) < 0 ? '↓' : ''}{Math.abs(match.loser_ranking_change || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="comments-row">
                    {match.loser_comments && (
                      <div className="player-comment" title={match.loser_comments}>{match.loser_comments}</div>
                    )}
                  </div>
                </div>
              </td>

              <td className="map-col">{match.map}</td>

              <td className="status-actions-col">
                <div className="status-item">
                  <span className={`status-badge ${match.status || 'unconfirmed'}`}>
                    {match.status === 'confirmed' && t('match_status_confirmed')}
                    {match.status === 'unconfirmed' && t('match_status_unconfirmed')}
                    {match.status === 'disputed' && t('match_status_disputed')}
                    {match.status === 'cancelled' && t('match_status_cancelled')}
                    {!match.status && t('match_status_unconfirmed')}
                  </span>
                </div>
                <div className="actions-item">
                  {/* Show Report Match button for loser when match is unconfirmed and user is authenticated */}
                  {isAuthenticated && currentPlayerId === match.loser_id && (match.status === 'unconfirmed' || !match.status) && (
                    <button
                      className="btn-report-match"
                      onClick={() => onOpenConfirmation && onOpenConfirmation(match)}
                      title={t('report_match_link')}
                    >
                      {t('report_match_link')}
                    </button>
                  )}
                  <button
                    className="details-btn"
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
                      className="download-btn"
                      onClick={() => handleDownloadReplay(match.id, match.replay_file_path)}
                      title={`${t('downloads')}: ${match.replay_downloads || 0}`}
                    >
                      ⬇️
                    </button>
                  ) : (
                    <span className="no-replay">{t('no_replay')}</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MatchesTable;
