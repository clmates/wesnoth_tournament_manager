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
        // Convert string numbers to actual numbers
        const converted = data.map((item: any) => ({
          ...item,
          winrate: typeof item.winrate === 'string' ? parseFloat(item.winrate) : item.winrate,
        }));
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
        <div className="opponents-grid">
          {opponents.map((opponent) => (
            <div key={opponent.opponent_id} className="opponent-card">
              <div className="opponent-name">{opponent.opponent_name}</div>
              <div className="opponent-stats">
                <div className="stat">
                  <span className="label">{t('games') || 'Games'}:</span>
                  <span className="value">{opponent.total_games}</span>
                </div>
                <div className="stat">
                  <span className="label">{t('record') || 'Record'}:</span>
                  <span className="value">
                    <span className="winning">{opponent.wins}W</span>
                    <span className="losing">{opponent.losses}L</span>
                  </span>
                </div>
                <div className="stat">
                  <span className="label">{t('winrate') || 'W/R'}:</span>
                  <span className={`value ${
                    opponent.winrate > 55 ? 'high' : 
                    opponent.winrate < 45 ? 'low' : 
                    'balanced'
                  }`}>
                    {opponent.winrate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlayerRecentOpponents;
