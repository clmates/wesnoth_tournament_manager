import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { statisticsService } from '../services/statisticsService';
import '../styles/BalanceStatistics.css';

interface MatchupStats {
  map_id: string;
  map_name: string;
  faction_1_id: string;
  faction_1_name: string;
  faction_2_id: string;
  faction_2_name: string;
  total_games: number;
  faction_1_wins: number;
  faction_2_wins: number;
  faction_1_winrate: number;
  imbalance: number;
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

const MatchupBalanceTab: React.FC<{ beforeData?: any; afterData?: any }> = ({ beforeData = null, afterData = null }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<MatchupStats[]>([]);
  const [beforeStats, setBeforeStats] = useState<MatchupStats[]>([]);
  const [afterStats, setAfterStats] = useState<MatchupStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minGames, setMinGames] = useState(5);
  const [minGamesThreshold, setMinGamesThreshold] = useState(5); // Default value

  const aggregateMatchupData = (data: ComparisonData[]): MatchupStats[] => {
    console.log('[MatchupBalanceTab] Input data count:', data.length);
    console.log('[MatchupBalanceTab] Raw input sample:', JSON.stringify(data.slice(0, 3), null, 2));
    
    // Group by normalized matchup (map + normalized faction order)
    // Each match appears twice in data (once for each faction), but we need to aggregate them
    const matchupMap = new Map<string, {
      map_id: string;
      map_name: string;
      f1_id: string;
      f1_name: string;
      f2_id: string;
      f2_name: string;
      f1_wins: number;
      f2_wins: number;
      total_games: number;
    }>();
    
    data.forEach(item => {
      const f1 = item.faction_id || '';
      const f2 = item.opponent_faction_id || '';
      
      // Normalize faction order
      const ordered = [f1, f2].sort();
      const isOriginalOrder = f1 === ordered[0];
      
      const f1Wins = isOriginalOrder ? item.wins : item.losses;
      const f2Wins = isOriginalOrder ? item.losses : item.wins;
      
      const mapKey = `${item.map_id}|${ordered[0]}|${ordered[1]}`;
      
      const existing = matchupMap.get(mapKey);
      
      if (!existing) {
        // First occurrence - create entry
        matchupMap.set(mapKey, {
          map_id: item.map_id || '',
          map_name: item.map_name || '',
          f1_id: ordered[0],
          f1_name: (isOriginalOrder ? item.faction_name : item.opponent_faction_name) || '',
          f2_id: ordered[1],
          f2_name: (isOriginalOrder ? item.opponent_faction_name : item.faction_name) || '',
          f1_wins: f1Wins,
          f2_wins: f2Wins,
          total_games: item.total_games,
        });
      } else {
        // Aggregate data from the duplicate entry (same matchup, opposite faction order)
        existing.f1_wins += f1Wins;
        existing.f2_wins += f2Wins;
        existing.total_games += item.total_games;
      }
    });
    
    const results: MatchupStats[] = Array.from(matchupMap.values()).map(matchup => {
      const totalGames = matchup.total_games / 2; // Divide by 2 because each game counted twice
      const f1Wins = matchup.f1_wins / 2; // Divide wins by 2 as well since they're counted twice
      const f2Wins = matchup.f2_wins / 2;
      const f1Winrate = totalGames > 0 ? (f1Wins / totalGames) * 100 : 0;
      // Imbalance as percentage: (|wins - losses| / total_games) * 100
      // For 7-0: (7/7)*100 = 100%, for 4-3: (1/7)*100 = 14.3%, for 3.5-3.5: 0%
      const imbalance = totalGames > 0 ? (Math.abs(f1Wins - f2Wins) / totalGames) * 100 : 0;
      
      console.log(`[MatchupBalanceTab] ${matchup.f1_name} vs ${matchup.f2_name}: f1_wins=${f1Wins}, f2_wins=${f2Wins}, total=${totalGames}, imbalance=${imbalance.toFixed(2)}%`);
      
      return {
        map_id: matchup.map_id,
        map_name: matchup.map_name,
        faction_1_id: matchup.f1_id,
        faction_1_name: matchup.f1_name,
        faction_2_id: matchup.f2_id,
        faction_2_name: matchup.f2_name,
        total_games: totalGames,
        faction_1_wins: f1Wins,
        faction_2_wins: f2Wins,
        faction_1_winrate: f1Winrate,
        imbalance,
      };
    });
    
    console.log('[MatchupBalanceTab] Final aggregated result:', JSON.stringify(results, null, 2));
    
    return results
      .filter(m => m.total_games >= minGamesThreshold) // Apply minimum games filter
      .sort((a, b) => b.imbalance - a.imbalance);
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
        const data = await statisticsService.getMatchupStats(minGames);
        console.log('[MatchupBalanceTab] Backend data received:', JSON.stringify(data.slice(0, 3), null, 2));
        // Convert string numbers to actual numbers
        const converted = data.map((item: any) => ({
          ...item,
          faction_1_winrate: typeof item.faction_1_winrate === 'string' ? parseFloat(item.faction_1_winrate) : item.faction_1_winrate,
          imbalance: typeof item.imbalance === 'string' ? parseFloat(item.imbalance) : item.imbalance,
        }));
        console.log('[MatchupBalanceTab] Backend data converted:', JSON.stringify(converted.slice(0, 3), null, 2));
        setStats(converted);
      } catch (err) {
        console.error('Error fetching matchup stats:', err);
        setError('Error loading matchup statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [minGames]);

  useEffect(() => {
    if (beforeData && beforeData.length > 0) {
      console.log('[MatchupBalanceTab] Before data received, item count:', beforeData.length);
      console.log('[MatchupBalanceTab] Before data sample:', JSON.stringify(beforeData.slice(0, 2), null, 2));
      const aggregated = aggregateMatchupData(beforeData);
      setBeforeStats(aggregated);
    } else {
      console.log('[MatchupBalanceTab] Before data: EMPTY or NULL', { beforeData: beforeData?.length || 'null' });
      setBeforeStats([]);
    }
  }, [beforeData]);

  useEffect(() => {
    if (afterData && afterData.length > 0) {
      console.log('[MatchupBalanceTab] After data received, item count:', afterData.length);
      console.log('[MatchupBalanceTab] After data sample:', JSON.stringify(afterData.slice(0, 2), null, 2));
      const aggregated = aggregateMatchupData(afterData);
      setAfterStats(aggregated);
    } else {
      console.log('[MatchupBalanceTab] After data: EMPTY or NULL', { afterData: afterData?.length || 'null' });
      setAfterStats([]);
    }
  }, [afterData]);

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;

  const showComparison = beforeStats.length > 0 || afterStats.length > 0;
  const filteredStats = stats.filter(s => s.total_games >= minGames);

  if (showComparison) {
    // Create combined view
    const allMatchupIds = new Set([
      ...beforeStats.map(m => `${m.map_id}|${m.faction_1_id}|${m.faction_2_id}`),
      ...afterStats.map(m => `${m.map_id}|${m.faction_1_id}|${m.faction_2_id}`)
    ]);
    
    const beforeMap = new Map(beforeStats.map(m => [`${m.map_id}|${m.faction_1_id}|${m.faction_2_id}`, m]));
    const afterMap = new Map(afterStats.map(m => [`${m.map_id}|${m.faction_1_id}|${m.faction_2_id}`, m]));
    
    const combined = Array.from(allMatchupIds)
      .map(matchupId => {
        const before = beforeMap.get(matchupId);
        const after = afterMap.get(matchupId);
        return {
          matchup_id: matchupId,
          before,
          after,
        };
      })
      .filter(item => item.after || item.before)
      .sort((a, b) => {
        const aImbalance = Math.max(a.after?.imbalance || 0, a.before?.imbalance || 0);
        const bImbalance = Math.max(b.after?.imbalance || 0, b.before?.imbalance || 0);
        return bImbalance - aImbalance;
      });

    return (
      <div className="balance-stats">
        <h3>{t('unbalanced_matchups_comparison') || 'Unbalanced Matchups - Before & After'}</h3>
        <p className="block-info">
          {t('before_event') || 'Before'}: {beforeData ? beforeData.reduce((sum: number, d: ComparisonData) => sum + d.total_games, 0) : 0} {t('matches_evaluated') || 'matches'} | 
          {t('after_event') || 'After'}: {afterData ? afterData.reduce((sum: number, d: ComparisonData) => sum + d.total_games, 0) : 0} {t('matches_evaluated') || 'matches'}
        </p>

        <div className="stats-table-container">
          <table className="stats-table comparison-mode">
            <thead>
              <tr>
                <th>{t('map') || 'Map'}</th>
                <th>{t('faction_1') || 'Faction 1'}</th>
                <th>{t('vs')}</th>
                <th>{t('faction_2') || 'Faction 2'}</th>
                <th>{t('total_games') || 'Games'}</th>
                <th>{t('faction_1_wins') || 'F1 Wins'}</th>
                <th>{t('faction_2_wins') || 'F2 Wins'}</th>
                <th>{t('imbalance') || 'Imbalance'}</th>
              </tr>
            </thead>
            <tbody>
              {combined.map((item, idx) => {
                const stat = item.after || item.before;
                if (!stat) return null;
                return (
                  <tr key={`${stat.map_id}-${idx}`} className="comparison-row">
                    <td className="map-name">
                      <div className="comparison-cell">
                        <div className="after-value">{stat.map_name}</div>
                      </div>
                    </td>
                    <td className="faction-name faction-1">
                      <div className="comparison-cell">
                        <div className="after-value">{stat.faction_1_name}</div>
                      </div>
                    </td>
                    <td className="vs">
                      <div className="comparison-cell">
                        <div className="after-value">vs</div>
                      </div>
                    </td>
                    <td className="faction-name faction-2">
                      <div className="comparison-cell">
                        <div className="after-value">{stat.faction_2_name}</div>
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
                        <div className="after-value">{item.after?.faction_1_wins || '-'}</div>
                        {item.before && <div className="before-value">{item.before.faction_1_wins}</div>}
                      </div>
                    </td>
                    <td>
                      <div className="comparison-cell">
                        <div className="after-value">{item.after?.faction_2_wins || '-'}</div>
                        {item.before && <div className="before-value">{item.before.faction_2_wins}</div>}
                      </div>
                    </td>
                    <td>
                      <div className="comparison-cell">
                        <div className="after-value">
                          <span className={`imbalance-badge ${
                            (item.after?.imbalance || 0) > 10 ? 'severe' : 
                            (item.after?.imbalance || 0) > 5 ? 'high' : 
                            'moderate'
                          }`}>
                            {item.after?.imbalance.toFixed(1) || '-'}%
                          </span>
                        </div>
                        {item.before && (
                          <div className="before-value">
                            <span className={`imbalance-badge ${
                              item.before.imbalance > 10 ? 'severe' : 
                              item.before.imbalance > 5 ? 'high' : 
                              'moderate'
                            }`}>
                              {item.before.imbalance.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
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

  // Default global view
  return (
    <div className="balance-stats">
      <h3>{t('unbalanced_matchups') || 'Unbalanced Matchups'}</h3>
      <p className="explanation">{t('matchup_balance_explanation') || 'Analysis of specific faction matchups showing imbalance'}</p>
      
      <div className="filter-controls">
        <label>
          {t('minimum_games') || 'Minimum Games'}:
          <input 
            type="number" 
            min="1" 
            max="100" 
            value={minGames}
            onChange={(e) => setMinGames(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </label>
      </div>

      <div className="stats-table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>{t('map') || 'Map'}</th>
              <th>{t('faction_1') || 'Faction 1'}</th>
              <th>{t('vs')}</th>
              <th>{t('faction_2') || 'Faction 2'}</th>
              <th>{t('total_games') || 'Games'}</th>
              <th>{t('faction_1_wins') || 'F1 Wins'}</th>
              <th>{t('faction_2_wins') || 'F2 Wins'}</th>
              <th>{t('imbalance') || 'Imbalance'}</th>
            </tr>
          </thead>
          <tbody>
            {filteredStats.map((stat, idx) => (
              <tr key={`${stat.map_id}-${stat.faction_1_id}-${stat.faction_2_id}-${idx}`}>
                <td className="map-name">{stat.map_name}</td>
                <td className="faction-name faction-1">
                  {stat.faction_1_name}
                  <span className="winrate-small">({stat.faction_1_winrate.toFixed(1)}%)</span>
                </td>
                <td className="vs">vs</td>
                <td className="faction-name faction-2">
                  {stat.faction_2_name}
                  <span className="winrate-small">({(100 - stat.faction_1_winrate).toFixed(1)}%)</span>
                </td>
                <td>{stat.total_games}</td>
                <td className="win-count">
                  <span className={stat.faction_1_wins > stat.faction_2_wins ? 'higher' : ''}>
                    {stat.faction_1_wins}
                  </span>
                </td>
                <td className="win-count">
                  <span className={stat.faction_2_wins > stat.faction_1_wins ? 'higher' : ''}>
                    {stat.faction_2_wins}
                  </span>
                </td>
                <td>
                  <span className={`imbalance-badge ${
                    stat.imbalance > 10 ? 'severe' : 
                    stat.imbalance > 5 ? 'high' : 
                    'moderate'
                  }`}>
                    {stat.total_games > 0 ? ((stat.imbalance / stat.total_games) * 100).toFixed(1) : stat.imbalance.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showComparison && stats.length === 0 && (
        <p className="no-data">{t('no_data_available') || 'No data available for the selected criteria'}</p>
      )}
    </div>
  );
};

export default MatchupBalanceTab;
