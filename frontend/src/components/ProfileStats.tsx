import React from 'react';
import { useTranslation } from 'react-i18next';
import { getLevelTranslationKey } from '../utils/levelTranslation';
import UserBadge from './UserBadge';

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
    country?: string;
    avatar?: string;
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
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-start gap-8 mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">{player.nickname}</h1>
          <div className="flex gap-4 flex-wrap">
            <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${player.is_rated ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {player.is_rated ? `★ ${t('rated')}` : `☆ ${t('unrated')}`}
            </span>
            {player.is_active !== undefined && (
              <span className={`inline-block px-3 py-1 rounded text-sm font-semibold ${player.is_active ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                {player.is_active ? t('status_active') : t('status_inactive')}
              </span>
            )}
            {player.last_activity && (
              <span className="text-sm text-gray-600">
                {t('last_activity')}: {new Date(player.last_activity).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        {(player.country || player.avatar) && (
          <div className="flex-shrink-0">
            <UserBadge
              country={player.country}
              avatar={player.avatar}
              username={player.nickname}
              size="large"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm font-semibold text-gray-600 mb-2">{t('label_elo')}</div>
          <div className="text-3xl font-bold text-blue-600">
            {player.elo_rating}
          </div>
          {player.level && <div className="text-xs text-gray-500 mt-2">{t(getLevelTranslationKey(player.level))}</div>}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm font-semibold text-gray-600 mb-2">{t('label_trend')}</div>
          <div className={`text-3xl font-bold ${player.trend?.startsWith('+') ? 'text-green-600' : player.trend?.startsWith('-') && player.trend !== '-' ? 'text-red-600' : 'text-gray-600'}`}>
            {player.trend || '-'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm font-semibold text-gray-600 mb-2">{t('label_total_matches')}</div>
          <div className="text-3xl font-bold text-gray-800">{totalMatches}</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm font-semibold text-gray-600 mb-2">{t('label_wins')}</div>
          <div className="text-3xl font-bold text-green-600">{player.total_wins || 0}</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm font-semibold text-gray-600 mb-2">{t('label_losses')}</div>
          <div className="text-3xl font-bold text-red-600">{player.total_losses || 0}</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm font-semibold text-gray-600 mb-2">{t('label_win_pct')}</div>
          <div className="text-3xl font-bold text-gray-800">{winPercentage}%</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm font-semibold text-gray-600 mb-2">{t('label_record')}</div>
          <div className="text-3xl font-bold text-gray-800">
            {player.total_wins || 0}-{player.total_losses || 0}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-sm font-semibold text-gray-600 mb-2">{t('label_avg_elo_change') || 'Avg ELO Change'}</div>
          <div className={`text-3xl font-bold ${(player.avg_elo_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {(player.avg_elo_change || 0) >= 0 ? '+' : ''}{Number(player.avg_elo_change || 0).toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileStats;
