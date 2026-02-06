import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface FactionData {
  id: string;
  name: string;
  wins: number;
  winrate: number;
}

interface GlobalStats {
  faction_1: FactionData;
  faction_2: FactionData;
  total_games: number;
  imbalance: number;
}

interface MapStats {
  map_id: string;
  map_name: string;
  total_games: number;
  faction_1_wins: number;
  faction_2_wins: number;
  faction_1_winrate: number;
  faction_2_winrate: number;
}

interface MatchupData {
  global: GlobalStats;
  by_map: MapStats[];
}

const FactionVsFactionTab: React.FC = () => {
  const { t } = useTranslation();
  const [factions, setFactions] = useState<Array<{ id: string; name: string }>>([]);
  const [faction1, setFaction1] = useState<string>('');
  const [faction2, setFaction2] = useState<string>('');
  const [data, setData] = useState<MatchupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch factions on mount
  useEffect(() => {
    const fetchFactions = async () => {
      try {
        const response = await fetch('/api/factions');
        const result = await response.json();
        setFactions(result.sort((a: any, b: any) => a.name.localeCompare(b.name)));
        if (result.length >= 2) {
          setFaction1(result[0].name);
          setFaction2(result[1].name);
        }
      } catch (err) {
        console.error('Failed to fetch factions:', err);
      }
    };
    fetchFactions();
  }, []);

  // Fetch matchup data when factions change
  useEffect(() => {
    if (faction1 && faction2 && faction1 !== faction2) {
      const fetchMatchupData = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/statistics/faction-vs-faction?faction1=${encodeURIComponent(faction1)}&faction2=${encodeURIComponent(faction2)}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
          }
          const result = await response.json();
          setData(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch matchup data');
          setData(null);
        } finally {
          setLoading(false);
        }
      };
      fetchMatchupData();
    }
  }, [faction1, faction2]);

  const handleSwapFactions = () => {
    const temp = faction1;
    setFaction1(faction2);
    setFaction2(temp);
  };

  const getWinrateColor = (winrate: number): string => {
    if (winrate >= 60) return 'text-red-600 font-bold';
    if (winrate >= 55) return 'text-red-500';
    if (winrate >= 50) return 'text-orange-500';
    if (winrate === 50) return 'text-gray-500';
    if (winrate >= 45) return 'text-blue-500';
    if (winrate >= 40) return 'text-blue-600';
    return 'text-blue-700 font-bold';
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          {t('faction_vs_faction') || 'Faction vs Faction Analysis'}
        </h2>

        {/* Faction Selection */}
        <div className="flex gap-4 items-center mb-6 flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('faction') || 'Faction'} 1
            </label>
            <select
              value={faction1}
              onChange={(e) => setFaction1(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {factions.map(f => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSwapFactions}
            className="mt-6 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            title="Swap factions"
          >
            ⇄
          </button>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('faction') || 'Faction'} 2
            </label>
            <select
              value={faction2}
              onChange={(e) => setFaction2(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {factions.map(f => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Stats */}
        {data && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {t('global_stats') || 'Global Statistics'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Faction 1 */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="text-lg font-bold text-gray-800 mb-2">{data.global.faction_1.name}</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Wins: </span>
                    <span className="font-semibold">{data.global.faction_1.wins}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Winrate: </span>
                    <span className={`font-bold ${getWinrateColor(data.global.faction_1.winrate)}`}>
                      {data.global.faction_1.winrate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Games */}
              <div className="bg-white rounded-lg p-4 border border-gray-200 flex flex-col justify-center">
                <h4 className="text-sm text-gray-600 mb-2 text-center">Total Games</h4>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-800">{data.global.total_games}</div>
                  <div className={`text-sm font-semibold mt-2 ${data.global.imbalance > 10 ? 'text-red-600' : data.global.imbalance > 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                    Imbalance: {data.global.imbalance}
                  </div>
                </div>
              </div>

              {/* Faction 2 */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="text-lg font-bold text-gray-800 mb-2">{data.global.faction_2.name}</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Wins: </span>
                    <span className="font-semibold">{data.global.faction_2.wins}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Winrate: </span>
                    <span className={`font-bold ${getWinrateColor(data.global.faction_2.winrate)}`}>
                      {data.global.faction_2.winrate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Per-Map Breakdown */}
        {data && data.by_map.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {t('breakdown_by_map') || 'Breakdown by Map'}
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-200 border-b-2 border-gray-300">
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Map</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-700">Games</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-700">{data.global.faction_1.name}</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-700">vs</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-700">{data.global.faction_2.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_map.map((map, idx) => (
                    <tr key={idx} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-3 font-medium text-gray-800">{map.map_name}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{map.total_games}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold">{map.faction_1_wins}</span>
                        <div className={`text-xs ${getWinrateColor(map.faction_1_winrate)}`}>
                          {map.faction_1_winrate.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">-</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold">{map.faction_2_wins}</span>
                        <div className={`text-xs ${getWinrateColor(map.faction_2_winrate)}`}>
                          {map.faction_2_winrate.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-gray-600 mt-2">{t('loading') || 'Loading...'}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && data && data.by_map.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
            {t('no_data_available') || 'No data available for this matchup'}
          </div>
        )}
      </div>
    </div>
  );
};

export default FactionVsFactionTab;
