import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playerStatisticsService } from '../services/playerStatisticsService';

interface MapStats {
  map_id: string;
  map_name: string;
  total_games: number;
  wins: number;
  losses: number;
  winrate: number;
  avg_elo_change: number;
}

interface Props {
  playerId: string;
}

const PlayerStatsByMap: React.FC<Props> = ({ playerId }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<MapStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minGames, setMinGames] = useState(2);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await playerStatisticsService.getStatsByMap(playerId, minGames);
        console.log('PlayerStatsByMap raw data:', data);
        // Convert string numbers to actual numbers
        const converted = data.map((item: any) => ({
          ...item,
          winrate: typeof item.winrate === 'string' ? parseFloat(item.winrate) : item.winrate,
          avg_elo_change: typeof item.avg_elo_change === 'string' ? parseFloat(item.avg_elo_change) : item.avg_elo_change,
        }));
        console.log('PlayerStatsByMap converted data:', converted);
        setStats(converted);
      } catch (err) {
        console.error('Error fetching map stats:', err);
        setError('Error loading map statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [playerId, minGames]);

  if (loading) return <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-md"><p className="text-gray-600">{t('loading')}</p></div>;
  if (error) return <div className="max-w-4xl mx-auto p-8 bg-white rounded-lg shadow-md border border-red-200"><p className="text-red-600">{error}</p></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h3 className="text-2xl font-semibold text-gray-800 mb-4">{t('performance_by_map') || 'Performance by Map'}</h3>
      <p className="text-gray-600 text-sm mb-6">{t('performance_by_map_explanation') || 'Your win rate and ELO change on each map'}</p>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <label>
          {t('minimum_games') || 'Minimum Games'}:
          <input 
            type="number" 
            min="1" 
            max="100" 
            value={minGames}
            onChange={(e) => setMinGames(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </label>
      </div>

      {stats.length === 0 ? (
        <p className="text-center text-gray-500 italic py-8">{t('no_data')}</p>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th>{t('map') || 'Map'}</th>
                <th>{t('total_games') || 'Games'}</th>
                <th>{t('record') || 'Record'}</th>
                <th>{t('winrate') || 'Win Rate'}</th>
                <th>{t('avg_elo_change') || 'Avg ELO'}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.map_id}>
                  <td className="px-4 py-3 font-semibold text-gray-700">{stat.map_name}</td>
                  <td>{stat.total_games}</td>
                  <td>
                    <span className="flex gap-3 justify-center">
                      <span className="text-green-600 font-semibold">{stat.wins}W</span>
                      <span className="text-red-600 font-semibold">{stat.losses}L</span>
                    </span>
                  </td>
                  <td>
                    <span className={`font-semibold ${
                      stat.winrate > 55 ? 'text-green-600' : 
                      stat.winrate < 45 ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {stat.winrate.toFixed(1)}%
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${stat.avg_elo_change > 0 ? 'text-green-600' : stat.avg_elo_change < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {stat.avg_elo_change > 0 ? '+' : ''}{stat.avg_elo_change.toFixed(1)}
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

export default PlayerStatsByMap;
