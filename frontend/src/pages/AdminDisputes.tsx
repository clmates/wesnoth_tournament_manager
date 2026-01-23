import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { matchService } from '../services/api';
import MainLayout from '../components/MainLayout';

const AdminDisputes: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuthStore();
  
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      navigate('/');
      return;
    }

    fetchDisputes();
  }, [isAuthenticated, isAdmin, navigate]);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const response = await matchService.getAllDisputedMatches();
      setDisputes(response.data || []);
      setError('');
    } catch (err: any) {
      console.error('Error fetching disputes:', err);
      setError(err.response?.data?.error || err.message || 'Error loading disputes');
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateDispute = async (matchId: string) => {
    try {
      const response = await matchService.validateDispute(matchId);
      setMessage(response.data?.message || 'Dispute validated');
      setSelectedDispute(null);
      fetchDisputes();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to validate dispute');
    }
  };

  const handleRejectDispute = async (matchId: string) => {
    try {
      const response = await matchService.rejectDispute(matchId);
      setMessage(response.data?.message || 'Dispute rejected');
      setSelectedDispute(null);
      fetchDisputes();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to reject dispute');
    }
  };

  if (loading) {
    return <MainLayout><div className="max-w-6xl mx-auto px-4 py-8"><p className="text-center text-gray-600">{t('loading')}</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Manage Match Disputes</h1>

      {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</p>}
      {message && <p className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-4">{message}</p>}

      {disputes.length === 0 ? (
        <p className="text-center text-gray-600">{t('no_data')}</p>
      ) : (
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Disputed Matches ({disputes.length})</h2>
          </div>

          <table className="w-full border-collapse bg-white shadow-md rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Match ID</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Winner</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Loser</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Map</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Winner Faction</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Loser Faction</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Disputed At</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-800">Actions</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{dispute.id.substring(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-700">{dispute.winner_nickname}</td>
                  <td className="px-4 py-3 text-gray-700">{dispute.loser_nickname}</td>
                  <td className="px-4 py-3 text-gray-700">{dispute.map}</td>
                  <td className="px-4 py-3 text-gray-700">{dispute.winner_faction}</td>
                  <td className="px-4 py-3 text-gray-700">{dispute.loser_faction}</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">{dispute.status}</span></td>
                  <td className="px-4 py-3 text-gray-700">{new Date(dispute.updated_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div>
                      <button 
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                        onClick={() => setSelectedDispute(dispute)}
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedDispute(null)}>
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-96 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gray-100 px-6 py-4 border-b border-gray-300 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">Dispute Review</h2>
              <button className="text-2xl text-gray-600 hover:text-gray-800" onClick={() => setSelectedDispute(null)}>×</button>
            </div>
            
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Match Details</h3>
                <div className="flex justify-around items-center">
                  <div className="text-center">
                    <p className="text-gray-600 text-sm">Winner</p>
                    <p className="text-lg font-semibold text-gray-800">{selectedDispute.winner_nickname}</p>
                    <p className="text-gray-700">{selectedDispute.winner_faction}</p>
                  </div>
                  <div className="text-gray-600 font-bold text-lg">vs</div>
                  <div className="text-center">
                    <p className="text-gray-600 text-sm">Loser</p>
                    <p className="text-lg font-semibold text-gray-800">{selectedDispute.loser_nickname}</p>
                    <p className="text-gray-700">{selectedDispute.loser_faction}</p>
                  </div>
                </div>
                <div className="text-gray-700 text-sm mt-4">
                  <p><strong>Map:</strong> {selectedDispute.map}</p>
                  <p><strong>Played:</strong> {new Date(selectedDispute.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Winner's Report</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700">{selectedDispute.winner_comments || 'No comments provided'}</p>
                  {selectedDispute.winner_rating && (
                    <p className="text-sm text-gray-600 mt-2"><strong>Rating:</strong> {selectedDispute.winner_rating}/5</p>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Loser's Dispute Reason</h3>
                <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-400">
                  <p className="text-gray-700">{selectedDispute.loser_comments || 'No comments provided'}</p>
                  {selectedDispute.loser_rating && (
                    <p className="text-sm text-gray-600 mt-2"><strong>Rating:</strong> {selectedDispute.loser_rating}/5</p>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                  <p className="text-gray-700"><strong>⚠ Important:</strong> This decision will affect both players' statistics and ELO ratings.</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 px-6 py-4 border-t border-gray-300 flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                onClick={() => setSelectedDispute(null)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                onClick={() => {
                  if (window.confirm('Validate this dispute? The match will be voided.')) {
                    handleValidateDispute(selectedDispute.id);
                  }
                }}
              >
                ✓ Validate Dispute
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                onClick={() => {
                  if (window.confirm('Reject this dispute? The match will be confirmed.')) {
                    handleRejectDispute(selectedDispute.id);
                  }
                }}
              >
                ✗ Reject Dispute
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </MainLayout>
  );
};

export default AdminDisputes;
