import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MatchesTable from './MatchesTable';
import MatchConfirmationModal from './MatchConfirmationModal';
import '../styles/RecentGamesTable.css';

interface RecentGamesTableProps {
  matches: any[];
  currentPlayerId: string;
  onDownloadReplay?: (matchId: string, filename: string) => void;
  onMatchConfirmed?: () => void;
}

const RecentGamesTable: React.FC<RecentGamesTableProps> = ({ matches, currentPlayerId, onDownloadReplay, onMatchConfirmed }) => {
  const { t } = useTranslation();
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);

  const handleReportClick = (match: any) => {
    setSelectedMatch(match);
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
      // Extract filename from path
      const filename = replayFilePath.split('/').pop() || `replay_${matchId}`;
      
      // Increment download count in the database
      await matchService.incrementReplayDownloads(matchId);
      
      // Refresh the matches to show updated download count
      if (onMatchConfirmed) {
        onMatchConfirmed();
      }
      
      // Construct the download URL
      const downloadUrl = `/api/matches/${matchId}/replay/download`;
      
      // Create a temporary link and trigger download
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
          onViewDetails={handleReportClick}
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
