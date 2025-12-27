import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playerStatisticsService } from '../services/playerStatisticsService';
import '../styles/PlayerStats.css';

interface GlobalStats {
  player_id: string;
  player_name: string;
  total_games: number;
  wins: number;
  losses: number;
  winrate: number;
  avg_elo_change: number;
  last_updated: string;
}

interface Props {
  playerId: string;
}

const PlayerStatsOverview: React.FC<Props> = ({ playerId }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await playerStatisticsService.getGlobalStats(playerId);
        setStats(data);
      } catch (err) {
        console.error('Error fetching player stats:', err);
        setError('Error loading player statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [playerId]);

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;
  if (!stats) return <div className="stats-container"><p>{t('no_data')}</p></div>;

  const winrateNum = typeof stats.winrate === 'string' ? parseFloat(stats.winrate) : stats.winrate;
  const eloChangeNum = typeof stats.avg_elo_change === 'string' ? parseFloat(stats.avg_elo_change) : stats.avg_elo_change;

  return (
    <div className="player-overview">
      <h2>{stats.player_name}</h2>
      
      <div className="overview-stats">
        <div className="stat-box">
          <div className="stat-label">{t('total_games') || 'Games'}</div>
          <div className="stat-value">{stats.total_games}</div>
        </div>
        
        <div className="stat-box">
          <div className="stat-label">{t('wins') || 'Wins'}</div>
          <div className="stat-value winning">{stats.wins}</div>
        </div>
        
        <div className="stat-box">
          <div className="stat-label">{t('losses') || 'Losses'}</div>
          <div className="stat-value losing">{stats.losses}</div>
        </div>
        
        <div className="stat-box">
          <div className="stat-label">{t('winrate') || 'Win Rate'}</div>
          <div className={`stat-value ${winrateNum > 55 ? 'winning' : winrateNum < 45 ? 'losing' : 'balanced'}`}>
            {winrateNum.toFixed(1)}%
          </div>
        </div>
        
        <div className="stat-box">
          <div className="stat-label">{t('avg_elo_change') || 'Avg ELO/Game'}</div>
          <div className={`stat-value ${eloChangeNum > 0 ? 'winning' : eloChangeNum < 0 ? 'losing' : 'balanced'}`}>
            {eloChangeNum > 0 ? '+' : ''}{eloChangeNum.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${winrateNum}%` }}
        ></div>
      </div>
    </div>
  );
};

export default PlayerStatsOverview;
