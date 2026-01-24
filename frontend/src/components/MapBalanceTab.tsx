import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';

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
    console.log('[MapBalanceTab.aggregateMapData] Input data count:', data.length);
    console.log('[MapBalanceTab.aggregateMapData] Raw input:', JSON.stringify(data.slice(0, 3), null, 2));
    
    // Group by map and aggregate faction stats
    const mapMap = new Map<string, {
      map_id: string;
      map_name: string;
      processedMatches: Set<string>; // Track matches to avoid double-counting
      factionStats: Map<string, { wins: number; losses: number; total: number }>;
    }>();
    
    data.forEach(item => {
      const mapId = item.map_id || '';
      const mapName = item.map_name || '';
      const factionId = item.faction_id || '';
      const opponentId = item.opponent_faction_id || '';
      
      if (!mapMap.has(mapId)) {
        mapMap.set(mapId, {
          map_id: mapId,
          map_name: mapName,
          processedMatches: new Set(),
          factionStats: new Map(),
        });
      }
      
      const mapData = mapMap.get(mapId)!;
      
      // Create a normalized match key to avoid processing the same match twice
      const matchKey = [factionId, opponentId].sort().join('|');
      
      // Skip if we've already processed this match (in either direction)
      if (mapData.processedMatches.has(matchKey)) {
        return;
      }
      mapData.processedMatches.add(matchKey);
      
      // Record stats for this faction
      if (!mapData.factionStats.has(factionId)) {
        mapData.factionStats.set(factionId, { wins: 0, losses: 0, total: 0 });
      }
      
      const fStats = mapData.factionStats.get(factionId)!;
      fStats.wins += item.wins;
      fStats.losses += item.losses;
      fStats.total += item.total_games;
      
      // Also record stats for opponent (inverted)
      if (!mapData.factionStats.has(opponentId)) {
        mapData.factionStats.set(opponentId, { wins: 0, losses: 0, total: 0 });
      }
      
      const oppStats = mapData.factionStats.get(opponentId)!;
      oppStats.wins += item.losses; // opponent's wins = this faction's losses
      oppStats.losses += item.wins; // opponent's losses = this faction's wins
      oppStats.total += item.total_games;
    });
    
    const result = Array.from(mapMap.values()).map(mapData => {
      const factionStats = mapData.factionStats;
      const totalGames = Array.from(factionStats.values()).reduce((sum, f) => sum + f.total, 0) / 2; // Divide by 2 because each game counted twice
      // For winrate calculation, use the actual wins/total from each faction (don't divide by 2)
      // because each faction's perspective counts the games they played correctly
      const winrates = Array.from(factionStats.values())
        .filter(f => f.total > 0)
        .map(f => (f.wins / f.total) * 100);
      
      console.log(`[MapBalanceTab] Map ${mapData.map_name}: winrates = [${winrates.map(w => w.toFixed(1)).join(', ')}]`);
      
      // Calculate SAMPLE standard deviation (like PostgreSQL STDDEV uses n-1)
      const avgWinrate = winrates.length > 0 ? winrates.reduce((sum, wr) => sum + wr, 0) / winrates.length : 50;
      const variance = winrates.length > 1 
        ? winrates.reduce((sum, wr) => sum + Math.pow(wr - avgWinrate, 2), 0) / (winrates.length - 1) 
        : 0;
      const avgImbalance = Math.sqrt(variance);
      
      console.log(`[MapBalanceTab] Map ${mapData.map_name}: avgWinrate=${avgWinrate.toFixed(2)}, variance=${variance.toFixed(2)}, stddev=${avgImbalance.toFixed(2)} (sample STDDEV with n-1)`);

      
      return {
        map_id: mapData.map_id,
        map_name: mapData.map_name,
        total_games: totalGames,
        factions_used: factionStats.size,
        avg_imbalance: avgImbalance,
        lowest_winrate: winrates.length > 0 ? Math.min(...winrates) : 50,
        highest_winrate: winrates.length > 0 ? Math.max(...winrates) : 50,
      };
    })
    .filter(map => map.total_games >= minGamesThreshold) // Apply minimum games filter
    .sort((a, b) => b.total_games - a.total_games);
    
    console.log('[MapBalanceTab.aggregateMapData] Final result:', JSON.stringify(result, null, 2));
    return result;
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
        console.log('[MapBalanceTab] Backend data received:', JSON.stringify(data, null, 2));
        // Convert string numbers to actual numbers
        const converted = data.map((item: any) => ({
          ...item,
          avg_imbalance: typeof item.avg_imbalance === 'string' ? parseFloat(item.avg_imbalance) : item.avg_imbalance,
          lowest_winrate: typeof item.lowest_winrate === 'string' ? parseFloat(item.lowest_winrate) : item.lowest_winrate,
          highest_winrate: typeof item.highest_winrate === 'string' ? parseFloat(item.highest_winrate) : item.highest_winrate,
        }));
        console.log('[MapBalanceTab] Backend data converted:', JSON.stringify(converted, null, 2));
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
      console.log('[MapBalanceTab] Before data received, item count:', beforeData.length);
      console.log('[MapBalanceTab] Before data sample:', JSON.stringify(beforeData.slice(0, 2), null, 2));
      const aggregated = aggregateMapData(beforeData);
      setBeforeStats(aggregated);
    } else {
      setBeforeStats([]);
    }
  }, [beforeData]);

  useEffect(() => {
    if (afterData && afterData.length > 0) {
      console.log('[MapBalanceTab] After data received, item count:', afterData.length);
      console.log('[MapBalanceTab] After data sample:', JSON.stringify(afterData.slice(0, 2), null, 2));
      const aggregated = aggregateMapData(afterData);
      setAfterStats(aggregated);
    } else {
      setAfterStats([]);
    }
  }, [afterData]);

  if (loading) return <div className="p-8 text-center text-gray-600 bg-gray-50 rounded-lg">{t('loading')}</div>;
  if (error) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg border-l-4 border-red-500">{error}</div>;

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
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">{t('map_balance_comparison') || 'Map Balance - Before & After'}</h3>
        <p className="text-blue-600 text-sm mb-3 p-3 bg-blue-50 rounded border-l-4 border-blue-500">
          {t('before_event') || 'Before'}: {beforeData ? beforeData.length : 0} {t('matches_evaluated') || 'matches'} | 
          {t('after_event') || 'After'}: {afterData ? afterData.length : 0} {t('matches_evaluated') || 'matches'}
        </p>
        <p className="text-gray-500 text-xs mb-6 italic">{t('balance_lower_better') || '(Lower imbalance = better balance)'}</p>
        
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse bg-white">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('map') || 'Map'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('total_games') || 'Games'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('factions_used') || 'Factions'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('avg_imbalance') || 'Avg Imbalance'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('winrate_range') || 'WR Range'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('balance_indicator') || 'Balance'}</th>
              </tr>
            </thead>
            <tbody>
              {combined.map((item) => (
                <tr key={item.map_id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    <div className="flex flex-col gap-1">
                      <span>{item.map_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <span className="font-semibold text-gray-800">{item.after?.total_games || '-'}</span>
                      {item.before && <span className="text-xs text-gray-600">{item.before.total_games}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <span className="font-semibold text-gray-800">{item.after?.factions_used || '-'}</span>
                      {item.before && <span className="text-xs text-gray-600">{item.before.factions_used}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <span className={`px-3 py-1 rounded-lg font-semibold inline-block w-fit text-sm ${
                        (item.after?.avg_imbalance || 0) < 5 ? 'bg-green-100 text-green-700' : 
                        (item.after?.avg_imbalance || 0) < 10 ? 'bg-blue-100 text-blue-700' : 
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {item.after?.avg_imbalance.toFixed(1) || '-'}%
                      </span>
                      {item.before && (
                        <span className={`px-3 py-1 rounded-lg font-semibold inline-block w-fit text-xs ${
                          (item.before?.avg_imbalance || 0) < 5 ? 'bg-green-100 text-green-700' : 
                          (item.before?.avg_imbalance || 0) < 10 ? 'bg-blue-100 text-blue-700' : 
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {item.before.avg_imbalance.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2 text-sm">
                      <span className="font-semibold text-gray-800">
                        {item.after?.lowest_winrate.toFixed(1) || '-'}% - {item.after?.highest_winrate.toFixed(1) || '-'}%
                      </span>
                      {item.before && (
                        <span className="text-xs text-gray-600">
                          {item.before.lowest_winrate.toFixed(1)}% - {item.before.highest_winrate.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <div 
                        className="w-24 h-6 bg-gray-200 rounded-lg overflow-hidden border border-gray-300"
                        title={`After: ${(item.after?.avg_imbalance || 0).toFixed(1)}% imbalance`}
                      >
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-300"
                          style={{ width: `${Math.min((item.after?.avg_imbalance || 0) / 20 * 100, 100)}%` }}
                        ></div>
                      </div>
                      {item.before && (
                        <div 
                          className="w-24 h-6 bg-gray-200 rounded-lg overflow-hidden border border-gray-300"
                          title={`Before: ${item.before.avg_imbalance.toFixed(1)}% imbalance`}
                        >
                          <div 
                            className="h-full bg-gray-400 transition-all duration-300"
                            style={{ width: `${Math.min((item.before.avg_imbalance / 20) * 100, 100)}%` }}
                          ></div>
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
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h3 className="text-xl font-semibold text-gray-800 mb-3">{t('map_balance_title') || 'Map Balance Analysis'}</h3>
      <p className="text-gray-600 text-sm mb-6 pb-3 px-3 bg-blue-50 border-l-4 border-blue-500 rounded">{t('map_balance_explanation') || 'Analysis of map balance across all factions'}</p>
      <p className="text-gray-500 text-xs mb-6 italic">{t('balance_lower_better') || '(Lower imbalance = better balance)'}</p>
      
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full border-collapse bg-white">
          <thead className="bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('map') || 'Map'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('total_games') || 'Games'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('factions_used') || 'Factions'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('avg_imbalance') || 'Avg Imbalance'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('winrate_range') || 'WR Range'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('balance_indicator') || 'Balance'}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.map_id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-800">{stat.map_name}</td>
                <td className="px-4 py-3 text-gray-700">{stat.total_games}</td>
                <td className="px-4 py-3 text-gray-700">{stat.factions_used}</td>
                <td className="px-4 py-3">
                  <span className={`px-3 py-1 rounded-lg font-semibold inline-block ${
                    stat.avg_imbalance < 5 ? 'bg-green-100 text-green-700' : 
                    stat.avg_imbalance < 10 ? 'bg-blue-100 text-blue-700' : 
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {stat.avg_imbalance.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{stat.lowest_winrate.toFixed(1)}% - {stat.highest_winrate.toFixed(1)}%</td>
                <td className="px-4 py-3">
                  <div 
                    className="w-full h-6 bg-gray-200 rounded-lg overflow-hidden border border-gray-300"
                    title={`Imbalance: ${stat.avg_imbalance.toFixed(1)}% - ${
                      stat.avg_imbalance < 5 ? 'Excellent balance' : 
                      stat.avg_imbalance < 10 ? 'Good balance' : 
                      'Needs balance adjustment'
                    }. Green = well balanced, Red = needs attention`}
                  >
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-300"
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
