import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { publicService, matchService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import MatchesTable from '../components/MatchesTable';
import MatchConfirmationModal from '../components/MatchConfirmationModal';
import '../styles/Matches.css';

// Get API URL for direct backend calls
let API_URL: string;
if (import.meta.env.VITE_API_URL) {
  API_URL = import.meta.env.VITE_API_URL;
} else if (window.location.hostname.includes('main.')) {
  API_URL = 'https://wesnothtournamentmanager-main.up.railway.app/api';
} else if (window.location.hostname.includes('wesnoth-tournament-manager.pages.dev')) {
  API_URL = 'https://wesnothtournamentmanager-production.up.railway.app/api';
} else {
  API_URL = '/api';
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

const Matches: React.FC = () => {
  const { t } = useTranslation();
  const { userId } = useAuthStore();
  
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
    // Always fetch from server with current page and filters
    const fetchMatches = async () => {
      try {
        console.log('Fetching matches for page:', currentPage, 'with filters:', filters);
        const res = await publicService.getAllMatches(currentPage, filters);
        console.log('Full response:', res);
        console.log('Response data:', res.data);
        
        // res.data contains {data: [...], pagination: {...}}
        const matchesData = res.data?.data || [];
        console.log('Matches data:', matchesData);
        
        setAllMatches(matchesData);
        
        // Set pagination info
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

    fetchMatches();
  }, [currentPage, filters]);

  // Reset to page 1 when filters change
  const handleFilterChangeWithReset = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
    // Reset to page 1 when filters change
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
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDownloadReplay = async (matchId: string, replayFilePath: string) => {
    try {
      console.log('🔽 Starting download for match:', matchId);
      // Extract filename from path
      const filename = replayFilePath.split('/').pop() || `replay_${matchId}`;
      
      // Increment download count in the database
      console.log('🔽 Incrementing download count...');
      await matchService.incrementReplayDownloads(matchId);
      
      // Fetch the file from the backend
      console.log('🔽 Fetching file from backend...');
      const token = localStorage.getItem('token');
      const downloadUrl = `${API_URL}/matches/${matchId}/replay/download`;
      console.log('🔽 Download URL:', downloadUrl);
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('🔽 Response status:', response.status);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      // Create blob and download
      console.log('🔽 Creating blob...');
      const blob = await response.blob();
      console.log('🔽 Blob size:', blob.size, 'bytes');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      console.log('✅ Download completed:', filename);
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
  };

  if (loading) {
    return <div className="auth-container"><p>{t('loading') || 'Loading...'}</p></div>;
  }

  const winnerEloChange = (match: any) => (match.winner_elo_after || 0) - (match.winner_elo_before || 0);
  const loserEloChange = (match: any) => (match.loser_elo_after || 0) - (match.loser_elo_before || 0);

  // Server already handles filtering and pagination
  const paginatedMatches = allMatches;

  return (
    <div className="matches-page-content">
      <h1>{t('matches_all_matches')}</h1>

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
      {matchDetailsModal.isOpen && matchDetailsModal.match && (
        <div className="modal-overlay" onClick={closeMatchDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Match Details</h2>
              <button className="close-btn" onClick={closeMatchDetails}>✕</button>
            </div>

            <div className="modal-body">
              <div className="match-details-container">
                {/* Row 1: Date, Map, Status */}
                <div className="detail-header-row">
                  <div className="detail-item">
                    <label>Date:</label>
                    <span>{new Date(matchDetailsModal.match.created_at).toLocaleString()}</span>
                  </div>
                  <div className="detail-item">
                    <label>Map:</label>
                    <span>{matchDetailsModal.match.map}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    <span className={`status-badge ${matchDetailsModal.match.status || 'unconfirmed'}`}>
                      {matchDetailsModal.match.status === 'confirmed' && '✓ Confirmed'}
                      {matchDetailsModal.match.status === 'unconfirmed' && '⏳ Unconfirmed'}
                      {matchDetailsModal.match.status === 'disputed' && '⚠ Disputed'}
                      {matchDetailsModal.match.status === 'cancelled' && '✗ Cancelled'}
                      {!matchDetailsModal.match.status && '⏳ Unconfirmed'}
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="match-stats-grid">
                  <div className="grid-header label-col">Statistic</div>
                  <div className="grid-header winner-col">Winner</div>
                  <div className="grid-header loser-col">Loser</div>

                  <div className="grid-cell label-cell">Player</div>
                  <div className="grid-cell winner-cell">{matchDetailsModal.match.winner_nickname}</div>
                  <div className="grid-cell loser-cell">{matchDetailsModal.match.loser_nickname}</div>

                  <div className="grid-cell label-cell">Faction</div>
                  <div className="grid-cell winner-cell"><span className="faction-badge">{matchDetailsModal.match.winner_faction}</span></div>
                  <div className="grid-cell loser-cell"><span className="faction-badge">{matchDetailsModal.match.loser_faction}</span></div>

                  <div className="grid-cell label-cell">Rating</div>
                  <div className="grid-cell winner-cell">{matchDetailsModal.match.winner_rating || '-'}</div>
                  <div className="grid-cell loser-cell">{matchDetailsModal.match.loser_rating || '-'}</div>

                  <div className="grid-cell label-cell">ELO Before</div>
                  <div className="grid-cell winner-cell">{matchDetailsModal.match.winner_elo_before || 'N/A'}</div>
                  <div className="grid-cell loser-cell">{matchDetailsModal.match.loser_elo_before || 'N/A'}</div>

                  <div className="grid-cell label-cell">ELO After</div>
                  <div className="grid-cell winner-cell">{matchDetailsModal.match.winner_elo_after || 'N/A'}</div>
                  <div className="grid-cell loser-cell">{matchDetailsModal.match.loser_elo_after || 'N/A'}</div>

                  <div className="grid-cell label-cell">ELO Change</div>
                  <div className="grid-cell winner-cell">
                    <span className={`rating-change ${winnerEloChange(matchDetailsModal.match) >= 0 ? 'positive' : 'negative'}`}>
                      {winnerEloChange(matchDetailsModal.match) >= 0 ? '+' : ''}{winnerEloChange(matchDetailsModal.match)}
                    </span>
                  </div>
                  <div className="grid-cell loser-cell">
                    <span className={`rating-change ${loserEloChange(matchDetailsModal.match) >= 0 ? 'positive' : 'negative'}`}>
                      {loserEloChange(matchDetailsModal.match) >= 0 ? '+' : ''}{loserEloChange(matchDetailsModal.match)}
                    </span>
                  </div>

                  {(matchDetailsModal.match.winner_comments || matchDetailsModal.match.loser_comments) && (
                    <>
                      <div className="grid-cell label-cell">Comments</div>
                      <div className="grid-cell winner-cell" title={matchDetailsModal.match.winner_comments || undefined}>{matchDetailsModal.match.winner_comments || '-'}</div>
                      <div className="grid-cell loser-cell" title={matchDetailsModal.match.loser_comments || undefined}>{matchDetailsModal.match.loser_comments || '-'}</div>
                    </>
                  )}

                  {matchDetailsModal.match.replay_file_path && (
                    <>
                      <div className="grid-cell label-cell">Replay</div>
                      <div className="grid-cell" style={{ gridColumn: '2 / 4' }}>
                        <button 
                          className="download-btn-compact"
                          onClick={() => {
                            handleDownloadReplay(matchDetailsModal.match.id, matchDetailsModal.match.replay_file_path);
                            closeMatchDetails();
                          }}
                          title={`Downloads: ${matchDetailsModal.match.replay_downloads || 0}`}
                        >
                          ⬇️ Download ({matchDetailsModal.match.replay_downloads || 0})
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="close-modal-btn" onClick={closeMatchDetails}>Close</button>
            </div>
          </div>
        </div>
      )}

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
  );
};

export default Matches;
