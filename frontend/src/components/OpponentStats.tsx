import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PlayerLink from './PlayerLink';
import '../styles/OpponentStats.css';

interface OpponentStatItem {
  opponentId: string;
  opponentName: string;
  currentElo: number;
  lastEloAgainstMe: number;
  winsAgainstMe: number;
  lossesAgainstMe: number;
  totalMatches: number;
  winPercentage: number;
  lossPercentage: number;
  eloGained: number;
  eloLost: number;
  lastMatchDate: string;
}

interface OpponentStatsProps {
  matches: any[];
  currentPlayerId: string;
}

const OpponentStats: React.FC<OpponentStatsProps> = ({ matches, currentPlayerId }) => {
  const { t } = useTranslation();

  const opponentStats = useMemo(() => {
    if (!matches || matches.length === 0) return [];

    const statsMap = new Map<string, any>();

    matches.forEach((match) => {
      const isWinner = match.winner_id === currentPlayerId;
      const opponent = isWinner ? match.loser_nickname : match.winner_nickname;
      const opponentId = isWinner ? match.loser_id : match.winner_id;
      const myElo = isWinner ? match.winner_elo_after : match.loser_elo_after;
      const opponentElo = isWinner ? match.loser_elo_after : match.winner_elo_after;
      const myEloBefore = isWinner ? match.winner_elo_before : match.loser_elo_before;
      const eloChange = myElo - myEloBefore;

      if (!statsMap.has(opponentId)) {
        statsMap.set(opponentId, {
          opponentId,
          opponentName: opponent,
          winsAgainstMe: 0,
          lossesAgainstMe: 0,
          eloGained: 0,
          eloLost: 0,
          lastMatchDate: new Date(match.created_at).toLocaleDateString(),
          currentElo: opponentElo,
          lastEloAgainstMe: isWinner ? match.loser_elo_after : match.winner_elo_after,
          lastMatchTimestamp: new Date(match.created_at).getTime(),
        });
      }

      const stats = statsMap.get(opponentId)!;
      if (isWinner) {
        stats.winsAgainstMe += 1;
        stats.eloGained += Math.abs(eloChange);
      } else {
        stats.lossesAgainstMe += 1;
        stats.eloLost += Math.abs(eloChange);
      }

      // Update last match info
      if (new Date(match.created_at).getTime() > stats.lastMatchTimestamp) {
        stats.lastMatchDate = new Date(match.created_at).toLocaleDateString();
        stats.lastMatchTimestamp = new Date(match.created_at).getTime();
        stats.currentElo = opponentElo;
      }
    });

    // Calculate percentages and sort
    return Array.from(statsMap.values())
      .map((stat) => ({
        ...stat,
        totalMatches: stat.winsAgainstMe + stat.lossesAgainstMe,
        winPercentage: Math.round(
          (stat.winsAgainstMe / (stat.winsAgainstMe + stat.lossesAgainstMe)) * 100
        ),
        lossPercentage: Math.round(
          (stat.lossesAgainstMe / (stat.winsAgainstMe + stat.lossesAgainstMe)) * 100
        ),
      }))
      .sort((a, b) => b.totalMatches - a.totalMatches);
  }, [matches, currentPlayerId]);

  if (opponentStats.length === 0) {
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
              <th className="numeric">{t('current_elo') || 'Current ELO'}</th>
              <th className="numeric">{t('last_elo') || 'Last ELO vs Me'}</th>
              <th className="numeric">{t('wins') || 'Wins'}</th>
              <th className="numeric">{t('losses') || 'Losses'}</th>
              <th className="numeric">{t('total_matches_label') || 'Total'}</th>
              <th className="numeric">{t('win_percentage') || 'Win %'}</th>
              <th className="numeric">{t('loss_percentage') || 'Loss %'}</th>
              <th className="numeric">{t('elo_gained') || 'ELO Gained'}</th>
              <th className="numeric">{t('elo_lost') || 'ELO Lost'}</th>
              <th>{t('last_match') || 'Last Match'}</th>
            </tr>
          </thead>
          <tbody>
            {opponentStats.map((stat) => (
              <tr key={stat.opponentId} className="opponent-row">
                <td className="opponent-name">
                  <span className="name"><PlayerLink nickname={stat.opponentName} userId={stat.opponentId} /></span>
                </td>
                <td className="numeric">
                  <span className="elo-badge">{stat.currentElo}</span>
                </td>
                <td className="numeric">
                  <span className="elo-value">{stat.lastEloAgainstMe}</span>
                </td>
                <td className="numeric">
                  <span className="wins-badge">{stat.winsAgainstMe}</span>
                </td>
                <td className="numeric">
                  <span className="losses-badge">{stat.lossesAgainstMe}</span>
                </td>
                <td className="numeric">
                  <strong>{stat.totalMatches}</strong>
                </td>
                <td className="numeric">
                  <span className="percentage-badge positive">{stat.winPercentage}%</span>
                </td>
                <td className="numeric">
                  <span className="percentage-badge negative">{stat.lossPercentage}%</span>
                </td>
                <td className="numeric">
                  <span className="elo-positive">+{stat.eloGained}</span>
                </td>
                <td className="numeric">
                  <span className="elo-negative">-{stat.eloLost}</span>
                </td>
                <td>
                  <span className="date">{stat.lastMatchDate}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OpponentStats;
