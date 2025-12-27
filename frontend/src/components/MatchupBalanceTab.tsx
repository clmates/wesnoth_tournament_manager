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

const MatchupBalanceTab: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<MatchupStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minGames, setMinGames] = useState(5);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await statisticsService.getMatchupStats(minGames);
        setStats(data);
      } catch (err) {
        console.error('Error fetching matchup stats:', err);
        setError('Error loading matchup statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [minGames]);

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;

  return (
    <div className="balance-stats">
      <h3>{t('unbalanced_matchups') || 'Unbalanced Matchups'}</h3>
      
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
            {stats.map((stat, idx) => (
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
                    {stat.imbalance}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats.length === 0 && (
        <p className="no-data">{t('no_data_available') || 'No data available for the selected criteria'}</p>
      )}
    </div>
  );
};

export default MatchupBalanceTab;
