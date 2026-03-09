import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { adminService } from '../services/api';
import MainLayout from '../components/MainLayout';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  parsed: 'bg-green-100 text-green-800',
  completed: 'bg-green-200 text-green-900',
  error: 'bg-red-100 text-red-800',
  failed: 'bg-red-200 text-red-900',
  rejected: 'bg-gray-100 text-gray-600',
  skipped: 'bg-gray-100 text-gray-500',
  discarded: 'bg-gray-200 text-gray-500',
  reported: 'bg-purple-100 text-purple-800',
};

function parseSummaryPlayers(summaryJson: string | null): { side1: string; side2: string; map: string } {
  const empty = { side1: '—', side2: '—', map: '—' };
  if (!summaryJson) return empty;
  try {
    const s = JSON.parse(summaryJson);
    const side1 = s.forumPlayers?.[0]?.user_name || '—';
    const side2 = s.forumPlayers?.[1]?.user_name || '—';
    const map = s.finalMap || s.forumMap || s.resolvedMap || '—';
    return { side1, side2, map };
  } catch {
    return empty;
  }
}

const CONFIDENCE_LABELS: Record<number, string> = {
  0: '—',
  1: 'Manual',
  2: 'Auto',
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
  const [summaryModal, setSummaryModal] = useState<{ open: boolean; json: string; filename: string }>({ open: false, json: '', filename: '' });

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
      const params: any = { limit: 200 };
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

  const openSummary = (replay: any) => {
    let pretty = '—';
    if (replay.parse_summary) {
      try { pretty = JSON.stringify(JSON.parse(replay.parse_summary), null, 2); }
      catch { pretty = replay.parse_summary; }
    }
    setSummaryModal({ open: true, json: pretty, filename: replay.replay_filename || replay.id });
  };

  if (loading) {
    return <MainLayout><div className="max-w-7xl mx-auto px-4 py-8"><p className="text-center text-gray-600">{t('loading')}</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          {t('admin.replays_title', 'Manage Replays')}
        </h1>

        {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</p>}
        {message && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">{message}</p>}

        {/* Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6 flex gap-4 items-center flex-wrap">
          <label className="text-sm font-semibold text-gray-600">{t('label_status', 'Status')}:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="processing">Processing</option>
            <option value="parsed">Parsed</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
            <option value="skipped">Skipped</option>
            <option value="discarded">Discarded</option>
            <option value="reported">Reported (has match)</option>
          </select>
          <span className="text-sm text-gray-500 ml-auto">{replays.length} replays found</span>
        </div>

        {replays.length === 0 ? (
          <p className="text-center py-8 text-gray-600">{t('no_data')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-white shadow-md rounded-lg overflow-hidden text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Game ID</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Instance UUID</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Filename</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Confidence</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Status</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Parse Error</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Side 1</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Side 2</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Map</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {replays.map((replay) => {
                  const { side1, side2, map } = parseSummaryPlayers(replay.parse_summary);
                  const displayStatus = replay.match_id ? 'reported' : replay.parse_status;
                  return (
                    <tr key={replay.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-700 font-mono">{replay.game_id ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-500 font-mono text-xs max-w-[9rem] truncate" title={replay.instance_uuid}>
                        {replay.instance_uuid ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-[12rem] truncate" title={replay.replay_filename}>
                        {replay.replay_filename || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-center">
                        {CONFIDENCE_LABELS[replay.integration_confidence] ?? replay.integration_confidence ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[displayStatus] || 'bg-gray-100 text-gray-700'}`}>
                          {displayStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-red-700 text-xs max-w-[10rem] truncate" title={replay.parse_error_message ?? ''}>
                        {replay.parse_error_message || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{side1}</td>
                      <td className="px-3 py-2 text-gray-700">{side2}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-[8rem] truncate" title={map}>{map}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 items-center">
                          {/* Parse summary viewer */}
                          <button
                            className="text-gray-400 hover:text-blue-600 transition-colors text-base"
                            title="View parse summary"
                            onClick={() => openSummary(replay)}
                          >
                            📎
                          </button>
                          {/* Force discard */}
                          {['new', 'parsed', 'error', 'failed', 'processing'].includes(replay.parse_status) && !replay.match_id && (
                            <button
                              className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                              disabled={discarding === replay.id}
                              onClick={() => handleForceDiscard(replay.id, replay.replay_filename || replay.id)}
                            >
                              {discarding === replay.id ? '…' : 'Discard'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Parse Summary Modal */}
      {summaryModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={() => setSummaryModal({ open: false, json: '', filename: '' })}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 truncate">Parse Summary</h2>
              <span className="text-xs text-gray-500 font-mono truncate ml-4">{summaryModal.filename}</span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-auto whitespace-pre-wrap break-words font-mono leading-relaxed">
                {summaryModal.json}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setSummaryModal({ open: false, json: '', filename: '' })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AdminReplays;
