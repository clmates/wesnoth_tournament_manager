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

interface ComparisonData {
  map_id?: string;
  map_name?: string;
  faction_id?: string;
  faction_name?: string;
  opponent_faction_id?: string;
  opponent_faction_name?: string;
  winrate: number;
  total_games: number;
  wins: number;
  losses: number;
}

interface FactionBalanceTabProps {
  beforeData?: ComparisonData[] | null;
  afterData?: ComparisonData[] | null;
}

const FactionBalanceTab: React.FC<FactionBalanceTabProps> = ({ beforeData = null, afterData = null }) => {
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

    // Only fetch global stats if not in comparison mode
    if (!beforeData && !afterData) {
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [beforeData, afterData]);

  const getWinrateColorClass = (winrate: number) => {
    if (winrate > 55) return 'high';
    if (winrate < 45) return 'low';
    return 'balanced';
  };

  const aggregateFactionData = (data: ComparisonData[]) => {
    const aggregated = new Map<string, { wins: number; losses: number; total: number; faction_name: string }>();
    
    data.forEach(item => {
      const key = item.faction_id || '';
      const current = aggregated.get(key) || { wins: 0, losses: 0, total: 0, faction_name: item.faction_name };
      
      aggregated.set(key, {
        wins: current.wins + item.wins,
        losses: current.losses + item.losses,
        total: current.total + item.total_games,
        faction_name: current.faction_name,
      });
    });

    return Array.from(aggregated.entries()).map(([factionId, stats]) => ({
      faction_id: factionId,
      faction_name: stats.faction_name,
      total_games: stats.total,
      winrate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
    })).sort((a, b) => b.total_games - a.total_games);
  };

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;

  // If in comparison mode
  if (beforeData && afterData) {
    const beforeAgg = aggregateFactionData(beforeData);
    const afterAgg = aggregateFactionData(afterData);

    return (
      <div className="balance-stats">
        <div className="comparison-blocks">
          {/* BEFORE Block */}
          <div className="comparison-block before-block">
            <h3>{t('before') || 'Before'}</h3>
            <p className="block-info">{t('matches_evaluated') || 'Matches'}: {beforeData.reduce((sum, d) => sum + d.total_games, 0)}</p>
            <div className="stats-table-container">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>{t('faction') || 'Faction'}</th>
                    <th>{t('total_games') || 'Games'}</th>
                    <th>{t('winrate') || 'Win Rate'}</th>
                  </tr>
                </thead>
                <tbody>
                  {beforeAgg.map((stat) => (
                    <tr key={stat.faction_id}>
                      <td className="faction-name">{stat.faction_name}</td>
                      <td>{stat.total_games}</td>
                      <td>
                        <span className={`winrate ${getWinrateColorClass(stat.winrate)}`}>
                          {stat.winrate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AFTER Block */}
          <div className="comparison-block after-block">
            <h3>{t('after') || 'After'}</h3>
            <p className="block-info">{t('matches_evaluated') || 'Matches'}: {afterData.reduce((sum, d) => sum + d.total_games, 0)}</p>
            <div className="stats-table-container">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>{t('faction') || 'Faction'}</th>
                    <th>{t('total_games') || 'Games'}</th>
                    <th>{t('winrate') || 'Win Rate'}</th>
                  </tr>
                </thead>
                <tbody>
                  {afterAgg.map((stat) => (
                    <tr key={stat.faction_id}>
                      <td className="faction-name">{stat.faction_name}</td>
                      <td>{stat.total_games}</td>
                      <td>
                        <span className={`winrate ${getWinrateColorClass(stat.winrate)}`}>
                          {stat.winrate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default global view
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
