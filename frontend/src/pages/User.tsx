import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import MainLayout from '../components/MainLayout';
import ProfileStats from '../components/ProfileStats';
import EloChart from '../components/EloChart';
import OpponentStats from '../components/OpponentStats';
import MatchesTable from '../components/MatchesTable';
import '../styles/UserProfile.css';

const User: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, userId } = useAuthStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchDetailsModal, setMatchDetailsModal] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch profile data
        const profileRes = await userService.getProfile();
        setProfile(profileRes.data);

        // Fetch recent matches for the current user
        if (userId) {
          console.log('Fetching matches for user ID:', userId);
          const matchesRes = await userService.getRecentMatches(userId);
          console.log('Matches response:', matchesRes.data);
          const matchesData = matchesRes.data?.data || matchesRes.data || [];
          setMatches(matchesData);
        } else {
          console.warn('User ID not available:', userId);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Error loading profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, navigate, userId]);

  const refetchMatches = async () => {
    try {
      if (userId) {
        const matchesRes = await userService.getRecentMatches(userId);
        const matchesData = matchesRes.data?.data || matchesRes.data || [];
        setMatches(matchesData);
      }
    } catch (err) {
      console.error('Error refetching matches:', err);
    }
  };

  const openMatchDetails = (match: any) => {
    setMatchDetailsModal(match);
  };

  const closeMatchDetails = () => {
    setMatchDetailsModal(null);
  };

  const winnerEloChange = (match: any) => (match.winner_elo_after || 0) - (match.winner_elo_before || 0);
  const loserEloChange = (match: any) => (match.loser_elo_after || 0) - (match.loser_elo_before || 0);

  if (loading) {
    return <div className="auth-container"><p>Loading...</p></div>;
  }

  if (!profile) {
    return <div className="auth-container"><p>Profile not found</p></div>;
  }

  return (
    <MainLayout>
      <div className="profile-page-content">
        <h1>{profile?.nickname}'s Profile</h1>
        
        {profile && (
          <>
            <ProfileStats player={profile} />

            <EloChart 
              matches={matches}
              currentPlayerId={userId || ''}
            />

            <OpponentStats 
              matches={matches}
              currentPlayerId={userId || ''}
            />

            <div className="recent-games-container">
              <h2>{t('recent_games')}</h2>
              <MatchesTable 
                matches={matches.slice(0, 30)}
                currentPlayerId={userId || ''}
                onViewDetails={openMatchDetails}
                onDownloadReplay={async (matchId, replayFilePath) => {
                  try {
                    const API_URL = window.location.hostname.includes('main.') 
                      ? 'https://wesnothtournamentmanager-main.up.railway.app/api'
                      : window.location.hostname.includes('wesnoth-tournament-manager.pages.dev')
                      ? 'https://wesnothtournamentmanager-production.up.railway.app/api'
                      : '/api';
                    
                    const response = await fetch(`${API_URL}/matches/${matchId}/replay/download`, {
                      method: 'GET'
                    });
                    
                    if (!response.ok) {
                      throw new Error(`Download failed with status ${response.status}`);
                    }
                    
                    const { signedUrl } = await response.json();
                    window.location.href = signedUrl;
                  } catch (err) {
                    console.error('Error downloading replay:', err);
                  }
                }}
              />
            </div>
          </>
        )}

        {/* Match Details Modal */}
        {matchDetailsModal && (
          <div className="modal-overlay" onClick={closeMatchDetails}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Match Details</h2>
                <button className="close-btn" onClick={closeMatchDetails}>✕</button>
              </div>

              <div className="modal-body">
                <div className="match-details-container">
                  <div className="detail-header-row">
                    <div className="detail-item">
                      <label>Date:</label>
                      <span>{new Date(matchDetailsModal.created_at).toLocaleString()}</span>
                    </div>
                    <div className="detail-item">
                      <label>Map:</label>
                      <span>{matchDetailsModal.map}</span>
                    </div>
                    <div className="detail-item">
                      <label>Status:</label>
                      <span className={`status-badge ${matchDetailsModal.status || 'unconfirmed'}`}>
                        {matchDetailsModal.status === 'confirmed' && '✓ Confirmed'}
                        {matchDetailsModal.status === 'unconfirmed' && '⏳ Unconfirmed'}
                        {matchDetailsModal.status === 'disputed' && '⚠ Disputed'}
                        {matchDetailsModal.status === 'cancelled' && '✗ Cancelled'}
                        {!matchDetailsModal.status && '⏳ Unconfirmed'}
                      </span>
                    </div>
                  </div>

                  <div className="match-stats-grid">
                    <div className="grid-header label-col">Statistic</div>
                    <div className="grid-header winner-col">Winner</div>
                    <div className="grid-header loser-col">Loser</div>

                    <div className="grid-cell label-cell">Player</div>
                    <div className="grid-cell winner-cell">{matchDetailsModal.winner_nickname}</div>
                    <div className="grid-cell loser-cell">{matchDetailsModal.loser_nickname}</div>

                    <div className="grid-cell label-cell">Faction</div>
                    <div className="grid-cell winner-cell"><span className="faction-badge">{matchDetailsModal.winner_faction}</span></div>
                    <div className="grid-cell loser-cell"><span className="faction-badge">{matchDetailsModal.loser_faction}</span></div>

                    <div className="grid-cell label-cell">Rating</div>
                    <div className="grid-cell winner-cell">{matchDetailsModal.winner_rating || '-'}</div>
                    <div className="grid-cell loser-cell">{matchDetailsModal.loser_rating || '-'}</div>

                    <div className="grid-cell label-cell">ELO Before</div>
                    <div className="grid-cell winner-cell">{matchDetailsModal.winner_elo_before || 'N/A'}</div>
                    <div className="grid-cell loser-cell">{matchDetailsModal.loser_elo_before || 'N/A'}</div>

                    <div className="grid-cell label-cell">ELO After</div>
                    <div className="grid-cell winner-cell">{matchDetailsModal.winner_elo_after || 'N/A'}</div>
                    <div className="grid-cell loser-cell">{matchDetailsModal.loser_elo_after || 'N/A'}</div>

                    <div className="grid-cell label-cell">ELO Change</div>
                    <div className="grid-cell winner-cell">
                      <span className={`rating-change ${winnerEloChange(matchDetailsModal) >= 0 ? 'positive' : 'negative'}`}>
                        {winnerEloChange(matchDetailsModal) >= 0 ? '+' : ''}{winnerEloChange(matchDetailsModal)}
                      </span>
                    </div>
                    <div className="grid-cell loser-cell">
                      <span className={`rating-change ${loserEloChange(matchDetailsModal) >= 0 ? 'positive' : 'negative'}`}>
                        {loserEloChange(matchDetailsModal) >= 0 ? '+' : ''}{loserEloChange(matchDetailsModal)}
                      </span>
                    </div>

                    {(matchDetailsModal.winner_comments || matchDetailsModal.loser_comments) && (
                      <>
                        <div className="grid-cell label-cell">Comments</div>
                        <div className="grid-cell winner-cell" title={matchDetailsModal.winner_comments || undefined}>{matchDetailsModal.winner_comments || '-'}</div>
                        <div className="grid-cell loser-cell" title={matchDetailsModal.loser_comments || undefined}>{matchDetailsModal.loser_comments || '-'}</div>
                      </>
                    )}

                    {matchDetailsModal.replay_file_path && (
                      <>
                        <div className="grid-cell label-cell">Replay</div>
                        <div className="grid-cell winner-cell" style={{ gridColumn: '2 / 4' }}>
                          <button 
                            className="download-btn-compact"
                            onClick={() => {
                              closeMatchDetails();
                            }}
                            title={`Downloads: ${matchDetailsModal.replay_downloads || 0}`}
                          >
                            ⬇️ Download ({matchDetailsModal.replay_downloads || 0})
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="close-modal-btn" onClick={closeMatchDetails}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default User;
