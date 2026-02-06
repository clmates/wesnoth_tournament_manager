import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface FactionMatchupStats {
  faction_1_name: string;
  faction_2_name: string;
  total_games: number;
  faction_1_wins: number;
  faction_2_wins: number;
  faction_1_winrate: number;
  faction_2_winrate: number;
  imbalance: number;
}

const FactionVsFactionTab: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<FactionMatchupStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minGames, setMinGames] = useState(5);
  const [minGamesThreshold, setMinGamesThreshold] = useState(5);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/statistics/config');
        const config = await response.json();
        if (config.minGamesThreshold) {
          setMinGamesThreshold(config.minGamesThreshold);
          setMinGames(config.minGamesThreshold);
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
        const url = `/api/statistics/matchups?minGames=${minGames}`;
        console.log('[FactionVsFactionTab] Fetching from:', url);
        const response = await fetch(url);
        
        console.log('[FactionVsFactionTab] Response status:', response.status);
        console.log('[FactionVsFactionTab] Response headers:', Object.fromEntries(response.headers));
        
        const text = await response.text();
        console.log('[FactionVsFactionTab] Raw response (first 200 chars):', text.substring(0, 200));
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const data = JSON.parse(text);
        console.log('[FactionVsFactionTab] Parsed data count:', data.length);
        
        // Aggregate by faction matchup (remove map dimension)
        const factionMatchupMap = new Map<string, FactionMatchupStats>();
        
        data.forEach((item: any) => {
          // Normalize faction order for consistent grouping
          const f1 = item.faction_1_name;
          const f2 = item.faction_2_name;
          const key = [f1, f2].sort().join('|');
          
          // Determine if we need to flip the order
          const isFlipped = f1 > f2;
          
          const existing = factionMatchupMap.get(key);
          
          if (!existing) {
            factionMatchupMap.set(key, {
              faction_1_name: isFlipped ? f2 : f1,
              faction_2_name: isFlipped ? f1 : f2,
              total_games: item.total_games,
              faction_1_wins: isFlipped ? item.faction_2_wins : item.faction_1_wins,
              faction_2_wins: isFlipped ? item.faction_1_wins : item.faction_2_wins,
              faction_1_winrate: isFlipped ? item.faction_2_winrate : item.faction_1_winrate,
              faction_2_winrate: isFlipped ? item.faction_1_winrate : item.faction_2_winrate,
              imbalance: Math.abs(item.faction_1_wins - item.faction_2_wins),
            });
          } else {
            // Aggregate
            existing.total_games += item.total_games;
            const f1WinsToAdd = isFlipped ? item.faction_2_wins : item.faction_1_wins;
            const f2WinsToAdd = isFlipped ? item.faction_1_wins : item.faction_2_wins;
            existing.faction_1_wins += f1WinsToAdd;
            existing.faction_2_wins += f2WinsToAdd;
            existing.imbalance = Math.abs(existing.faction_1_wins - existing.faction_2_wins);
            if (existing.total_games > 0) {
              existing.faction_1_winrate = (existing.faction_1_wins / existing.total_games) * 100;
              existing.faction_2_winrate = (existing.faction_2_wins / existing.total_games) * 100;
            }
          }
        });
        
        const aggregated = Array.from(factionMatchupMap.values())
          .filter(m => m.total_games >= minGames)
          .sort((a, b) => b.imbalance - a.imbalance);
        
        console.log('[FactionVsFactionTab] Aggregated count:', aggregated.length);
        setStats(aggregated);
      } catch (err) {
        console.error('Error fetching faction matchup stats:', err);
        setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [minGames]);

  const getImbalanceColor = (imbalance: number): string => {
    if (imbalance > 10) return 'bg-red-100 text-red-700';
    if (imbalance > 5) return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  };

  if (loading) return <div className="p-8 text-center text-gray-600 bg-gray-50 rounded-lg">{t('loading') || 'Loading...'}</div>;
  if (error) return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg border-l-4 border-red-500">{error}</div>;

  const filteredStats = stats.filter(s => s.total_games >= minGames);

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        {t('faction_vs_faction_analysis') || 'Faction vs Faction Analysis'}
      </h3>

      {/* Minimum Games Filter */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-semibold text-gray-700">
          {t('minimum_games') || 'Minimum Games:'}
        </label>
        <input
          type="number"
          value={minGames}
          onChange={(e) => setMinGames(parseInt(e.target.value) || minGamesThreshold)}
          min={1}
          max={100}
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">
          {filteredStats.length} {t('matchups') || 'matchups'}
        </span>
      </div>

      {filteredStats.length === 0 ? (
        <div className="text-center py-8 text-gray-600 bg-gray-50 rounded-lg">
          {t('no_data_available') || 'No data available'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse bg-white">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('faction_1') || 'Faction 1'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('vs')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('faction_2') || 'Faction 2'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('total_games') || 'Games'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('faction_1_wins') || 'F1 Wins'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('faction_1_winrate') || 'F1 WR'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('faction_2_wins') || 'F2 Wins'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('faction_2_winrate') || 'F2 WR'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('imbalance') || 'Imbalance'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.map((stat, idx) => (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-blue-700">{stat.faction_1_name}</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-semibold">vs</td>
                  <td className="px-4 py-3 font-semibold text-red-700">{stat.faction_2_name}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{stat.total_games}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{stat.faction_1_wins}</td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-semibold">
                      {stat.faction_1_winrate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{stat.faction_2_wins}</td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="px-2 py-1 bg-red-50 text-red-700 rounded font-semibold">
                      {stat.faction_2_winrate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-lg font-semibold inline-block text-sm ${getImbalanceColor(stat.imbalance)}`}>
                      {stat.imbalance}
                    </span>
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

export default FactionVsFactionTab;
