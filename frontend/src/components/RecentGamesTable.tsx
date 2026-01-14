import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MatchesTable from './MatchesTable';
import MatchConfirmationModal from './MatchConfirmationModal';
import { matchService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import '../styles/RecentGamesTable.css';

// Get API URL for direct backend calls
let API_URL: string;
if (window.location.hostname === 'main.wesnoth-tournament-manager.pages.dev') {
  API_URL = 'https://wesnothtournamentmanager-main.up.railway.app/api';
} else if (window.location.hostname === 'wesnoth-tournament-manager.pages.dev') {
  API_URL = 'https://wesnothtournamentmanager-production.up.railway.app/api';
} else if (window.location.hostname.includes('wesnoth-tournament-manager.pages.dev')) {
  API_URL = 'https://wesnothtournamentmanager-wesnothtournamentmanager-pr-1.up.railway.app/api';
} else {
  API_URL = '/api';
}

interface RecentGamesTableProps {
  matches: any[];
  currentPlayerId: string;
  onDownloadReplay?: (matchId: string, filename: string) => void;
  onMatchConfirmed?: () => void;
  onViewDetails?: (match: any) => void;
}

const RecentGamesTable: React.FC<RecentGamesTableProps> = ({ matches, currentPlayerId, onDownloadReplay, onMatchConfirmed, onViewDetails }) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  const handleReportClick = (match: any) => {
    if (isAuthenticated) {
      setSelectedMatch(match);
    }
  };

  const handleDetailsClick = (match: any) => {
    if (import.meta.env.VITE_DEBUG_LOGS === 'true') {
      console.log('handleDetailsClick called with match:', match);
      console.log('onViewDetails callback:', onViewDetails);
    }
    if (onViewDetails) {
      onViewDetails(match);
    } else {
      console.warn('onViewDetails callback not provided to RecentGamesTable');
    }
  };

  const handleCloseModal = () => {
    setSelectedMatch(null);
  };

  const handleModalSubmit = () => {
    handleCloseModal();
    if (onMatchConfirmed) {
      onMatchConfirmed();
    }
  };

  const handleDownloadReplay = async (matchId: string, replayFilePath: string) => {
    try {
      // Increment download count in the database
      await matchService.incrementReplayDownloads(matchId);
      
      // Refresh the matches to show updated download count
      if (onMatchConfirmed) {
        onMatchConfirmed();
      }
      
      // Fetch signed URL from the backend
      if (import.meta.env.VITE_DEBUG_LOGS === 'true') console.log('🔽 Fetching signed URL from backend...');
      const downloadUrl = `${API_URL}/matches/${matchId}/replay/download`;
      if (import.meta.env.VITE_DEBUG_LOGS === 'true') console.log('🔽 Download URL:', downloadUrl);
      const response = await fetch(downloadUrl, {
        method: 'GET'
      });

      if (import.meta.env.VITE_DEBUG_LOGS === 'true') console.log('🔽 Response status:', response.status);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      // Get signed URL from response and redirect
      if (import.meta.env.VITE_DEBUG_LOGS === 'true') console.log('🔽 Getting signed URL...');
      const { signedUrl, filename } = await response.json();
      if (import.meta.env.VITE_DEBUG_LOGS === 'true') console.log('🔽 Redirecting to signed URL:', signedUrl);
      window.location.href = signedUrl;
    } catch (err) {
      console.error('Error downloading replay:', err);
    }
  };

  if (!matches || matches.length === 0) {
    return <div className="no-games-message">{t('recent_games_no_data') || 'No recent games'}</div>;
  }

  return (
    <>
      <div className="recent-games-container">
        <h2>{t('recent_games')}</h2>
        <MatchesTable 
          matches={matches}
          currentPlayerId={currentPlayerId}
          onViewDetails={handleDetailsClick}
          onOpenConfirmation={handleReportClick}
          onDownloadReplay={handleDownloadReplay}
        />
      </div>

      {selectedMatch && (
        <MatchConfirmationModal
          match={selectedMatch}
          currentPlayerId={currentPlayerId}
          onClose={handleCloseModal}
          onSubmit={handleModalSubmit}
        />
      )}
    </>
  );
};

export default RecentGamesTable;
