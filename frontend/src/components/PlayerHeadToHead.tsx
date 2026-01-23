import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playerStatisticsService } from '../services/playerStatisticsService';

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

  if (loading) return <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-md"><p className="text-gray-600">{t('loading')}</p></div>;
  if (error) return <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-md border border-red-200"><p className="text-red-600">{error}</p></div>;
  if (!stats) return <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-md"><p className="text-gray-600">{t('no_data')}</p></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h3 className="text-2xl font-semibold text-gray-800 mb-8">{t('head_to_head') || 'Head to Head'} vs {opponentName}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 text-center md:col-span-2">
          <div className="text-sm font-semibold text-gray-600 mb-3">{t('total_games') || 'Total Games'}</div>
          <div className="text-3xl font-bold text-gray-800">{stats.total_games}</div>

        
        <div className="bg-green-50 rounded-lg shadow-md p-6 text-center">
          <div className="text-sm font-semibold text-gray-600 mb-3">{t('wins') || 'Wins'}</div>
          <div className="text-3xl font-bold text-green-600">{stats.wins}</div>
        </div>

        <div className="bg-red-50 rounded-lg shadow-md p-6 text-center">
          <div className="text-sm font-semibold text-gray-600 mb-3">{t('losses') || 'Losses'}</div>
          <div className="text-3xl font-bold text-red-600">{stats.losses}</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-sm font-semibold text-gray-600 mb-3">{t('winrate') || 'Win Rate'}</div>
          <div className={`text-3xl font-bold ${
            stats.winrate > 55 ? 'text-green-600' : 
            stats.winrate < 45 ? 'text-red-600' : 
            'text-gray-600'
          }`}>
            {stats.winrate.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-sm font-semibold text-gray-600 mb-3">{t('avg_elo_change') || 'Avg ELO/Game'}</div>
          <div className={`text-3xl font-bold ${stats.avg_elo_change > 0 ? 'text-green-600' : stats.avg_elo_change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
            {stats.avg_elo_change > 0 ? '+' : ''}{stats.avg_elo_change.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerHeadToHead;
