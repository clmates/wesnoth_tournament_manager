import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import PlayerLink from '../components/PlayerLink';
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

type SortColumn = 'nickname' | 'elo_rating' | 'matches_played' | 'total_wins' | 'total_losses' | 'winPercentage' | 'trend' | '';
type SortDirection = 'asc' | 'desc';

const Rankings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    // Sorting logic
    const handleSort = (column: SortColumn) => {
      if (sortColumn === column) {
        setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortColumn(column);
        setSortDirection('desc');
      }
    };

    // Sort players before rendering
    const sortedPlayers = React.useMemo(() => {
      if (!sortColumn) return players;
      const sorted = [...players].sort((a, b) => {
        let aValue: any = a[sortColumn as keyof PlayerStats];
        let bValue: any = b[sortColumn as keyof PlayerStats];
        // For nickname, sort as string
        if (sortColumn === 'nickname' || sortColumn === 'trend') {
          aValue = aValue?.toLowerCase?.() || '';
          bValue = bValue?.toLowerCase?.() || '';
          if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
          if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        }
        // For numbers
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        return 0;
      });
      return sorted;
    }, [players, sortColumn, sortDirection]);
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

      {/* Ranking Criteria Info */}
      <div className="ranking-criteria-info">
        <h3>{t('ranking_criteria_title') || 'Ranking Criteria'}</h3>
        <ul>
          <li>
            <strong>{t('ranking_min_elo') || 'Minimum ELO Rating'}:</strong> {t('ranking_min_elo_desc') || 'Players must have a minimum ELO rating to appear in the ranking'}
          </li>
          <li>
            <strong>{t('ranking_min_matches') || 'Minimum Matches'}:</strong> {t('ranking_min_matches_desc') || 'Players must have completed a minimum number of rated matches'}
          </li>
          <li>
            <strong>{t('ranking_active_days') || 'Recent Activity'}:</strong> {t('ranking_active_days_desc') || 'Players must have been active within the last 30 days to appear in the ranking'}
          </li>
        </ul>
      </div>

      {/* Rankings Content */}
      <div className="rankings-content">
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
                <th className="nickname-col sortable" onClick={() => handleSort('nickname')}>
                  {t('label_nickname')}
                  {sortColumn === 'nickname' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                </th>
                <th className="elo-col sortable" onClick={() => handleSort('elo_rating')}>
                  {t('label_elo')}
                  {sortColumn === 'elo_rating' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                </th>
                <th className="matches-col sortable" onClick={() => handleSort('matches_played')}>
                  {t('label_total')}
                  {sortColumn === 'matches_played' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                </th>
                <th className="wins-col sortable" onClick={() => handleSort('total_wins')}>
                  {t('label_wins')}
                  {sortColumn === 'total_wins' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                </th>
                <th className="losses-col sortable" onClick={() => handleSort('total_losses')}>
                  {t('label_losses')}
                  {sortColumn === 'total_losses' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                </th>
                <th className="ratio-col sortable" onClick={() => handleSort('winPercentage')}>
                  {t('label_win_pct')}
                  {sortColumn === 'winPercentage' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                </th>
                <th className="trend-col sortable" onClick={() => handleSort('trend')}>
                  {t('label_trend')}
                  {sortColumn === 'trend' && (sortDirection === 'desc' ? ' ▼' : ' ▲')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, index) => (
                <tr key={player.id} className={index % 2 === 0 ? 'even' : 'odd'}>
                  <td className="rank-col">
                    <span className="rank-badge">#{(currentPage - 1) * 20 + index + 1}</span>
                  </td>
                  <td className="nickname-col">
                    <PlayerLink nickname={player.nickname} userId={player.id} />
                  </td>
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
    </div>
  );
};

export default Rankings;
