import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playerStatisticsService } from '../services/playerStatisticsService';

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
        console.log('PlayerStatsOverview raw data:', data);
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

  if (loading) return <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-md"><p className="text-gray-600">{t('loading')}</p></div>;
  if (error) return <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-md border border-red-200"><p className="text-red-600">{error}</p></div>;
  if (!stats) return <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-md"><p className="text-gray-600">{t('no_data')}</p></div>;

  const winrateNum = typeof stats.winrate === 'string' ? parseFloat(stats.winrate) : stats.winrate;
  const eloChangeNum = typeof stats.avg_elo_change === 'string' ? parseFloat(stats.avg_elo_change) : stats.avg_elo_change;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-8">{stats.player_name}</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-sm font-semibold text-gray-600 mb-3">{t('total_games') || 'Games'}</div>
          <div className="text-3xl font-bold text-gray-800">{stats.total_games}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-sm font-semibold text-gray-600 mb-3">{t('wins') || 'Wins'}</div>
          <div className="text-3xl font-bold text-green-600">{stats.wins}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-sm font-semibold text-gray-600 mb-3">{t('losses') || 'Losses'}</div>
          <div className="text-3xl font-bold text-red-600">{stats.losses}</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-sm font-semibold text-gray-600 mb-3">{t('winrate') || 'Win Rate'}</div>
          <div className={`text-3xl font-bold ${winrateNum > 55 ? 'text-green-600' : winrateNum < 45 ? 'text-red-600' : 'text-gray-600'}`}>
            {winrateNum.toFixed(1)}%
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-sm font-semibold text-gray-600 mb-3">{t('avg_elo_change') || 'Avg ELO/Game'}</div>
          <div className={`text-3xl font-bold ${eloChangeNum > 0 ? 'text-green-600' : eloChangeNum < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {eloChangeNum > 0 ? '+' : ''}{eloChangeNum.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div 
            className="bg-blue-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${winrateNum}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default PlayerStatsOverview;
