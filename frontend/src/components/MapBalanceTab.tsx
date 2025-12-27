import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';
import '../styles/BalanceStatistics.css';

interface MapBalanceStats {
  map_id: string;
  map_name: string;
  total_games: number;
  factions_used: number;
  avg_imbalance: number;
  lowest_winrate: number;
  highest_winrate: number;
}

const MapBalanceTab: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<MapBalanceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await statisticsService.getMapBalanceStats();
        // Convert string numbers to actual numbers
        const converted = data.map((item: any) => ({
          ...item,
          avg_imbalance: typeof item.avg_imbalance === 'string' ? parseFloat(item.avg_imbalance) : item.avg_imbalance,
          lowest_winrate: typeof item.lowest_winrate === 'string' ? parseFloat(item.lowest_winrate) : item.lowest_winrate,
          highest_winrate: typeof item.highest_winrate === 'string' ? parseFloat(item.highest_winrate) : item.highest_winrate,
        }));
        setStats(converted);
      } catch (err) {
        console.error('Error fetching map balance stats:', err);
        setError('Error loading map statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;

  return (
    <div className="balance-stats">
      <h3>{t('map_balance_title') || 'Map Balance Analysis'}</h3>
      <p className="stats-info">{t('balance_lower_better') || '(Lower imbalance = better balance)'}</p>
      
      <div className="stats-table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>{t('map') || 'Map'}</th>
              <th>{t('total_games') || 'Games'}</th>
              <th>{t('factions_used') || 'Factions'}</th>
              <th>{t('avg_imbalance') || 'Avg Imbalance'}</th>
              <th>{t('winrate_range') || 'WR Range'}</th>
              <th>{t('balance_indicator') || 'Balance'}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.map_id}>
                <td className="map-name">{stat.map_name}</td>
                <td>{stat.total_games}</td>
                <td>{stat.factions_used}</td>
                <td>
                  <span className={`imbalance ${
                    stat.avg_imbalance < 5 ? 'excellent' : 
                    stat.avg_imbalance < 10 ? 'good' : 
                    'needs-balance'
                  }`}>
                    {stat.avg_imbalance.toFixed(1)}%
                  </span>
                </td>
                <td>{stat.lowest_winrate.toFixed(1)}% - {stat.highest_winrate.toFixed(1)}%</td>
                <td>
                  <div className="balance-bar">
                    <div 
                      className="imbalance-fill"
                      style={{ width: `${Math.min(stat.avg_imbalance * 2, 100)}%` }}
                    ></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MapBalanceTab;
