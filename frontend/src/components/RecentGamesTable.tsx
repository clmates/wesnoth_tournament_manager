import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MatchesTable from './MatchesTable';
import MatchConfirmationModal from './MatchConfirmationModal';
import { useAuthStore } from '../store/authStore';

interface RecentGamesTableProps {
  matches: any[];
  currentPlayerId: string;
  onMatchConfirmed?: () => void;
  onViewDetails?: (match: any) => void;
}

const RecentGamesTable: React.FC<RecentGamesTableProps> = ({ matches, currentPlayerId, onMatchConfirmed, onViewDetails }) => {
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
