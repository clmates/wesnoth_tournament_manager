import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playerStatisticsService } from '../services/playerStatisticsService';
import '../styles/PlayerStats.css';

interface RecentOpponent {
  opponent_id: string;
  opponent_name: string;
  total_games: number;
  wins: number;
  losses: number;
  winrate: number;
}

interface Props {
  playerId: string;
  limit?: number;
}

const PlayerRecentOpponents: React.FC<Props> = ({ playerId, limit = 10 }) => {
  const { t } = useTranslation();
  const [opponents, setOpponents] = useState<RecentOpponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOpponents = async () => {
      try {
        setLoading(true);
        const data = await playerStatisticsService.getRecentOpponents(playerId, limit);
        console.log('PlayerRecentOpponents raw data:', data);
        // Convert string numbers to actual numbers
        const converted = data.map((item: any) => ({
          ...item,
          winrate: typeof item.winrate === 'string' ? parseFloat(item.winrate) : item.winrate,
        }));
        console.log('PlayerRecentOpponents converted data:', converted);
        setOpponents(converted);
      } catch (err) {
        console.error('Error fetching recent opponents:', err);
        setError('Error loading recent opponents');
      } finally {
        setLoading(false);
      }
    };

    fetchOpponents();
  }, [playerId, limit]);

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;

  return (
    <div className="player-stats-section">
      <h3>{t('recent_opponents') || 'Recent Opponents'}</h3>
      
      {opponents.length === 0 ? (
        <p className="no-data">{t('no_data')}</p>
      ) : (
        <div className="stats-table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th>{t('player') || 'Player'}</th>
                <th>{t('games') || 'Games'}</th>
                <th>{t('wins') || 'Wins'}</th>
                <th>{t('losses') || 'Losses'}</th>
                <th>{t('winrate') || 'W/R %'}</th>
              </tr>
            </thead>
            <tbody>
              {opponents.map((opponent) => (
                <tr key={opponent.opponent_id}>
                  <td className="opponent-name-cell">{opponent.opponent_name}</td>
                  <td className="centered">{opponent.total_games}</td>
                  <td className="centered winning">{opponent.wins}</td>
                  <td className="centered losing">{opponent.losses}</td>
                  <td className={`centered ${
                    opponent.winrate > 55 ? 'high' : 
                    opponent.winrate < 45 ? 'low' : 
                    'balanced'
                  }`}>
                    {opponent.winrate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlayerRecentOpponents;
