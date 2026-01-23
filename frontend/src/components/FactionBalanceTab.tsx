import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';

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
  const [minGamesThreshold, setMinGamesThreshold] = useState(5); // Default value

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await statisticsService.getConfig();
        if (config.minGamesThreshold) {
          setMinGamesThreshold(config.minGamesThreshold);
        }
      } catch (err) {
        console.warn('Could not load config, using default threshold');
        // Use default value on error
      }
    };

    fetchConfig();
  }, []);

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
    // Group by faction to calculate maps_played and aggregate stats
    // Note: each match appears twice in data (once for each faction), so we only process faction_id
    const factionMap = new Map<string, { 
      faction_id: string;
      faction_name: string;
      total_games: number;
      wins: number;
      losses: number;
      maps: Set<string>;
    }>();
    
    data.forEach(item => {
      const key = item.faction_id || '';
      const existing = factionMap.get(key);
      
      if (!existing) {
        factionMap.set(key, {
          faction_id: item.faction_id || '',
          faction_name: item.faction_name || '',
          total_games: 0,
          wins: 0,
          losses: 0,
          maps: new Set<string>(),
        });
      }
      
      const stats = factionMap.get(key)!;
      stats.total_games += item.total_games;
      stats.wins += item.wins;
      stats.losses += item.losses;
      if (item.map_id) {
        stats.maps.add(item.map_id);
      }
    });

    return Array.from(factionMap.values())
      .filter(stat => stat.total_games >= minGamesThreshold) // Apply minimum games filter
      .map(stat => ({
        faction_id: stat.faction_id,
        faction_name: stat.faction_name,
        total_games: stat.total_games,
        winrate: stat.total_games > 0 ? (stat.wins / stat.total_games) * 100 : 0,
        maps_played: stat.maps.size,
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
          {t('before_event') || 'Before'}: {beforeData ? beforeData.length : 0} {t('matches_evaluated') || 'matches'} | 
          {t('after_event') || 'After'}: {afterData ? afterData.length : 0} {t('matches_evaluated') || 'matches'}
        </p>
        <div className="stats-table-container">
          <table className="stats-table comparison-mode">
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
              {combined.map((item) => (
                <tr key={item.faction_id} className="comparison-row">
                  <td className="faction-name">
                    <div className="comparison-cell">
                      <div className="after-value">{item.faction_name}</div>
                    </div>
                  </td>
                  <td>
                    <div className="comparison-cell">
                      <div className="after-value">{item.after?.total_games || '-'}</div>
                      {item.before && <div className="before-value">{item.before.total_games}</div>}
                    </div>
                  </td>
                  <td>
                    <div className="comparison-cell">
                      <div className="after-value">
                        <span className={`winrate ${getWinrateColorClass(item.after?.winrate || 50)}`}>
                          {item.after?.winrate.toFixed(1) || '-'}%
                        </span>
                      </div>
                      {item.before && (
                        <div className="before-value">
                          <span className={`winrate ${getWinrateColorClass(item.before.winrate)}`}>
                            {item.before.winrate.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="comparison-cell">
                      <div className="after-value">{item.after?.maps_played || '-'}</div>
                      {item.before && <div className="before-value">{item.before.maps_played}</div>}
                    </div>
                  </td>
                  <td>
                    <div className="comparison-cell">
                      <div className="after-value">
                        <div className="balance-bar">
                          <div 
                            className="balance-fill"
                            style={{ width: `${item.after?.winrate || 50}%` }}
                          ></div>
                        </div>
                      </div>
                      {item.before && (
                        <div className="before-value">
                          <div className="balance-bar">
                            <div 
                              className="balance-fill"
                              style={{ width: `${item.before.winrate}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
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
