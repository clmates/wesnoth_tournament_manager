import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { matchService } from '../services/api';
import MainLayout from '../components/MainLayout';
import '../styles/Admin.css';

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
    return <MainLayout><div className="admin-container"><p>{t('loading')}</p></div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="admin-container">
      <h1>Manage Match Disputes</h1>

      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      {disputes.length === 0 ? (
        <p className="no-data">{t('no_data')}</p>
      ) : (
        <section className="disputes-section">
          <div className="section-header">
            <h2>Disputed Matches ({disputes.length})</h2>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Match ID</th>
                <th>Winner</th>
                <th>Loser</th>
                <th>Map</th>
                <th>Winner Faction</th>
                <th>Loser Faction</th>
                <th>Status</th>
                <th>Disputed At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((dispute) => (
                <tr key={dispute.id}>
                  <td>{dispute.id.substring(0, 8)}</td>
                  <td>{dispute.winner_nickname}</td>
                  <td>{dispute.loser_nickname}</td>
                  <td>{dispute.map}</td>
                  <td>{dispute.winner_faction}</td>
                  <td>{dispute.loser_faction}</td>
                  <td><span className="status-badge status-disputed">{dispute.status}</span></td>
                  <td>{new Date(dispute.updated_at).toLocaleString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        className="btn-view"
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
        <div className="modal-overlay" onClick={() => setSelectedDispute(null)}>
          <div className="modal-content dispute-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Dispute Review</h2>
              <button className="close-btn" onClick={() => setSelectedDispute(null)}>×</button>
            </div>
            
            <div className="modal-body dispute-details">
              <div className="dispute-section match-info">
                <h3>Match Details</h3>
                <div className="match-display">
                  <div className="player-info winner-info">
                    <p className="label">Winner</p>
                    <p className="nickname">{selectedDispute.winner_nickname}</p>
                    <p className="faction">{selectedDispute.winner_faction}</p>
                  </div>
                  <div className="vs">vs</div>
                  <div className="player-info loser-info">
                    <p className="label">Loser</p>
                    <p className="nickname">{selectedDispute.loser_nickname}</p>
                    <p className="faction">{selectedDispute.loser_faction}</p>
                  </div>
                </div>
                <div className="match-meta">
                  <p><strong>Map:</strong> {selectedDispute.map}</p>
                  <p><strong>Played:</strong> {new Date(selectedDispute.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="dispute-section comments-section">
                <h3>Winner's Report</h3>
                <div className="comment-box">
                  <p className="comment-text">{selectedDispute.winner_comments || 'No comments provided'}</p>
                  {selectedDispute.winner_rating && (
                    <p className="rating"><strong>Rating:</strong> {selectedDispute.winner_rating}/5</p>
                  )}
                </div>
              </div>

              <div className="dispute-section comments-section">
                <h3>Loser's Dispute Reason</h3>
                <div className="comment-box dispute-comment">
                  <p className="comment-text">{selectedDispute.loser_comments || 'No comments provided'}</p>
                  {selectedDispute.loser_rating && (
                    <p className="rating"><strong>Rating:</strong> {selectedDispute.loser_rating}/5</p>
                  )}
                </div>
              </div>

              <div className="dispute-section action-section">
                <div className="warning-box">
                  <p><strong>⚠ Important:</strong> This decision will affect both players' statistics and ELO ratings.</p>
                </div>
              </div>
            </div>

            <div className="modal-footer dispute-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedDispute(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => {
                  if (window.confirm('Validate this dispute? The match will be voided.')) {
                    handleValidateDispute(selectedDispute.id);
                  }
                }}
              >
                ✓ Validate Dispute
              </button>
              <button 
                className="btn btn-primary"
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
