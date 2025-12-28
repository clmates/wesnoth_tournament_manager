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
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            backgroundColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#333', fontSize: '0.9em' }}>
                  {t('player') || 'Player'}
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#333', fontSize: '0.9em' }}>
                  {t('games') || 'Games'}
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#333', fontSize: '0.9em' }}>
                  {t('wins') || 'Wins'}
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#333', fontSize: '0.9em' }}>
                  {t('losses') || 'Losses'}
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#333', fontSize: '0.9em' }}>
                  {t('winrate') || 'W/R %'}
                </th>
              </tr>
            </thead>
            <tbody>
              {opponents.map((opponent) => (
                <tr 
                  key={opponent.opponent_id}
                  style={{
                    borderBottom: '1px solid #e0e0e0',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1a73e8' }}>
                    {opponent.opponent_name}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500' }}>
                    {opponent.total_games}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#4caf50' }}>
                    {opponent.wins}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '500', color: '#f44336' }}>
                    {opponent.losses}
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: opponent.winrate > 55 ? '#4caf50' : opponent.winrate < 45 ? '#f44336' : '#ff9800'
                  }}>
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
