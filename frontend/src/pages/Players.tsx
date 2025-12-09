import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { publicService } from '../services/api';
import '../styles/Players.css';

interface PlayerStats {
  id: string;
  nickname: string;
  elo_rating: number;
  is_rated: boolean;
  matches_played: number;
  total_wins: number;
  total_losses: number;
  winPercentage: number;
}

interface FilterState {
  nickname: string;
  min_elo: string;
  max_elo: string;
  min_matches: string;
  rated_only: boolean;
}

const Players: React.FC = () => {
  const { t } = useTranslation();
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
    min_matches: '',
    rated_only: false,
  });
  
  // Applied filters state (updates with debounce)
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    nickname: '',
    min_elo: '',
    max_elo: '',
    min_matches: '',
    rated_only: false,
  });
  
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce filter changes
  const handleFilterInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setInputFilters(prev => ({
      ...prev,
      [name]: newValue,
    }));
    
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timer to apply filters after 500ms
    debounceTimer.current = setTimeout(() => {
      setAppliedFilters(prev => ({
        ...prev,
        [name]: newValue,
      }));
      setCurrentPage(1);
    }, 500);
  };

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await publicService.getAllPlayers(currentPage, appliedFilters);
        
        // Calculate stats for each player
        const allUsers = res.data?.data || [];
        const playersWithStats: PlayerStats[] = allUsers.map((user: any) => {
          const totalMatches = user.matches_played || 0;
          const wins = user.total_wins || 0;
          const losses = user.total_losses || 0;

          const decidedMatches = wins + losses;
          const winPercentage = decidedMatches > 0 ? Math.round((wins / decidedMatches) * 100) : 0;

          return {
            id: user.id,
            nickname: user.nickname,
            elo_rating: user.elo_rating || 1200,
            is_rated: user.is_rated || false,
            matches_played: totalMatches,
            total_wins: wins,
            total_losses: losses,
            winPercentage,
          };
        });

        setPlayers(playersWithStats);
        
        // Set pagination info
        if (res.data?.pagination) {
          setTotalPages(res.data.pagination.totalPages);
          setTotal(res.data.pagination.total);
        }
      } catch (err) {
        console.error('Error fetching players:', err);
        setError('Error loading players');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [currentPage, appliedFilters]);
  const handleResetFilters = () => {
    const emptyFilters = {
      nickname: '',
      min_elo: '',
      max_elo: '',
      min_matches: '',
      rated_only: false,
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
    return (
      <div className="players-container">
        <p>{t('loading') || 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div className="players-container">
      <h1>{t('players_title')}</h1>

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

        <div className="filter-group">
          <label htmlFor="min_matches">Min Matches</label>
          <input
            type="number"
            id="min_matches"
            name="min_matches"
            placeholder="Min matches..."
            value={inputFilters.min_matches}
            onChange={handleFilterInputChange}
          />
        </div>

        <div className="filter-group checkbox-group">
          <label htmlFor="rated_only">
            <input
              type="checkbox"
              id="rated_only"
              name="rated_only"
              checked={inputFilters.rated_only}
              onChange={handleFilterInputChange}
            />
            Rated Only
          </label>
        </div>

        <button className="reset-btn" onClick={handleResetFilters}>
          Reset Filters
        </button>
      </div>

      <div className="players-info">
        <p>{t('showing_count', { count: players.length, total, page: currentPage, totalPages })}</p>
      </div>

      <div className="players-table-wrapper">
        <table className="players-table">
          <thead>
            <tr>
              <th className="rank-col">#</th>
              <th className="nickname-col">Nickname</th>
              <th className="elo-col">ELO</th>
              <th className="status-col">Status</th>
              <th className="matches-col">Total</th>
              <th className="wins-col">Wins</th>
              <th className="losses-col">Losses</th>
              <th className="ratio-col">Win %</th>
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
                <td className="status-col">
                  <span className={`status-badge ${player.is_rated ? 'rated' : 'unrated'}`}>
                    {player.is_rated ? t('players_status_rated') : t('players_status_unrated')}
                  </span>
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
              </tr>
            ))}
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

export default Players;
