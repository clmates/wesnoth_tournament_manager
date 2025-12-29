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

const MapBalanceTab: React.FC<{ beforeData?: any; afterData?: any }> = ({ beforeData = null, afterData = null }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<MapBalanceStats[]>([]);
  const [beforeStats, setBeforeStats] = useState<MapBalanceStats[]>([]);
  const [afterStats, setAfterStats] = useState<MapBalanceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minGamesThreshold, setMinGamesThreshold] = useState(5); // Default value

  const aggregateMapData = (data: ComparisonData[]): MapBalanceStats[] => {
    const mapMap = new Map<string, ComparisonData[]>();
    
    data.forEach(item => {
      const key = item.map_id || '';
      if (!mapMap.has(key)) {
        mapMap.set(key, []);
      }
      mapMap.get(key)!.push(item);
    });
    
    return Array.from(mapMap.entries()).map(([mapId, mapItems]) => {
      // Get unique map name from first item
      const mapName = mapItems[0]?.map_name || '';
      
      // Calculate imbalance per faction on this map, then average
      const factionStats = new Map<string, { wins: number; losses: number; total: number }>();
      
      mapItems.forEach(item => {
        const factionKey = item.faction_id || '';
        if (!factionStats.has(factionKey)) {
          factionStats.set(factionKey, { wins: 0, losses: 0, total: 0 });
        }
        const stats = factionStats.get(factionKey)!;
        stats.wins += item.wins;
        stats.losses += item.losses;
        stats.total += item.total_games;
      });
      
      const totalGames = Array.from(factionStats.values()).reduce((sum, f) => sum + f.total, 0);
      const winrates = Array.from(factionStats.values())
        .filter(f => f.total > 0)
        .map(f => (f.wins / f.total) * 100);
      
      const avgImbalance = winrates.length > 1
        ? winrates.reduce((sum, wr) => sum + Math.abs(wr - 50), 0) / winrates.length
        : 0;
      
      return {
        map_id: mapId,
        map_name: mapName,
        total_games: totalGames,
        factions_used: factionStats.size,
        avg_imbalance: avgImbalance,
        lowest_winrate: Math.min(...winrates, 50),
        highest_winrate: Math.max(...winrates, 50),
      };
    })
    .filter(map => map.total_games >= minGamesThreshold) // Apply minimum games filter
    .sort((a, b) => b.total_games - a.total_games);
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await statisticsService.getConfig();
        if (config.minGamesThreshold) {
          setMinGamesThreshold(config.minGamesThreshold);
        }
      } catch (err) {
        console.warn('Could not load config, using default threshold');
      }
    };

    fetchConfig();
  }, []);

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

  useEffect(() => {
    if (beforeData && beforeData.length > 0) {
      setBeforeStats(aggregateMapData(beforeData));
    } else {
      setBeforeStats([]);
    }
  }, [beforeData]);

  useEffect(() => {
    if (afterData && afterData.length > 0) {
      setAfterStats(aggregateMapData(afterData));
    } else {
      setAfterStats([]);
    }
  }, [afterData]);

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;

  const showComparison = beforeStats.length > 0 || afterStats.length > 0;

  if (showComparison) {
    // Create combined view
    const allMapIds = new Set([
      ...beforeStats.map(m => m.map_id),
      ...afterStats.map(m => m.map_id)
    ]);
    
    const beforeMap = new Map(beforeStats.map(m => [m.map_id, m]));
    const afterMap = new Map(afterStats.map(m => [m.map_id, m]));
    
    const combined = Array.from(allMapIds)
      .map(mapId => {
        const before = beforeMap.get(mapId);
        const after = afterMap.get(mapId);
        return {
          map_id: mapId,
          map_name: after?.map_name || before?.map_name || '',
          before,
          after,
        };
      })
      .filter(item => item.after || item.before)
      .sort((a, b) => {
        const aGames = (a.after?.total_games || 0) + (a.before?.total_games || 0);
        const bGames = (b.after?.total_games || 0) + (b.before?.total_games || 0);
        return bGames - aGames;
      });

    return (
      <div className="balance-stats">
        <h3>{t('map_balance_comparison') || 'Map Balance - Before & After'}</h3>
        <p className="block-info">
          {t('before_event') || 'Before'}: {beforeData.reduce((sum: number, d: ComparisonData) => sum + d.total_games, 0)} {t('matches_evaluated') || 'matches'} | 
          {t('after_event') || 'After'}: {afterData.reduce((sum: number, d: ComparisonData) => sum + d.total_games, 0)} {t('matches_evaluated') || 'matches'}
        </p>
        <p className="stats-info">{t('balance_lower_better') || '(Lower imbalance = better balance)'}</p>
        
        <div className="stats-table-container">
          <table className="stats-table compact-comparison">
            <thead>
              <tr>
                <th>{t('map') || 'Map'}</th>
                <th>{t('total_games') || 'Games'}</th>
                <th>{t('avg_imbalance') || 'Avg Imbalance'}</th>
                <th>{t('balance_indicator') || 'Balance'}</th>
              </tr>
            </thead>
            <tbody>
              {combined.map((item) => (
                <tr key={item.map_id}>
                  <td className="map-name">{item.map_name}</td>
                  <td>
                    {item.after?.total_games || '-'}
                    {item.before && <span className="before-value">({item.before.total_games})</span>}
                  </td>
                  <td>
                    <span className={`imbalance ${
                      (item.after?.avg_imbalance || 0) < 5 ? 'excellent' : 
                      (item.after?.avg_imbalance || 0) < 10 ? 'good' : 
                      'needs-balance'
                    }`}>
                      {item.after?.avg_imbalance.toFixed(1) || '-'}%
                    </span>
                    {item.before && <span className="before-value">({item.before.avg_imbalance.toFixed(1)}%)</span>}
                  </td>
                  <td>
                    <div className="stacked-balance-bar">
                      {item.before && (
                        <div 
                          className="balance-fill before"
                          style={{ width: `${Math.min((item.before.avg_imbalance / 20) * 100, 100)}%` }}
                          title={`Before: ${item.before.avg_imbalance.toFixed(1)}%`}
                        ></div>
                      )}
                      {item.after && (
                        <div 
                          className="balance-fill after"
                          style={{ width: `${Math.min((item.after.avg_imbalance / 20) * 100, 100)}%` }}
                          title={`After: ${item.after.avg_imbalance.toFixed(1)}%`}
                        ></div>
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
      <h3>{t('map_balance_title') || 'Map Balance Analysis'}</h3>
      <p className="explanation">{t('map_balance_explanation') || 'Analysis of map balance across all factions'}</p>
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
