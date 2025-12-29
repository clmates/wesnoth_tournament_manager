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

  const aggregateMatchupData = (data: ComparisonData[]): MatchupStats[] => {
    const matchupMap = new Map<string, ComparisonData[]>();
    
    data.forEach(item => {
      // Create a normalized key (always same order for consistency)
      const f1 = item.faction_id || '';
      const f2 = item.opponent_faction_id || '';
      const ordered = [f1, f2].sort();
      const key = `${item.map_id}|${ordered[0]}|${ordered[1]}`;
      
      if (!matchupMap.has(key)) {
        matchupMap.set(key, []);
      }
      matchupMap.get(key)!.push(item);
    });
    
    const results: MatchupStats[] = [];
    
    matchupMap.forEach((matchups, key) => {
      matchups.forEach(item => {
        const mapId = item.map_id || '';
        const mapName = item.map_name || '';
        const f1Id = item.faction_id || '';
        const f1Name = item.faction_name || '';
        const f2Id = item.opponent_faction_id || '';
        const f2Name = item.opponent_faction_name || '';
        
        const totalGames = item.total_games;
        const f1Wins = item.wins;
        const f2Wins = item.losses;
        const f1Winrate = totalGames > 0 ? (f1Wins / totalGames) * 100 : 0;
        const imbalance = Math.abs(f1Winrate - 50);
        
        results.push({
          map_id: mapId,
          map_name: mapName,
          faction_1_id: f1Id,
          faction_1_name: f1Name,
          faction_2_id: f2Id,
          faction_2_name: f2Name,
          total_games: totalGames,
          faction_1_wins: f1Wins,
          faction_2_wins: f2Wins,
          faction_1_winrate: f1Winrate,
          imbalance,
        });
      });
    });
    
    return results.sort((a, b) => b.imbalance - a.imbalance);
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await statisticsService.getMatchupStats(minGames);
        // Convert string numbers to actual numbers
        const converted = data.map((item: any) => ({
          ...item,
          faction_1_winrate: typeof item.faction_1_winrate === 'string' ? parseFloat(item.faction_1_winrate) : item.faction_1_winrate,
          imbalance: typeof item.imbalance === 'string' ? parseFloat(item.imbalance) : item.imbalance,
        }));
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
      setBeforeStats(aggregateMatchupData(beforeData));
    } else {
      setBeforeStats([]);
    }
  }, [beforeData]);

  useEffect(() => {
    if (afterData && afterData.length > 0) {
      setAfterStats(aggregateMatchupData(afterData));
    } else {
      setAfterStats([]);
    }
  }, [afterData]);

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;

  const showComparison = beforeStats.length > 0 || afterStats.length > 0;
  const filteredStats = stats.filter(s => s.total_games >= minGames);

  return (
    <div className="balance-stats">
      <h3>{t('unbalanced_matchups') || 'Unbalanced Matchups'}</h3>
      <p className="explanation">{t('matchup_balance_explanation') || 'Analysis of specific faction matchups showing imbalance'}</p>
      
      {!showComparison && (
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
      )}

      {showComparison ? (
        <div className="comparison-blocks">
          {beforeStats.length > 0 && (
            <div className="before-block">
              <h4>{t('before_event') || 'Before Event'}</h4>
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
                    {beforeStats.map((stat, idx) => (
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
                            {stat.imbalance.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {afterStats.length > 0 && (
            <div className="after-block">
              <h4>{t('after_event') || 'After Event'}</h4>
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
                    {afterStats.map((stat, idx) => (
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
                            {stat.imbalance.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
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
                      {stat.imbalance.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!showComparison && stats.length === 0 && (
        <p className="no-data">{t('no_data_available') || 'No data available for the selected criteria'}</p>
      )}
    </div>
  );
};

export default MatchupBalanceTab;
