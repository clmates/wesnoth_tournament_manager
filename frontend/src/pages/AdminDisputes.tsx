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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedDispute(null)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 border-b-2 border-blue-800 flex justify-between items-center rounded-t-xl">
                <h2 className="text-2xl font-bold text-white">Dispute Review</h2>
                <button className="text-3xl text-white hover:text-blue-100 transition-colors" onClick={() => setSelectedDispute(null)}>×</button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                  <h3 className="text-lg font-bold text-blue-900 mb-5">Match Details</h3>
                  <div className="flex justify-around items-center mb-6">
                    <div className="text-center bg-white rounded-lg p-4 flex-1 mx-2 shadow-sm">
                      <p className="text-green-600 text-xs font-semibold uppercase tracking-wide">Winner</p>
                      <p className="text-xl font-bold text-gray-900 mt-2">{selectedDispute.winner_nickname}</p>
                      <p className="text-sm text-gray-700 mt-1 font-medium">{selectedDispute.winner_faction}</p>
                    </div>
                    <div className="text-gray-400 font-bold text-2xl mx-2">vs</div>
                    <div className="text-center bg-white rounded-lg p-4 flex-1 mx-2 shadow-sm">
                      <p className="text-red-600 text-xs font-semibold uppercase tracking-wide">Loser</p>
                      <p className="text-xl font-bold text-gray-900 mt-2">{selectedDispute.loser_nickname}</p>
                      <p className="text-sm text-gray-700 mt-1 font-medium">{selectedDispute.loser_faction}</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-4 space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">Map:</span>
                      <span className="text-gray-900 font-medium">{selectedDispute.map}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-800">Played:</span>
                      <span className="text-gray-900 font-medium">{new Date(selectedDispute.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-6 border-l-4 border-green-500">
                  <h3 className="text-lg font-bold text-green-900 mb-4">✓ Winner's Report</h3>
                  <p className="text-gray-800 leading-relaxed">{selectedDispute.winner_comments || 'No comments provided'}</p>
                  {selectedDispute.winner_rating && (
                    <p className="text-sm text-green-700 mt-4 font-semibold">⭐ Match Rating: {selectedDispute.winner_rating}/5</p>
                  )}
                </div>

                <div className="bg-red-50 rounded-lg p-6 border-l-4 border-red-500">
                  <h3 className="text-lg font-bold text-red-900 mb-4">⚠ Loser's Dispute Reason</h3>
                  <p className="text-gray-800 leading-relaxed">{selectedDispute.loser_comments || 'No comments provided'}</p>
                  {selectedDispute.loser_rating && (
                    <p className="text-sm text-red-700 mt-4 font-semibold">⭐ Match Rating: {selectedDispute.loser_rating}/5</p>
                  )}
                </div>

                <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-lg">
                  <p className="text-amber-900 leading-relaxed"><strong className="font-bold">⚠️ Important Notice:</strong> This decision will permanently affect both players' statistics and ELO ratings.</p>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-5 border-t-2 border-gray-200 flex justify-end gap-3 rounded-b-xl sticky bottom-0">
                <button
                  className="px-6 py-2.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-semibold transition-colors shadow-md"
                  onClick={() => setSelectedDispute(null)}
                >
                  Cancel
                </button>
                <button 
                  className="px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-colors shadow-md flex items-center gap-2"
                  onClick={() => {
                    if (window.confirm('Validate this dispute? The match will be voided and stats recalculated.')) {
                      handleValidateDispute(selectedDispute.id);
                    }
                  }}
                >
                  ✓ Validate Dispute
                </button>
                <button 
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors shadow-md flex items-center gap-2"
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
