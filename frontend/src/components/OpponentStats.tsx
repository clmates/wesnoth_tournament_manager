import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PlayerLink from './PlayerLink';
import { playerStatisticsService } from '../services/playerStatisticsService';
import '../styles/OpponentStats.css';

interface RecentOpponent {
  opponent_id: string;
  opponent_name: string;
  total_games: number;
  wins: number;
  losses: number;
  winrate: number | string;
  current_elo: number;
  elo_gained: number | string;
  elo_lost: number | string;
  last_elo_against_me: number | string;
  last_match_date: string;
}

interface OpponentStatsProps {
  matches: any[];
  currentPlayerId: string;
}

const OpponentStats: React.FC<OpponentStatsProps> = ({ matches, currentPlayerId }) => {
  const { t } = useTranslation();
  const [opponents, setOpponents] = useState<RecentOpponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOpponents = async () => {
      try {
        setLoading(true);
        const data = await playerStatisticsService.getRecentOpponents(currentPlayerId, 100);
        setOpponents(data || []);
      } catch (err) {
        console.error('Error fetching recent opponents:', err);
        setError('Error loading opponent data');
      } finally {
        setLoading(false);
      }
    };

    if (currentPlayerId) {
      fetchOpponents();
    }
  }, [currentPlayerId]);


  if (loading) {
    return (
      <div className="opponent-stats-container">
        <h3>{t('my_opponents') || 'My Opponents'}</h3>
        <div className="no-data-message">{t('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="opponent-stats-container">
        <h3>{t('my_opponents') || 'My Opponents'}</h3>
        <div className="no-data-message">{error}</div>
      </div>
    );
  }

  if (opponents.length === 0) {
    return (
      <div className="opponent-stats-container">
        <h3>{t('my_opponents') || 'My Opponents'}</h3>
        <div className="no-data-message">{t('no_opponent_data') || 'No opponent data available'}</div>
      </div>
    );
  }

  return (
    <div className="opponent-stats-container">
      <h3>{t('my_opponents') || 'My Opponents'}</h3>
      
      <div className="opponent-stats-wrapper">
        <table className="opponent-stats-table">
          <thead>
            <tr>
              <th>{t('opponent_name') || 'Opponent'}</th>
              <th className="numeric">{t('games') || 'Games'}</th>
              <th className="numeric">{t('wins') || 'Wins'}</th>
              <th className="numeric">{t('losses') || 'Losses'}</th>
              <th className="numeric">{t('winrate') || 'W/R %'}</th>
              <th className="numeric">{t('current_elo') || 'Current ELO'}</th>
              <th className="numeric">ELO Gained</th>
              <th className="numeric">ELO Lost</th>
              <th className="numeric">Last ELO vs Me</th>
              <th>{t('last_match') || 'Last Match'}</th>
            </tr>
          </thead>
          <tbody>
            {opponents.map((opponent) => {
              const winrate = typeof opponent.winrate === 'string' ? parseFloat(opponent.winrate) : opponent.winrate;
              const eloGained = typeof opponent.elo_gained === 'string' ? parseFloat(opponent.elo_gained) : opponent.elo_gained;
              const eloLost = typeof opponent.elo_lost === 'string' ? parseFloat(opponent.elo_lost) : opponent.elo_lost;
              const lastEloAgainstMe = typeof opponent.last_elo_against_me === 'string' ? parseFloat(opponent.last_elo_against_me) : opponent.last_elo_against_me;

              return (
                <tr key={opponent.opponent_id} className="opponent-row">
                  <td className="opponent-name">
                    <span className="name"><PlayerLink nickname={opponent.opponent_name} userId={opponent.opponent_id} /></span>
                  </td>
                  <td className="numeric">
                    <strong>{opponent.total_games}</strong>
                  </td>
                  <td className="numeric">
                    <span className="wins-badge">{opponent.wins}</span>
                  </td>
                  <td className="numeric">
                    <span className="losses-badge">{opponent.losses}</span>
                  </td>
                  <td className="numeric">
                    <span className={`percentage-badge ${winrate > 55 ? 'positive' : winrate < 45 ? 'negative' : ''}`}>
                      {winrate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="numeric">
                    <span className="elo-badge">{opponent.current_elo}</span>
                  </td>
                  <td className="numeric">
                    <span className="elo-positive">+{eloGained.toFixed(2)}</span>
                  </td>
                  <td className="numeric">
                    <span className="elo-negative">-{eloLost.toFixed(2)}</span>
                  </td>
                  <td className="numeric">
                    <span className="elo-value">{lastEloAgainstMe.toFixed(0)}</span>
                  </td>
                  <td>
                    <span className="date">{new Date(opponent.last_match_date).toLocaleDateString()}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OpponentStats;
