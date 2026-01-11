import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { matchService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import MainLayout from '../components/MainLayout';
import MatchesTable from '../components/MatchesTable';
import MatchConfirmationModal from '../components/MatchConfirmationModal';
import MatchDetailsModal from '../components/MatchDetailsModal';
import '../styles/Matches.css';

// Get API URL for direct backend calls
// Determine API URL based on frontend hostname and Vite environment variables
let API_URL: string;

if (window.location.hostname.includes('main.')) {
  // Main deployment on Cloudflare Pages
  API_URL = import.meta.env.VITE_API_URL || 'https://wesnothtournamentmanager-main.up.railway.app/api';
} else if (window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1') {
  // Local development
  API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
} else {
  // Production deployment (Cloudflare Pages default or custom domain)
  API_URL = import.meta.env.VITE_API_URL || 'https://wesnothtournamentmanager-production.up.railway.app/api';
}

interface FilterState {
  winner: string;
  loser: string;
  map: string;
  status: string;
  confirmed: string;
}

interface MatchDetailsModal {
  isOpen: boolean;
  match: any | null;
}

const MyMatches: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, userId } = useAuthStore();

  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [matchDetailsModal, setMatchDetailsModal] = useState<MatchDetailsModal>({
    isOpen: false,
    match: null,
  });
  const [confirmationModal, setConfirmationModal] = useState<MatchDetailsModal>({
    isOpen: false,
    match: null,
  });
  const [filters, setFilters] = useState<FilterState>({
    winner: '',
    loser: '',
    map: '',
    status: '',
    confirmed: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        console.log('Fetching user matches for page:', currentPage, 'with filters:', filters);
        const res = await matchService.getUserMatches(userId!, currentPage, filters);
        console.log('Full response:', res);
        console.log('Response data:', res.data);
        
        const matchesData = res.data?.data || [];
        console.log('Matches data:', matchesData);
        
        setAllMatches(matchesData);
        
        if (res.data?.pagination) {
          console.log('Pagination info:', res.data.pagination);
          setTotalPages(res.data.pagination.totalPages);
          setTotal(res.data.pagination.total);
        }
      } catch (err) {
        console.error('Error fetching matches:', err);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated && userId) {
      fetchMatches();
    }
  }, [currentPage, filters, isAuthenticated, userId]);

  const handleFilterChangeWithReset = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters({
      winner: '',
      loser: '',
      map: '',
      status: '',
      confirmed: '',
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
      console.log('🔽 Starting download for match:', matchId);
      console.log('🔽 Incrementing download count...');
      await matchService.incrementReplayDownloads(matchId);
      
      // Fetch signed URL from the backend
      console.log('🔽 Fetching signed URL from backend...');
      const downloadUrl = `${API_URL}/matches/${matchId}/replay/download`;
      console.log('🔽 Download URL:', downloadUrl);
      const response = await fetch(downloadUrl, {
        method: 'GET'
      });

      console.log('🔽 Response status:', response.status);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      // Get signed URL from response and redirect
      console.log('🔽 Getting signed URL...');
      const { signedUrl, filename } = await response.json();
      console.log('🔽 Redirecting to signed URL:', signedUrl);
      window.location.href = signedUrl;
      console.log('✅ Download initiated:', filename);
    } catch (err) {
      console.error('❌ Error downloading replay:', err);
      alert('Failed to download replay. Check console for details.');
    }
  };

  const openMatchDetails = (match: any) => {
    setMatchDetailsModal({
      isOpen: true,
      match,
    });
  };

  const closeMatchDetails = () => {
    setMatchDetailsModal({
      isOpen: false,
      match: null,
    });
  };

  const openConfirmation = (match: any) => {
    setConfirmationModal({
      isOpen: true,
      match,
    });
  };

  const closeConfirmation = () => {
    setConfirmationModal({
      isOpen: false,
      match: null,
    });
  };

  const handleConfirmationSuccess = () => {
    closeConfirmation();
    // Refetch matches to update the status
    const fetchMatches = async () => {
      try {
        const res = await matchService.getUserMatches(userId!, currentPage, filters);
        const matchesData = res.data?.data || [];
        setAllMatches(matchesData);
      } catch (err) {
        console.error('Error refetching matches:', err);
      }
    };
    fetchMatches();
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="auth-container"><p>{t('loading') || 'Loading...'}</p></div>
      </MainLayout>
    );
  }

  const winnerEloChange = (match: any) => (match.winner_elo_after || 0) - (match.winner_elo_before || 0);
  const loserEloChange = (match: any) => (match.loser_elo_after || 0) - (match.loser_elo_before || 0);

  const paginatedMatches = allMatches;

  return (
    <MainLayout>
      <div className="matches-page-content">
        <h1>{t('sidebar.my_matches') || 'My Matches'}</h1>

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
              Page <span className="current-page">{currentPage}</span> of <span className="total-pages">{totalPages}</span>
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

        <div className="filters-section">
          <div className="filter-group">
            <label htmlFor="winner">{t('filter_winner')}</label>
            <input
              type="text"
              id="winner"
              name="winner"
              placeholder={t('filter_by_winner')}
              value={filters.winner}
              onChange={handleFilterChangeWithReset}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="loser">{t('filter_loser')}</label>
            <input
              type="text"
              id="loser"
              name="loser"
              placeholder={t('filter_by_loser')}
              value={filters.loser}
              onChange={handleFilterChangeWithReset}
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
              onChange={handleFilterChangeWithReset}
            />
          </div>

          <div className="filter-group">
            <label htmlFor="status">{t('filter_match_status')}</label>
            <select
              id="status"
              name="status"
              value={filters.status}
              onChange={handleFilterChangeWithReset}
            >
              <option value="">{t('all')}</option>
              <option value="unconfirmed">{t('match_status_unconfirmed')}</option>
              <option value="confirmed">{t('match_status_confirmed')}</option>
              <option value="disputed">{t('match_status_disputed')}</option>
              <option value="cancelled">{t('match_status_cancelled')}</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="confirmed">{t('filter_confirmation_status')}</label>
            <select
              id="confirmed"
              name="confirmed"
              value={filters.confirmed}
              onChange={handleFilterChangeWithReset}
            >
              <option value="">{t('all')}</option>
              <option value="confirmed">{t('match_status_confirmed')}</option>
              <option value="unconfirmed">{t('match_status_unconfirmed')}</option>
              <option value="disputed">{t('match_status_disputed')}</option>
              <option value="cancelled">{t('match_status_cancelled')}</option>
            </select>
          </div>

          <button className="reset-btn" onClick={resetFilters}>{t('reset_filters')}</button>
        </div>

        <div className="matches-info">
          <p>{t('showing_count_matches', { count: paginatedMatches.length, total, page: currentPage, totalPages })}</p>
        </div>

        <div className="games-table-wrapper">
          <MatchesTable 
            matches={paginatedMatches}
            currentPlayerId={userId || undefined}
            onViewDetails={openMatchDetails}
            onOpenConfirmation={openConfirmation}
            onDownloadReplay={handleDownloadReplay}
          />
        </div>

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
              Page <span className="current-page">{currentPage}</span> of <span className="total-pages">{totalPages}</span>
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

        {/* Match Details Modal */}
        <MatchDetailsModal 
          match={matchDetailsModal.match}
          isOpen={matchDetailsModal.isOpen}
          onClose={closeMatchDetails}
        />

        {/* Match Confirmation Modal */}
        {confirmationModal.isOpen && confirmationModal.match && (
          <MatchConfirmationModal
            match={confirmationModal.match}
            currentPlayerId={userId!}
            onClose={closeConfirmation}
            onSubmit={handleConfirmationSuccess}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default MyMatches;
