import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';

interface FactionStats {
  faction_id: string;
  faction_name: string;
  total_games: number;
  wins: number;
  losses: number;
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
        // Convert string winrates to numbers and calculate wins/losses if not present
        const converted = data.map((item: any) => {
          const winrate = typeof item.global_winrate === 'string' ? parseFloat(item.global_winrate) : item.global_winrate;
          const total = item.total_games || 0;
          const wins = item.wins || Math.round((winrate / 100) * total);
          const losses = item.losses || (total - wins);
          
          return {
            ...item,
            global_winrate: winrate,
            wins,
            losses,
          };
        });
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

  if (loading) return <div className="p-8 text-center text-gray-600 bg-gray-50 rounded-lg">{t('loading')}</div>;
  if (error) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg border-l-4 border-red-500">{error}</div>;

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
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">{t('faction_balance_comparison') || 'Faction Balance - Before & After'}</h3>
        <p className="text-blue-600 text-sm mb-6 p-3 bg-blue-50 rounded border-l-4 border-blue-500">
          {t('before_event') || 'Before'}: {beforeData ? beforeData.length : 0} {t('matches_evaluated') || 'matches'} | 
          {t('after_event') || 'After'}: {afterData ? afterData.length : 0} {t('matches_evaluated') || 'matches'}
        </p>
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse bg-white">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('faction') || 'Faction'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('total_games') || 'Games'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('wins') || 'Wins'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('losses') || 'Losses'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('winrate') || 'Win Rate'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('maps_played') || 'Maps'}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('balance_indicator') || 'Balance'}</th>
              </tr>
            </thead>
            <tbody>
              {combined.map((item) => (
                <tr key={item.faction_id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    <div className="flex flex-col gap-1">
                      <span>{item.faction_name}</span>
                      {item.before && <span className="text-xs text-gray-500">(before)</span>}
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
                      <span className="font-semibold text-green-600">{item.after?.wins || '-'}</span>
                      {item.before && <span className="text-xs text-green-600">{item.before.wins}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <span className="font-semibold text-red-600">{item.after?.losses || '-'}</span>
                      {item.before && <span className="text-xs text-red-600">{item.before.losses}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <span className={`px-3 py-1 rounded-lg font-semibold inline-block w-fit ${
                        item.after && item.after.winrate > 55 ? 'bg-green-100 text-green-700' : 
                        item.after && item.after.winrate < 45 ? 'bg-red-100 text-red-700' : 
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {item.after?.winrate.toFixed(1) || '-'}%
                      </span>
                      {item.before && (
                        <span className={`px-3 py-1 rounded-lg font-semibold inline-block w-fit text-xs ${
                          item.before.winrate > 55 ? 'bg-green-100 text-green-700' : 
                          item.before.winrate < 45 ? 'bg-red-100 text-red-700' : 
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {item.before.winrate.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <span className="font-semibold text-gray-800">{item.after?.maps_played || '-'}</span>
                      {item.before && <span className="text-xs text-gray-600">{item.before.maps_played}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <div className="w-24 h-6 bg-gray-200 rounded-lg overflow-hidden border border-gray-300">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${item.after?.winrate || 50}%` }}
                        ></div>
                      </div>
                      {item.before && (
                        <div className="w-24 h-6 bg-gray-200 rounded-lg overflow-hidden border border-gray-300">
                          <div 
                            className="h-full bg-gray-400 transition-all duration-300"
                            style={{ width: `${item.before.winrate}%` }}
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
      <h3 className="text-xl font-semibold text-gray-800 mb-3">{t('faction_balance_title') || 'Global Faction Balance'}</h3>
      <p className="text-gray-600 text-sm mb-6 pb-3 px-3 bg-blue-50 border-l-4 border-blue-500 rounded">{t('faction_balance_explanation') || 'Detailed analysis of faction balance across all tournaments'}</p>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full border-collapse bg-white">
          <thead className="bg-gray-100 border-b-2 border-gray-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('faction') || 'Faction'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('total_games') || 'Games'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('wins') || 'Wins'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('losses') || 'Losses'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('winrate') || 'Win Rate'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('maps_played') || 'Maps'}</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('balance_indicator') || 'Balance'}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.faction_id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 font-semibold text-gray-800">{stat.faction_name}</td>
                <td className="px-4 py-3 text-gray-700">{stat.total_games}</td>
                <td className="px-4 py-3 text-green-600 font-semibold">{stat.wins}</td>
                <td className="px-4 py-3 text-red-600 font-semibold">{stat.losses}</td>
                <td className="px-4 py-3">
                  <span className={`px-3 py-1 rounded-lg font-semibold inline-block min-w-fit ${
                    stat.global_winrate > 55 ? 'bg-green-100 text-green-700' : 
                    stat.global_winrate < 45 ? 'bg-red-100 text-red-700' : 
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {stat.global_winrate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{stat.maps_played}</td>
                <td className="px-4 py-3">
                  <div className="w-full h-6 bg-gray-200 rounded-lg overflow-hidden border border-gray-300">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
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
