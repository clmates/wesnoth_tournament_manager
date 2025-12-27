import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playerStatisticsService } from '../services/playerStatisticsService';
import '../styles/PlayerStats.css';

interface HeadToHeadStats {
  opponent_id: string;
  opponent_name: string;
  total_games: number;
  wins: number;
  losses: number;
  winrate: number;
  avg_elo_change: number;
}

interface Props {
  playerId: string;
  opponentId: string;
  opponentName?: string;
}

const PlayerHeadToHead: React.FC<Props> = ({ playerId, opponentId, opponentName }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<HeadToHeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await playerStatisticsService.getHeadToHead(playerId, opponentId);
        
        if (data && data.length > 0) {
          const converted = {
            ...data[0],
            winrate: typeof data[0].winrate === 'string' ? parseFloat(data[0].winrate) : data[0].winrate,
            avg_elo_change: typeof data[0].avg_elo_change === 'string' ? parseFloat(data[0].avg_elo_change) : data[0].avg_elo_change,
          };
          setStats(converted);
        } else {
          setError('No matches found between these players');
        }
      } catch (err) {
        console.error('Error fetching head-to-head stats:', err);
        setError('Error loading head-to-head statistics');
      } finally {
        setLoading(false);
      }
    };

    if (opponentId) {
      fetchStats();
    }
  }, [playerId, opponentId]);

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;
  if (!stats) return <div className="stats-container"><p>{t('no_data')}</p></div>;

  return (
    <div className="player-stats-section">
      <h3>{t('head_to_head') || 'Head to Head'} vs {opponentName}</h3>
      
      <div className="h2h-stats">
        <div className="h2h-stat-box">
          <div className="h2h-label">{t('total_games') || 'Total Games'}</div>
          <div className="h2h-value">{stats.total_games}</div>
        </div>

        <div className="h2h-record">
          <div className="h2h-stat-box winning">
            <div className="h2h-label">{t('wins') || 'Wins'}</div>
            <div className="h2h-value">{stats.wins}</div>
          </div>
          <div className="h2h-vs">vs</div>
          <div className="h2h-stat-box losing">
            <div className="h2h-label">{t('losses') || 'Losses'}</div>
            <div className="h2h-value">{stats.losses}</div>
          </div>
        </div>

        <div className="h2h-stat-box">
          <div className="h2h-label">{t('winrate') || 'Win Rate'}</div>
          <div className={`h2h-value ${
            stats.winrate > 55 ? 'high' : 
            stats.winrate < 45 ? 'low' : 
            'balanced'
          }`}>
            {stats.winrate.toFixed(1)}%
          </div>
        </div>

        <div className="h2h-stat-box">
          <div className="h2h-label">{t('avg_elo_change') || 'Avg ELO/Game'}</div>
          <div className={`h2h-value ${stats.avg_elo_change > 0 ? 'winning' : stats.avg_elo_change < 0 ? 'losing' : ''}`}>
            {stats.avg_elo_change > 0 ? '+' : ''}{stats.avg_elo_change.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerHeadToHead;
