import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';
import '../styles/BalanceStatistics.css';

interface FactionStats {
  faction_id: string;
  faction_name: string;
  total_games: number;
  global_winrate: number;
  maps_played: number;
}

const FactionBalanceTab: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<FactionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await statisticsService.getGlobalFactionStats();
        // Convert string winrates to numbers
        const converted = data.map((item: any) => ({
          ...item,
          global_winrate: typeof item.global_winrate === 'string' ? parseFloat(item.global_winrate) : item.global_winrate,
        }));
        setStats(converted);
      } catch (err) {
        console.error('Error fetching faction balance stats:', err);
        setError('Error loading faction statistics');
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
      <h3>{t('faction_balance_title') || 'Global Faction Balance'}</h3>
      <p className="explanation">{t('faction_balance_explanation') || 'Detailed analysis of faction balance across all tournaments'}</p>
      <div className="stats-table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>{t('faction') || 'Faction'}</th>
              <th>{t('total_games') || 'Games'}</th>
              <th>{t('winrate') || 'Win Rate'}</th>
              <th>{t('maps_played') || 'Maps'}</th>
              <th>{t('balance_indicator') || 'Balance'}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.faction_id}>
                <td className="faction-name">{stat.faction_name}</td>
                <td>{stat.total_games}</td>
                <td>
                  <span className={`winrate ${
                    stat.global_winrate > 55 ? 'high' : 
                    stat.global_winrate < 45 ? 'low' : 
                    'balanced'
                  }`}>
                    {stat.global_winrate.toFixed(1)}%
                  </span>
                </td>
                <td>{stat.maps_played}</td>
                <td>
                  <div className="balance-bar">
                    <div 
                      className="balance-fill"
                      style={{ width: `${stat.global_winrate}%` }}
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

export default FactionBalanceTab;
