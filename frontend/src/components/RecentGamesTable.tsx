import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { matchService } from '../services/api';
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
        
        <div className="games-table-wrapper">
          <table className="games-table">
            <thead>
              <tr>
                <th>{t('label_date')}</th>
                <th>{t('label_winner')}</th>
                <th>{t('label_winner_rating')}</th>
                <th>{t('label_loser')}</th>
                <th>{t('label_loser_rating')}</th>
                <th>{t('label_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => {
                const isCurrentPlayerWinner = match.winner_id === currentPlayerId;
                const winnerEloChange = (match.winner_elo_after || 0) - (match.winner_elo_before || 0);
                const loserEloChange = (match.loser_elo_after || 0) - (match.loser_elo_before || 0);

                return (
                  <tr key={match.id} className={`game-row ${isCurrentPlayerWinner ? 'winner-row' : 'loser-row'}`}>
                    <td className="date-col">
                      {new Date(match.created_at).toLocaleDateString()}
                    </td>
                    
                    <td className="winner-col">
                      <div className="player-info">
                        <span className="player-name">{match.winner_nickname}</span>
                        <span className="faction-badge winner-faction">{match.winner_faction}</span>
                      </div>
                    </td>
                    
                    <td className="rating-col">
                      <div className="rating-block">
                        <div className="rating-value">{match.winner_elo_before || 'N/A'}</div>
                        <div className={`rating-change ${winnerEloChange >= 0 ? 'positive' : 'negative'}`}>
                          ({winnerEloChange >= 0 ? '+' : ''}{winnerEloChange})
                        </div>
                      </div>
                    </td>
                    
                    <td className="loser-col">
                      <div className="player-info">
                        <span className="player-name">{match.loser_nickname}</span>
                        <span className="faction-badge loser-faction">{match.loser_faction}</span>
                      </div>
                    </td>
                    
                    <td className="rating-col">
                      <div className="rating-block">
                        <div className="rating-value">{match.loser_elo_before || 'N/A'}</div>
                        <div className={`rating-change ${loserEloChange >= 0 ? 'positive' : 'negative'}`}>
                          ({loserEloChange >= 0 ? '+' : ''}{loserEloChange})
                        </div>
                      </div>
                    </td>
                    
                    <td className="action-col">
                      <div className="action-buttons">
                        {match.replay_file_path && (
                          <button 
                            className="download-btn"
                            onClick={() => handleDownloadReplay(match.id, match.replay_file_path)}
                            title={`${t('downloads')}: ${match.replay_downloads || 0}`}
                          >
                            ⬇️
                          </button>
                        )}
                        {!isCurrentPlayerWinner && match.status === 'unconfirmed' ? (
                          <button 
                            className="report-btn"
                            onClick={() => handleReportClick(match)}
                          >
                            {t('report')}
                          </button>
                        ) : (
                          <span className={`status-badge badge-${match.status || 'unconfirmed'}`}>
                            {match.status === 'confirmed' && '✓'}
                            {match.status === 'disputed' && '⚠'}
                            {match.status === 'unconfirmed' && '⏳'}
                            {match.status === 'cancelled' && '✗'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
