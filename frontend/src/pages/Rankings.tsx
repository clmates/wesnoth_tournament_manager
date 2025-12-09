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
    return <div className="rankings-container"><p>{t('loading') || 'Loading...'}</p></div>;
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
            First
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ← Prev
          </button>
          
          <div className="page-info">
            Page <span className="current-page">{currentPage}</span> of <span className="total-pages">{totalPages}</span>
          </div>
          
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="nickname">Nickname</label>
          <input
            type="text"
            id="nickname"
            name="nickname"
            placeholder="Search by nickname..."
            value={inputFilters.nickname}
            onChange={handleFilterInputChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="min_elo">Min ELO</label>
          <input
            type="number"
            id="min_elo"
            name="min_elo"
            placeholder="Min ELO..."
            value={inputFilters.min_elo}
            onChange={handleFilterInputChange}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="max_elo">Max ELO</label>
          <input
            type="number"
            id="max_elo"
            name="max_elo"
            placeholder="Max ELO..."
            value={inputFilters.max_elo}
            onChange={handleFilterInputChange}
          />
        </div>

        <button className="reset-btn" onClick={handleResetFilters}>
          Reset Filters
        </button>
      </div>

      <div className="rankings-info">
        <p>Showing {players.length} of {total} total players (Page {currentPage} of {totalPages})</p>
      </div>

      {players.length > 0 ? (
        <div className="rankings-table-wrapper">
          <table className="rankings-table">
            <thead>
              <tr>
                <th className="rank-col">#</th>
                <th className="nickname-col">Nickname</th>
                <th className="elo-col">ELO</th>
                <th className="matches-col">Total</th>
                <th className="wins-col">Wins</th>
                <th className="losses-col">Losses</th>
                <th className="ratio-col">%</th>
                <th className="trend-col">Trend</th>
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
            First
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ← Prev
          </button>
          
          <div className="page-info">
            Page <span className="current-page">{currentPage}</span> of <span className="total-pages">{totalPages}</span>
          </div>
          
          <button 
            className="page-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
          <button 
            className="page-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
};

export default Rankings;
