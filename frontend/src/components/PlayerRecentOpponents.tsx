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
  winrate: number | string;
  current_elo: number;
  elo_gained: number | string;
  elo_lost: number | string;
  last_elo_against_me: number | string;
  last_match_date: string;
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
        console.log('Data length:', data?.length);
        console.log('Data is array:', Array.isArray(data));
        // Convert string numbers to actual numbers
        const converted = data.map((item: any) => ({
          ...item,
          winrate: typeof item.winrate === 'string' ? parseFloat(item.winrate) : item.winrate,
          total_games: typeof item.total_games === 'string' ? parseInt(item.total_games) : item.total_games,
          wins: typeof item.wins === 'string' ? parseInt(item.wins) : item.wins,
          losses: typeof item.losses === 'string' ? parseInt(item.losses) : item.losses,
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

  console.log('Rendering PlayerRecentOpponents with opponents:', opponents);
  console.log('Loading:', loading, 'Error:', error);

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;

  return (
    <div style={{ width: '100%', padding: '20px 0' }}>
      <h3 style={{ marginBottom: '20px' }}>{t('recent_opponents') || 'Recent Opponents'}</h3>
      
      {opponents.length === 0 ? (
        <p style={{ color: '#999', fontStyle: 'italic' }}>{t('no_data') || 'No data available'}</p>
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
                <th>ELO Gained</th>
                <th>ELO Lost</th>
              </tr>
            </thead>
            <tbody>
              {opponents.map((opponent) => (
                <tr key={opponent.opponent_id}>
                  <td className="opponent-name">
                    {opponent.opponent_name}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {opponent.total_games}
                  </td>
                  <td className="winning" style={{ textAlign: 'center' }}>
                    {opponent.wins}
                  </td>
                  <td className="losing" style={{ textAlign: 'center' }}>
                    {opponent.losses}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`winrate ${
                      typeof opponent.winrate === 'number' 
                        ? (opponent.winrate > 55 ? 'high' : opponent.winrate < 45 ? 'low' : 'balanced')
                        : (parseFloat(opponent.winrate as string) > 55 ? 'high' : parseFloat(opponent.winrate as string) < 45 ? 'low' : 'balanced')
                    }`}>
                      {typeof opponent.winrate === 'number' 
                        ? opponent.winrate.toFixed(1)
                        : parseFloat(opponent.winrate as string).toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', color: '#4caf50', fontWeight: '600' }}>
                    +{typeof opponent.elo_gained === 'number' 
                      ? opponent.elo_gained.toFixed(2)
                      : parseFloat(opponent.elo_gained as string).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center', color: '#f44336', fontWeight: '600' }}>
                    -{typeof opponent.elo_lost === 'number' 
                      ? opponent.elo_lost.toFixed(2)
                      : parseFloat(opponent.elo_lost as string).toFixed(2)}
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
