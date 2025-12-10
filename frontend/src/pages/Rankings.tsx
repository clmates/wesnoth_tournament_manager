import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { userService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import '../styles/Rankings.css';

interface PlayerStats {
  id: string;
  nickname: string;
  elo_rating: number;
  is_rated: boolean;
  matches_played: number;
  total_wins: number;
  total_losses: number;
  winPercentage: number;
  trend: string;
}

interface FilterState {
  nickname: string;
  min_elo: string;
  max_elo: string;
}

const Rankings: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Input state (updates immediately as user types)
  const [inputFilters, setInputFilters] = useState<FilterState>({
    nickname: '',
    min_elo: '',
    max_elo: '',
  });
  
  // Applied filters state (updates with debounce)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    nickname: '',
    min_elo: '',
    max_elo: '',
  });
  
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce filter changes
  const handleFilterInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setInputFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timer to apply filters after 500ms
    debounceTimer.current = setTimeout(() => {
      setAppliedFilters(prev => ({
        ...prev,
        [name]: value,
      }));
      setCurrentPage(1);
    }, 500);
  };

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        setLoading(true);
        setError('');

        // Fetch global ranking with pagination and filters
        const rankingRes = await userService.getGlobalRanking(currentPage, appliedFilters);
        const ratedPlayers = rankingRes.data?.data || [];

        // Calculate stats for each player
        const playersWithStats: PlayerStats[] = ratedPlayers.map((player: any) => {
          const totalMatches = player.matches_played || 0;
          const wins = player.total_wins || 0;
          const losses = player.total_losses || 0;

          // Calculate win percentage
          const decidedMatches = wins + losses;
          const winPercentage = decidedMatches > 0 ? Math.round((wins / decidedMatches) * 100) : 0;

          // Trend is stored in the database
          const trend = player.trend || '-';

          return {
            id: player.id,
            nickname: player.nickname,
            elo_rating: player.elo_rating,
            is_rated: player.is_rated,
            matches_played: totalMatches,
            total_wins: wins,
            total_losses: losses,
            winPercentage,
            trend,
          };
        });

        setPlayers(playersWithStats);

        // Set pagination info
        if (rankingRes.data?.pagination) {
          setTotalPages(rankingRes.data.pagination.totalPages);
          setTotal(rankingRes.data.pagination.total);
        }
      } catch (err) {
        console.error('Error fetching rankings:', err);
        setError('Error loading rankings');
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, [currentPage, appliedFilters]);

  const handleResetFilters = () => {
    const emptyFilters = {
      nickname: '',
      min_elo: '',
      max_elo: '',
    };
    setInputFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return <div className="rankings-container"><p>{t('loading')}</p></div>;
  }

  return (
    <div className="rankings-container">
      <h1>{t('navbar_rankings') || 'Rankings'}</h1>

      {error && <p className="error-message">{error}</p>}

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
          <label htmlFor="nickname">{t('filter_nickname')}</label>
          <input
            type="text"
            id="nickname"
            name="nickname"
            placeholder={t('filter_by_nickname')}
            value={inputFilters.nickname}
            onChange={handleFilterInputChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="min_elo">{t('filter_min_elo')}</label>
          <input
            type="number"
            id="min_elo"
            name="min_elo"
            placeholder={t('filter_min_elo_placeholder')}
            value={inputFilters.min_elo}
            onChange={handleFilterInputChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="max_elo">{t('filter_max_elo')}</label>
          <input
            type="number"
            id="max_elo"
            name="max_elo"
            placeholder={t('filter_max_elo_placeholder')}
            value={inputFilters.max_elo}
            onChange={handleFilterInputChange}
          />
        </div>

        <button className="reset-btn" onClick={handleResetFilters}>
          {t('reset_filters')}
        </button>
      </div>

      <div className="rankings-info">
        <p>{t('showing_count', { count: players.length, total, page: currentPage, totalPages })}</p>
      </div>

      {players.length > 0 ? (
        <div className="rankings-table-wrapper">
          <table className="rankings-table">
            <thead>
              <tr>
                <th className="rank-col">#</th>
                <th className="nickname-col">{t('label_nickname')}</th>
                <th className="elo-col">{t('label_elo')}</th>
                <th className="matches-col">{t('label_total')}</th>
                <th className="wins-col">{t('label_wins')}</th>
                <th className="losses-col">{t('label_losses')}</th>
                <th className="ratio-col">{t('label_win_pct')}</th>
                <th className="trend-col">{t('label_trend')}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => (
                <tr key={player.id} className={index % 2 === 0 ? 'even' : 'odd'}>
                  <td className="rank-col">
                    <span className="rank-badge">#{(currentPage - 1) * 20 + index + 1}</span>
                  </td>
                  <td className="nickname-col">{player.nickname}</td>
                  <td className="elo-col">
                    <span className="elo-badge">{player.elo_rating}</span>
                  </td>
                  <td className="matches-col">{player.matches_played}</td>
                  <td className="wins-col">
                    <span className="wins">{player.total_wins}</span>
                  </td>
                  <td className="losses-col">
                    <span className="losses">{player.total_losses}</span>
                  </td>
                  <td className="ratio-col">
                    <span className="ratio-badge">{player.winPercentage}%</span>
                  </td>
                  <td className="trend-col">
                    <span className={`trend trend-${player.trend.charAt(0) || '-'}`}>
                      {player.trend}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="no-data">{t('no_data') || 'No ranking data available'}</p>
      )}

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

export default Rankings;
