import React from 'react';
import { useTranslation } from 'react-i18next';
import { getLevelTranslationKey } from '../utils/levelTranslation';
import '../styles/ProfileStats.css';

interface ProfileStatsProps {
  player: {
    nickname: string;
    elo_rating: number;
    is_rated: boolean;
    level?: string;
    matches_played: number;
    total_wins: number;
    total_losses: number;
    trend?: string;
    avg_elo_change?: number;
    is_active?: boolean;
    last_activity?: string;
  };
}

const ProfileStats: React.FC<ProfileStatsProps> = ({ player }) => {
  const { t, i18n } = useTranslation();
  const totalMatches = player.matches_played || 0;
  const decidedMatches = (player.total_wins || 0) + (player.total_losses || 0);
  const winPercentage = decidedMatches > 0 ? Math.round(((player.total_wins || 0) / decidedMatches) * 100) : 0;

  // Debug: log player data
  console.log('ProfileStats player data:', player);
  if (player.last_activity) {
    console.log('last_activity value:', player.last_activity, 'type:', typeof player.last_activity);
  }

  return (
    <div className="profile-stats-container">
      <div className="profile-header">
        <div className="nickname-section">
          <h1>{player.nickname}</h1>
          <div className="header-meta">
            <span className={`rating-status ${player.is_rated ? 'rated' : 'unrated'}`}>
              {player.is_rated ? `★ ${t('rated')}` : `☆ ${t('unrated')}`}
            </span>
            {player.is_active !== undefined && (
              <span className={`activity-status ${player.is_active ? 'active' : 'inactive'}`}>
                {player.is_active ? t('status_active') : t('status_inactive')}
              </span>
            )}
            {player.last_activity && (
              <span className="last-activity-text">
                {t('last_activity')}: {new Date(player.last_activity).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('label_elo')}</div>
          <div className="stat-value elo-badge">
            {player.elo_rating}
          </div>
          {player.level && <div className="stat-detail">{t(getLevelTranslationKey(player.level))}</div>}
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('label_trend')}</div>
          <div className={`stat-value trend-badge ${player.trend?.startsWith('+') ? 'positive' : player.trend?.startsWith('-') && player.trend !== '-' ? 'negative' : 'neutral'}`}>
            {player.trend || '-'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('label_total_matches')}</div>
          <div className="stat-value">{totalMatches}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('label_wins')}</div>
          <div className="stat-value wins-color">{player.total_wins || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('label_losses')}</div>
          <div className="stat-value losses-color">{player.total_losses || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('label_win_pct')}</div>
          <div className="stat-value">{winPercentage}%</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('label_record')}</div>
          <div className="stat-value record">
            {player.total_wins || 0}-{player.total_losses || 0}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">{t('label_avg_elo_change') || 'Avg ELO Change'}</div>
          <div className={`stat-value ${(player.avg_elo_change || 0) >= 0 ? 'positive-change' : 'negative-change'}`}>
            {(player.avg_elo_change || 0) >= 0 ? '+' : ''}{Number(player.avg_elo_change || 0).toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileStats;
