import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playerStatisticsService } from '../services/playerStatisticsService';
import '../styles/PlayerStats.css';

interface FactionStats {
  faction_id: string;
  faction_name: string;
  total_games: number;
  wins: number;
  losses: number;
  winrate: number;
  avg_elo_change: number;
}

interface Props {
  playerId: string;
}

const PlayerStatsByFaction: React.FC<Props> = ({ playerId }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<FactionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minGames, setMinGames] = useState(2);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await playerStatisticsService.getStatsByFaction(playerId, minGames);
        // Convert string numbers to actual numbers
        const converted = data.map((item: any) => ({
          ...item,
          winrate: typeof item.winrate === 'string' ? parseFloat(item.winrate) : item.winrate,
          avg_elo_change: typeof item.avg_elo_change === 'string' ? parseFloat(item.avg_elo_change) : item.avg_elo_change,
        }));
        setStats(converted);
      } catch (err) {
        console.error('Error fetching faction stats:', err);
        setError('Error loading faction statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [playerId, minGames]);

  if (loading) return <div className="stats-container"><p>{t('loading')}</p></div>;
  if (error) return <div className="stats-container error"><p>{error}</p></div>;

  return (
    <div className="player-stats-section">
      <h3>{t('performance_by_faction') || 'Performance by Faction'}</h3>
      
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

      {stats.length === 0 ? (
        <p className="no-data">{t('no_data')}</p>
      ) : (
        <div className="stats-table-container">
          <table className="stats-table">
            <thead>
              <tr>
                <th>{t('faction') || 'Faction'}</th>
                <th>{t('total_games') || 'Games'}</th>
                <th>{t('record') || 'Record'}</th>
                <th>{t('winrate') || 'Win Rate'}</th>
                <th>{t('avg_elo_change') || 'Avg ELO'}</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.faction_id}>
                  <td className="faction-name">{stat.faction_name}</td>
                  <td>{stat.total_games}</td>
                  <td>
                    <span className="record">
                      <span className="winning">{stat.wins}W</span>
                      <span className="losing">{stat.losses}L</span>
                    </span>
                  </td>
                  <td>
                    <span className={`winrate ${
                      stat.winrate > 55 ? 'high' : 
                      stat.winrate < 45 ? 'low' : 
                      'balanced'
                    }`}>
                      {stat.winrate.toFixed(1)}%
                    </span>
                  </td>
                  <td className={stat.avg_elo_change > 0 ? 'winning' : stat.avg_elo_change < 0 ? 'losing' : ''}>
                    {stat.avg_elo_change > 0 ? '+' : ''}{stat.avg_elo_change.toFixed(1)}
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

export default PlayerStatsByFaction;
