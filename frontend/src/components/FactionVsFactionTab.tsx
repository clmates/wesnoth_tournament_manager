import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';

interface FactionMatchupStats {
  faction_1_name: string;
  faction_2_name: string;
  total_games: number;
  faction_1_wins: number;
  faction_2_wins: number;
  faction_1_winrate: number;
  faction_2_winrate: number;
  imbalance: number;
  side1_games?: number;
  f1_side1_winrate?: number | null;
  side2_games?: number;
  f1_side2_winrate?: number | null;
}

/** Accumulator for building FactionMatchupStats across multiple map rows */
interface MatchupAccum {
  faction_1_name: string;
  faction_2_name: string;
  total_games: number;
  f1_wins: number;
  f2_wins: number;
  s1g: number; // side1_games (faction_1 as side 1)
  s1w: number; // side1_wins
  s2g: number; // side2_games (faction_1 as side 2)
  s2w: number; // side2_wins
}

interface ComparisonInputData {
  faction_id?: string;
  faction_name?: string;
  opponent_faction_id?: string;
  opponent_faction_name?: string;
  wins: number;
  losses: number;
  total_games: number;
}

const FactionVsFactionTab: React.FC<{ beforeData?: any[] | null; afterData?: any[] | null }> = ({ 
  beforeData = null, afterData = null 
}) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<FactionMatchupStats[]>([]);
  const [beforeStats, setBeforeStats] = useState<FactionMatchupStats[]>([]);
  const [afterStats, setAfterStats] = useState<FactionMatchupStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minGames, setMinGames] = useState(5);
  const [minGamesThreshold, setMinGamesThreshold] = useState(5);

  /** Convert AggregatedData[] (from balance event impact) → FactionMatchupStats[] */
  const aggregateFromComparisonData = (data: ComparisonInputData[]): FactionMatchupStats[] => {
    const map = new Map<string, { f1_name: string; f2_name: string; f1_wins: number; f2_wins: number; total: number }>();

    data.forEach(item => {
      const f1 = item.faction_name || '';
      const f2 = item.opponent_faction_name || '';
      if (!f1 || !f2) return;

      const ordered = [f1, f2].sort();
      const isOriginalOrder = f1 === ordered[0];
      const key = ordered.join('|');

      const wins   = parseInt(String(item.wins),   10) || 0;
      const losses = parseInt(String(item.losses), 10) || 0;
      const total  = parseInt(String(item.total_games), 10) || 0;

      const f1Wins = isOriginalOrder ? wins : losses;
      const f2Wins = isOriginalOrder ? losses : wins;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, { f1_name: ordered[0], f2_name: ordered[1], f1_wins: f1Wins, f2_wins: f2Wins, total });
      } else {
        existing.f1_wins += f1Wins;
        existing.f2_wins += f2Wins;
        existing.total   += total;
      }
    });

    return Array.from(map.values()).map(m => {
      // Each match appears twice in data (once per faction perspective) → divide by 2
      const totalGames = m.total / 2;
      const f1Wins     = m.f1_wins / 2;
      const f2Wins     = m.f2_wins / 2;
      return {
        faction_1_name:    m.f1_name,
        faction_2_name:    m.f2_name,
        total_games:       totalGames,
        faction_1_wins:    f1Wins,
        faction_2_wins:    f2Wins,
        faction_1_winrate: totalGames > 0 ? (f1Wins / totalGames) * 100 : 0,
        faction_2_winrate: totalGames > 0 ? (f2Wins / totalGames) * 100 : 0,
        imbalance:         totalGames > 0 ? (Math.abs(f1Wins - f2Wins) / totalGames) * 100 : 0,
      };
    }).sort((a, b) => b.imbalance - a.imbalance);
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await statisticsService.getConfig();
        if (config.minGamesThreshold) {
          setMinGamesThreshold(config.minGamesThreshold);
          setMinGames(config.minGamesThreshold);
        }
      } catch { /* use default */ }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await statisticsService.getMatchupStats(minGames);

        const accumMap = new Map<string, MatchupAccum>();

        data.forEach((item: any) => {
          const f1 = item.faction_1_name;
          const f2 = item.faction_2_name;
          const key = [f1, f2].sort().join('|');
          const isFlipped = f1 > f2;

          const itemTotal  = parseInt(String(item.total_games),    10) || 0;
          const itemF1Wins = parseInt(String(item.faction_1_wins),  10) || 0;
          const itemF2Wins = parseInt(String(item.faction_2_wins),  10) || 0;

          // Side stats from backend (faction_1 = backend's f1, which may be flipped)
          const beS1g  = parseInt(String(item.side1_games), 10)  || 0;
          const beS1wr = parseFloat(item.f1_side1_winrate) || 0;
          const beS2g  = parseInt(String(item.side2_games), 10)  || 0;
          const beS2wr = parseFloat(item.f1_side2_winrate) || 0;
          const beS1w  = Math.round(beS1wr * beS1g / 100);
          const beS2w  = Math.round(beS2wr * beS2g / 100);

          // When flipped: our faction_1 = backend's faction_2
          // → our faction_1's side1 = backend's faction_2's side1 = backend's faction_1's side2, wins inverted
          const s1g = isFlipped ? beS2g : beS1g;
          const s1w = isFlipped ? (beS2g - beS2w) : beS1w;  // backend f2 wins when backend f1 loses
          const s2g = isFlipped ? beS1g : beS2g;
          const s2w = isFlipped ? (beS1g - beS1w) : beS2w;

          const existing = accumMap.get(key);
          if (!existing) {
            accumMap.set(key, {
              faction_1_name: isFlipped ? f2 : f1,
              faction_2_name: isFlipped ? f1 : f2,
              total_games:    itemTotal,
              f1_wins:        isFlipped ? itemF2Wins : itemF1Wins,
              f2_wins:        isFlipped ? itemF1Wins : itemF2Wins,
              s1g, s1w, s2g, s2w,
            });
          } else {
            existing.total_games += itemTotal;
            existing.f1_wins += isFlipped ? itemF2Wins : itemF1Wins;
            existing.f2_wins += isFlipped ? itemF1Wins : itemF2Wins;
            existing.s1g += s1g;
            existing.s1w += s1w;
            existing.s2g += s2g;
            existing.s2w += s2w;
          }
        });

        const aggregated: FactionMatchupStats[] = Array.from(accumMap.values())
          .filter(m => m.total_games >= minGames)
          .map(m => ({
            faction_1_name:    m.faction_1_name,
            faction_2_name:    m.faction_2_name,
            total_games:       m.total_games,
            faction_1_wins:    m.f1_wins,
            faction_2_wins:    m.f2_wins,
            faction_1_winrate: m.total_games > 0 ? (m.f1_wins / m.total_games) * 100 : 0,
            faction_2_winrate: m.total_games > 0 ? (m.f2_wins / m.total_games) * 100 : 0,
            imbalance:         m.total_games > 0 ? (Math.abs(m.f1_wins - m.f2_wins) / m.total_games) * 100 : 0,
            side1_games:       m.s1g,
            f1_side1_winrate:  m.s1g > 0 ? (m.s1w / m.s1g) * 100 : null,
            side2_games:       m.s2g,
            f1_side2_winrate:  m.s2g > 0 ? (m.s2w / m.s2g) * 100 : null,
          }))
          .sort((a, b) => b.imbalance - a.imbalance);

        setStats(aggregated);
      } catch (err) {
        setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [minGames]);

  useEffect(() => {
    if (beforeData && beforeData.length > 0) {
      setBeforeStats(aggregateFromComparisonData(beforeData));
    } else {
      setBeforeStats([]);
    }
  }, [beforeData]);

  useEffect(() => {
    if (afterData && afterData.length > 0) {
      setAfterStats(aggregateFromComparisonData(afterData));
    } else {
      setAfterStats([]);
    }
  }, [afterData]);

  const getImbalanceColor = (imbalance: number): string => {
    if (imbalance > 10) return 'bg-red-100 text-red-700';
    if (imbalance > 5)  return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  };

  if (loading) return <div className="p-8 text-center text-gray-600 bg-gray-50 rounded-lg">{t('loading') || 'Loading...'}</div>;
  if (error)   return <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg border-l-4 border-red-500">{error}</div>;

  const showComparison = beforeStats.length > 0 || afterStats.length > 0;
  const filteredStats  = stats.filter(s => s.total_games >= minGames);

  /* ─── Comparison view ─── */
  if (showComparison) {
    const allKeys = new Set([
      ...beforeStats.map(m => `${m.faction_1_name}|${m.faction_2_name}`),
      ...afterStats.map(m => `${m.faction_1_name}|${m.faction_2_name}`),
    ]);
    const beforeMap = new Map(beforeStats.map(m => [`${m.faction_1_name}|${m.faction_2_name}`, m]));
    const afterMap  = new Map(afterStats.map(m  => [`${m.faction_1_name}|${m.faction_2_name}`, m]));

    const combined = Array.from(allKeys)
      .map(key => ({ key, before: beforeMap.get(key), after: afterMap.get(key) }))
      .filter(item => ((item.after?.total_games || 0) + (item.before?.total_games || 0)) >= minGames)
      .sort((a, b) => {
        const aI = Math.max(a.after?.imbalance || 0, a.before?.imbalance || 0);
        const bI = Math.max(b.after?.imbalance || 0, b.before?.imbalance || 0);
        return bI - aI;
      });

    return (
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-3">
          {t('faction_vs_faction_analysis') || 'Faction vs Faction — Before & After'}
        </h3>
        <p className="text-blue-600 text-sm mb-3 p-3 bg-blue-50 rounded border-l-4 border-blue-500">
          {t('before_event') || 'Before'}: {beforeStats.reduce((s, m) => s + m.total_games, 0)} {t('matches_evaluated') || 'matches'} |{' '}
          {t('after_event')  || 'After'}:  {afterStats.reduce((s, m)  => s + m.total_games, 0)} {t('matches_evaluated') || 'matches'}
        </p>
        <div className="bg-gray-100 p-4 rounded-lg mb-6 border border-gray-200 flex items-center gap-4">
          <label className="flex items-center gap-2 font-semibold text-gray-800">
            {t('minimum_games') || 'Minimum Games'}:
            <input type="number" min="1" max="100" value={minGames}
              onChange={(e) => setMinGames(Math.max(1, parseInt(e.target.value) || 1))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 w-24" />
          </label>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full border-collapse bg-white text-sm">
            <thead className="bg-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('faction_1') || 'Faction 1'}</th>
                <th className="px-2 py-3 text-center font-semibold text-gray-800">{t('vs')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('faction_2') || 'Faction 2'}</th>
                <th className="px-3 py-3 text-center font-semibold text-gray-600" colSpan={3}>{t('before_event') || 'Before'}</th>
                <th className="px-3 py-3 text-center font-semibold text-gray-800" colSpan={3}>{t('after_event') || 'After'}</th>
                <th className="px-3 py-3 text-center font-semibold text-gray-800">Δ {t('imbalance') || 'Imbalance'}</th>
              </tr>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th colSpan={3}></th>
                <th className="px-2 py-2 text-center text-xs text-gray-500">{t('total_games') || 'G'}</th>
                <th className="px-2 py-2 text-center text-xs text-gray-500">{t('faction_1_winrate') || 'F1 WR'}</th>
                <th className="px-2 py-2 text-center text-xs text-gray-500">{t('imbalance') || 'Imb.'}</th>
                <th className="px-2 py-2 text-center text-xs text-gray-500">{t('total_games') || 'G'}</th>
                <th className="px-2 py-2 text-center text-xs text-gray-500">{t('faction_1_winrate') || 'F1 WR'}</th>
                <th className="px-2 py-2 text-center text-xs text-gray-500">{t('imbalance') || 'Imb.'}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {combined.map((item, idx) => {
                const ref = item.after || item.before!;
                const imbBefore = item.before?.imbalance ?? null;
                const imbAfter  = item.after?.imbalance  ?? null;
                const delta = imbBefore != null && imbAfter != null ? imbAfter - imbBefore : null;
                return (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-blue-700">{ref.faction_1_name}</td>
                    <td className="px-2 py-3 text-center text-gray-500">vs</td>
                    <td className="px-4 py-3 font-semibold text-red-700">{ref.faction_2_name}</td>
                    {/* Before */}
                    <td className="px-3 py-3 text-center text-gray-500">{item.before ? Math.round(item.before.total_games) : '—'}</td>
                    <td className="px-3 py-3 text-center">
                      {item.before ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">{item.before.faction_1_winrate.toFixed(1)}%</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {imbBefore != null ? <span className={`px-2 py-0.5 rounded font-semibold text-xs ${getImbalanceColor(imbBefore)}`}>{imbBefore.toFixed(1)}%</span> : <span className="text-gray-400">—</span>}
                    </td>
                    {/* After */}
                    <td className="px-3 py-3 text-center text-gray-700 font-semibold">{item.after ? Math.round(item.after.total_games) : '—'}</td>
                    <td className="px-3 py-3 text-center">
                      {item.after ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">{item.after.faction_1_winrate.toFixed(1)}%</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {imbAfter != null ? <span className={`px-2 py-0.5 rounded font-semibold text-xs ${getImbalanceColor(imbAfter)}`}>{imbAfter.toFixed(1)}%</span> : <span className="text-gray-400">—</span>}
                    </td>
                    {/* Delta */}
                    <td className="px-3 py-3 text-center">
                      {delta != null ? (
                        <span className={`px-2 py-0.5 rounded font-semibold text-sm ${delta < -2 ? 'bg-green-100 text-green-700' : delta > 2 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                          {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ─── Normal global view ─── */
  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">
        {t('faction_vs_faction_analysis') || 'Faction vs Faction Analysis'}
      </h3>

      <div className="mb-6 flex items-center gap-4">
        <label className="text-sm font-semibold text-gray-700">{t('minimum_games') || 'Minimum Games:'}</label>
        <input
          type="number" value={minGames}
          onChange={(e) => setMinGames(parseInt(e.target.value) || minGamesThreshold)}
          min={1} max={100}
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">{filteredStats.length} {t('matchups') || 'matchups'}</span>
      </div>

      {filteredStats.length === 0 ? (
        <div className="text-center py-8 text-gray-600 bg-gray-50 rounded-lg">{t('no_data_available') || 'No data available'}</div>
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
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('side1_winrate') || 'F1 S1 WR'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('side2_winrate') || 'F1 S2 WR'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('faction_2_wins') || 'F2 Wins'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('faction_2_winrate') || 'F2 WR'}</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-800">{t('imbalance') || 'Imbalance'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredStats.map((stat, idx) => (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 text-center font-semibold text-blue-700">{stat.faction_1_name}</td>
                  <td className="px-4 py-3 text-center text-gray-500 font-semibold">vs</td>
                  <td className="px-4 py-3 font-semibold text-red-700">{stat.faction_2_name}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{Math.round(stat.total_games)}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{Math.round(stat.faction_1_wins)}</td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-semibold">{stat.faction_1_winrate.toFixed(1)}%</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {stat.f1_side1_winrate != null ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${stat.f1_side1_winrate > 55 ? 'bg-green-100 text-green-700' : stat.f1_side1_winrate < 45 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {stat.f1_side1_winrate.toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-400">{stat.side1_games}g</span>
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {stat.f1_side2_winrate != null ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${stat.f1_side2_winrate > 55 ? 'bg-green-100 text-green-700' : stat.f1_side2_winrate < 45 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          {stat.f1_side2_winrate.toFixed(1)}%
                        </span>
                        <span className="text-xs text-gray-400">{stat.side2_games}g</span>
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{Math.round(stat.faction_2_wins)}</td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span className="px-2 py-1 bg-red-50 text-red-700 rounded font-semibold">{stat.faction_2_winrate.toFixed(1)}%</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-3 py-1 rounded-lg font-semibold inline-block text-sm ${getImbalanceColor(stat.imbalance)}`}>
                      {stat.imbalance.toFixed(1)}%
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
