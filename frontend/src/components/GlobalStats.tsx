import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { publicService } from '../services/api';

interface GlobalStatistics {
  users_total: number;
  users_active: number;
  users_ranked: number;
  users_new_month: number;
  users_new_year: number;
  matches_today: number;
  matches_week: number;
  matches_month: number;
  matches_year: number;
  matches_total: number;
  tournament_matches_month: number;
  tournament_matches_year: number;
  tournament_matches_total: number;
  tournaments_month: number;
  tournaments_year: number;
  tournaments_total: number;
  last_updated: string;
}

interface StatCardProps {
  label: string;
  value: number;
  icon?: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon = '📊', color = 'blue' }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    orange: 'bg-orange-50 border-orange-200 text-orange-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };

  return (
    <div className={`${colorMap[color]} border rounded-lg p-4`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-600 truncate">{label}</div>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
};

const GlobalStats: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<GlobalStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await publicService.getGlobalStatistics();
        setStats(response.data);
      } catch (err) {
        console.error('Error fetching global statistics:', err);
        setError(t('error_loading_statistics') || 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalStats();

    // Refresh every 10 minutes
    const interval = setInterval(fetchGlobalStats, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [t]);

  if (loading) {
    return (
      <section className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t('global_statistics') || 'Site Statistics'}</h3>
        <div className="text-center text-gray-600">{t('loading')}</div>
      </section>
    );
  }

  if (error || !stats) {
    return (
      <section className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t('global_statistics') || 'Site Statistics'}</h3>
        <div className="text-center text-red-600 text-sm">{error}</div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">{t('global_statistics') || 'Site Statistics'}</h3>

      {/* Users Section */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">{t('users') || 'Users'}</h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label={t('total') || 'Total'} value={stats.users_total} icon="👥" color="blue" />
          <StatCard label={t('active') || 'Active'} value={stats.users_active} icon="✅" color="green" />
          <StatCard label={t('ranked') || 'Ranked'} value={stats.users_ranked} icon="⭐" color="purple" />
          <StatCard label={`${t('new') || 'New'} (${t('month')})`} value={stats.users_new_month} icon="🆕" color="orange" />
          <StatCard label={`${t('new') || 'New'} (${t('year')})`} value={stats.users_new_year} icon="📅" color="orange" />
        </div>
      </div>

      {/* Ranked Matches Section */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">{t('ranked_matches') || 'Ranked Matches'}</h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label={t('today') || 'Today'} value={stats.matches_today} icon="🎮" color="blue" />
          <StatCard label={t('week') || 'Week'} value={stats.matches_week} icon="📊" color="green" />
          <StatCard label={t('month') || 'Month'} value={stats.matches_month} icon="📅" color="purple" />
          <StatCard label={t('year') || 'Year'} value={stats.matches_year} icon="📈" color="orange" />
          <StatCard label={t('total') || 'Total'} value={stats.matches_total} icon="🏆" color="red" />
        </div>
      </div>

      {/* Tournament Matches Section */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">{t('tournament_matches') || 'Tournament Matches'}</h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label={`${t('month') || 'Month'}`} value={stats.tournament_matches_month} icon="🎯" color="blue" />
          <StatCard label={`${t('year') || 'Year'}`} value={stats.tournament_matches_year} icon="📅" color="green" />
          <StatCard label={t('total') || 'Total'} value={stats.tournament_matches_total} icon="🏅" color="purple" />
        </div>
      </div>

      {/* Tournaments Section */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">{t('tournaments') || 'Tournaments'}</h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label={`${t('month') || 'Month'}`} value={stats.tournaments_month} icon="🎪" color="blue" />
          <StatCard label={`${t('year') || 'Year'}`} value={stats.tournaments_year} icon="📅" color="green" />
          <StatCard label={t('total') || 'Total'} value={stats.tournaments_total} icon="👑" color="purple" />
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-xs text-gray-500 text-right mt-4">
        {t('last_updated') || 'Last updated'}: {new Date(stats.last_updated).toLocaleTimeString()}
      </div>
    </section>
  );
};

export default GlobalStats;
