import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { publicService, matchService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import '../styles/UserRecentMatches.css';

interface FilterState {
  opponent: string;
  map: string;
  status: string;
}

const UserRecentMatches: React.FC = () => {
  const { t } = useTranslation();
  const { userId } = useAuthStore();

  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    opponent: '',
    map: '',
    status: '',
  });

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        const res = await publicService.getAllMatches(currentPage, filters);
        const matchesData = res.data?.data || [];
        
        // Filter to only include matches where userId is winner or loser
        const userMatches = matchesData.filter(
          (m: any) => 
            (m.winner_id === userId && (!filters.opponent || m.loser_nickname?.toLowerCase().includes(filters.opponent.toLowerCase()))) ||
            (m.loser_id === userId && (!filters.opponent || m.winner_nickname?.toLowerCase().includes(filters.opponent.toLowerCase())))
        );

        setMatches(userMatches);

        if (res.data?.pagination) {
          setTotalPages(res.data.pagination.totalPages);
          setTotal(res.data.pagination.total);
        }
      } catch (err) {
        console.error('Error fetching matches:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, [currentPage, filters, userId]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({
      opponent: '',
      map: '',
      status: '',
    });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDownloadReplay = async (matchId: string, replayFilePath: string) => {
    try {
      const filename = replayFilePath.split('/').pop() || `replay_${matchId}`;
      await matchService.incrementReplayDownloads(matchId);
      
      const downloadUrl = `/api/matches/${matchId}/replay/download`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading replay:', err);
    }
  };

  const getOpponentName = (match: any) => {
    return match.winner_id === userId ? match.loser_nickname : match.winner_nickname;
  };

  const getMatchResult = (match: any) => {
    return match.winner_id === userId ? 'W' : 'L';
  };

  const getEloChange = (match: any) => {
    if (match.winner_id === userId) {
      return (match.winner_elo_after || 0) - (match.winner_elo_before || 0);
    } else {
      return (match.loser_elo_after || 0) - (match.loser_elo_before || 0);
    }
  };

  if (loading) {
    return <div className="user-recent-matches"><p>{t('loading')}</p></div>;
  }

  return (
    <div className="user-recent-matches">
      <h2>{t('sidebar.my_matches')}</h2>

      {/* Pagination Controls - Top */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button 
            className="page-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            {t('pagination_first')}
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            {t('pagination_prev')}
          </button>
          
          <div className="page-info">
            {t('pagination_page_info', { page: currentPage, totalPages })}
          </div>
          
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            {t('pagination_next')}
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            {t('pagination_last')}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="opponent">Opponent</label>
          <input
            type="text"
            id="opponent"
            name="opponent"
            placeholder="Search opponent..."
            value={filters.opponent}
            onChange={handleFilterChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="map">{t('filter_map')}</label>
          <input
            type="text"
            id="map"
            name="map"
            placeholder={t('filter_by_map')}
            value={filters.map}
            onChange={handleFilterChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="status">{t('filter_match_status')}</label>
          <select
            id="status"
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="">{t('all')}</option>
            <option value="confirmed">{t('match_status_confirmed')}</option>
            <option value="unconfirmed">{t('match_status_unconfirmed')}</option>
            <option value="disputed">{t('match_status_disputed')}</option>
          </select>
        </div>

        <button className="reset-btn" onClick={resetFilters}>
          {t('reset_filters')}
        </button>
      </div>

      <div className="matches-info">
        <p>{t('showing_count_matches', { count: matches.length, total, page: currentPage, totalPages })}</p>
      </div>

      {/* Matches Table */}
      <div className="matches-table-wrapper">
        <table className="matches-table">
          <thead>
            <tr>
              <th>{t('label_date')}</th>
              <th>Result</th>
              <th>{t('label_winner')}</th>
              <th>{t('label_loser')}</th>
              <th>{t('label_map')}</th>
              <th>{t('label_elo')}</th>
              <th>{t('label_status')}</th>
              <th>{t('label_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {matches.length === 0 ? (
              <tr>
                <td colSpan={8} className="no-matches">{t('matches_no_matches_found')}</td>
              </tr>
            ) : (
              matches.map((match) => (
                <tr key={match.id} className={`match-row ${getMatchResult(match).toLowerCase()}`}>
                  <td className="date-col">{new Date(match.created_at).toLocaleDateString()}</td>
                  
                  <td className="result-col">
                    <span className={`result-badge ${getMatchResult(match).toLowerCase()}`}>
                      {getMatchResult(match) === 'W' ? '🏆 ' : '❌ '}{getMatchResult(match)}
                    </span>
                  </td>
                  
                  <td className="player-col">{match.winner_nickname}</td>
                  <td className="player-col">{match.loser_nickname}</td>
                  
                  <td className="map-col">{match.map}</td>
                  
                  <td className="elo-col">
                    <div className="elo-change">
                      <span className={`elo-value ${getEloChange(match) >= 0 ? 'positive' : 'negative'}`}>
                        {getEloChange(match) >= 0 ? '+' : ''}{getEloChange(match)}
                      </span>
                    </div>
                  </td>
                  
                  <td className="status-col">
                    <span className={`status-badge ${match.status || 'unconfirmed'}`}>
                      {match.status === 'confirmed' && t('match_status_confirmed')}
                      {match.status === 'unconfirmed' && t('match_status_unconfirmed')}
                      {match.status === 'disputed' && t('match_status_disputed')}
                      {!match.status && t('match_status_unconfirmed')}
                    </span>
                  </td>
                  
                  <td className="actions-col">
                    {match.replay_file_path ? (
                      <button
                        className="download-btn"
                        onClick={() => handleDownloadReplay(match.id, match.replay_file_path)}
                        title={`${t('downloads')}: ${match.replay_downloads || 0}`}
                      >
                        ⬇️ {t('download')} ({match.replay_downloads || 0})
                      </button>
                    ) : (
                      <span className="no-replay">{t('no_replay')}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls - Bottom */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button 
            className="page-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
          >
            {t('pagination_first')}
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            {t('pagination_prev')}
          </button>
          
          <div className="page-info">
            {t('pagination_page_info', { page: currentPage, totalPages })}
          </div>
          
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            {t('pagination_next')}
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            {t('pagination_last')}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserRecentMatches;
