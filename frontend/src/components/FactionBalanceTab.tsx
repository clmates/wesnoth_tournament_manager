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

const MIN_GAMES_THRESHOLD = 10; // Minimum games to include a faction in comparison

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
    // Take the LATEST snapshot for each faction (don't sum historical snapshots)
    // Group by faction, then find the last one by total_games (highest = most recent)
    const factionMap = new Map<string, ComparisonData>();
    
    data.forEach(item => {
      const key = item.faction_id || '';
      const existing = factionMap.get(key);
      
      // Keep the one with most games (latest snapshot)
      if (!existing || item.total_games > existing.total_games) {
        factionMap.set(key, item);
      }
    });

    return Array.from(factionMap.values())
      .filter(stat => stat.total_games >= MIN_GAMES_THRESHOLD) // Apply minimum games filter
      .map(stat => ({
        faction_id: stat.faction_id,
        faction_name: stat.faction_name,
        total_games: stat.total_games,
        winrate: stat.winrate,
      })).sort((a, b) => b.total_games - a.total_games);
  };

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;

  // If in comparison mode
  if (beforeData && afterData) {
    const beforeAgg = aggregateFactionData(beforeData);
    const afterAgg = aggregateFactionData(afterData);
    
    // Create a combined view: merge before and after by faction_id
    const allFactionIds = new Set([
      ...beforeAgg.map(f => f.faction_id),
      ...afterAgg.map(f => f.faction_id)
    ]);
    
    const beforeMap = new Map(beforeAgg.map(f => [f.faction_id, f]));
    const afterMap = new Map(afterAgg.map(f => [f.faction_id, f]));
    
    const combined = Array.from(allFactionIds)
      .map(factionId => {
        const before = beforeMap.get(factionId);
        const after = afterMap.get(factionId);
        return {
          faction_id: factionId,
          faction_name: after?.faction_name || before?.faction_name || '',
          before,
          after,
        };
      })
      .filter(item => item.after || item.before) // Keep items with data in either period
      .sort((a, b) => {
        const aGames = (a.after?.total_games || 0) + (a.before?.total_games || 0);
        const bGames = (b.after?.total_games || 0) + (b.before?.total_games || 0);
        return bGames - aGames;
      });

    return (
      <div className="balance-stats">
        <h3>{t('faction_balance_comparison') || 'Faction Balance - Before & After'}</h3>
        <p className="block-info">
          {t('before_event') || 'Before'}: {beforeData.reduce((sum, d) => sum + d.total_games, 0)} {t('matches_evaluated') || 'matches'} | 
          {t('after_event') || 'After'}: {afterData.reduce((sum, d) => sum + d.total_games, 0)} {t('matches_evaluated') || 'matches'}
        </p>
        <div className="stats-table-container">
          <table className="stats-table compact-comparison">
            <thead>
              <tr>
                <th>{t('faction') || 'Faction'}</th>
                <th>{t('total_games') || 'Games'}</th>
                <th>{t('winrate') || 'Win Rate'}</th>
              </tr>
            </thead>
            <tbody>
              {combined.map((item) => (
                <tr key={item.faction_id}>
                  <td className="faction-name">{item.faction_name}</td>
                  <td>
                    {item.after?.total_games || '-'}
                    {item.before && <span className="before-value">({item.before.total_games})</span>}
                  </td>
                  <td>
                    <span className={`winrate ${getWinrateColorClass(item.after?.winrate || 50)}`}>
                      {item.after?.winrate.toFixed(1) || '-'}%
                    </span>
                    {item.before && <span className="before-value">({item.before.winrate.toFixed(1)}%)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
