import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MatchesTable from './MatchesTable';
import MatchConfirmationModal from './MatchConfirmationModal';
import { matchService } from '../services/api';
import { useAuthStore } from '../store/authStore';

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
      if (!replayFilePath) return;
      
      // Extract filename from path
      const filename = replayFilePath.split('/').pop() || `replay_${matchId}`;
      
      // Increment download count in the database
      await matchService.incrementReplayDownloads(matchId);
      
      // Refresh the matches to show updated download count
      if (onMatchConfirmed) {
        onMatchConfirmed();
      }
      
      // Use the replay_file_path HTTPS URL directly
      if (import.meta.env.VITE_DEBUG_LOGS === 'true') console.log('🔽 Downloading from:', replayFilePath);
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = replayFilePath;
      link.download = filename;
      link.target = '_blank';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      if (import.meta.env.VITE_DEBUG_LOGS === 'true') console.log('✅ Download started:', filename);
    } catch (err) {
      console.error('Error downloading replay:', err);
    }
  };

  if (!matches || matches.length === 0) {
    return <div className="text-center text-gray-500 italic py-8">{t('recent_games_no_data') || 'No recent games'}</div>;
  }

  return (
    <>
      <div className="max-w-6xl mx-auto p-6">
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
