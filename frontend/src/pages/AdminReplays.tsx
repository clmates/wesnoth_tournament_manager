import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { adminService } from '../services/api';
import MainLayout from '../components/MainLayout';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  parsed: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  rejected: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-purple-100 text-purple-800',
  discarded: 'bg-gray-100 text-gray-600',
};

const AdminReplays: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isTournamentModerator } = useAuthStore();

  const [replays, setReplays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('new');
  const [discarding, setDiscarding] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || (!isAdmin && !isTournamentModerator)) {
      navigate('/');
      return;
    }
    fetchReplays();
  }, [isAuthenticated, isAdmin, isTournamentModerator, navigate, statusFilter]);

  const fetchReplays = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await adminService.getReplays(params);
      setReplays(res.data.replays || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load replays');
    } finally {
      setLoading(false);
    }
  };

  const handleForceDiscard = async (replayId: string, filename: string) => {
    if (!window.confirm(`Force-discard replay "${filename}"?`)) return;
    setDiscarding(replayId);
    try {
      await adminService.forceDiscardReplay(replayId);
      setMessage(`Replay ${filename} discarded`);
      setTimeout(() => setMessage(''), 4000);
      fetchReplays();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to discard replay');
    } finally {
      setDiscarding(null);
    }
  };

  if (loading) {
    return <MainLayout><div className="max-w-6xl mx-auto px-4 py-8"><p className="text-center text-gray-600">{t('loading')}</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          {t('admin.replays_title', 'Manage Replays')}
        </h1>

        {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</p>}
        {message && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">{message}</p>}

        {/* Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex gap-4 items-center">
          <label className="text-sm font-semibold text-gray-600">{t('label_status', 'Status')}:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="all">{t('admin.filter_all', 'All')}</option>
            <option value="new">New</option>
            <option value="parsed">Parsed</option>
            <option value="error">Error</option>
            <option value="rejected">Rejected</option>
            <option value="confirmed">Confirmed</option>
            <option value="discarded">Discarded</option>
          </select>
          <span className="text-sm text-gray-500 ml-auto">{replays.length} {t('admin.replays_found', 'replays found')}</span>
        </div>

        {replays.length === 0 ? (
          <p className="text-center py-8 text-gray-600">{t('no_data')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white shadow-md rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('admin.replay_filename', 'Filename')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('label_status', 'Status')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('admin.replay_match_type', 'Match Type')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('admin.replay_error', 'Error')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('label_date', 'Date')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-800">{t('label_actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {replays.map((replay) => (
                  <tr key={replay.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{replay.id}</td>
                    <td className="px-4 py-3 text-gray-700 text-sm max-w-xs truncate" title={replay.replay_filename}>
                      {replay.replay_filename || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[replay.parse_status] || 'bg-gray-100 text-gray-700'}`}>
                        {replay.parse_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-sm">{replay.match_type || '—'}</td>
                    <td className="px-4 py-3 text-red-700 text-xs max-w-xs truncate" title={replay.error_message}>
                      {replay.error_message || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {replay.created_at ? new Date(replay.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {['new', 'parsed', 'error'].includes(replay.parse_status) && (
                        <button
                          className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                          disabled={discarding === replay.id}
                          onClick={() => handleForceDiscard(replay.id, replay.replay_filename || replay.id)}
                        >
                          {discarding === replay.id ? '...' : t('admin.btn_force_discard', 'Force Discard')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminReplays;
