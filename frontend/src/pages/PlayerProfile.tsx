import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { userService, publicService } from '../services/api';
import ProfileStats from '../components/ProfileStats';
import EloChart from '../components/EloChart';
import OpponentStats from '../components/OpponentStats';
import RecentGamesTable from '../components/RecentGamesTable';
import '../styles/UserProfile.css';

const PlayerProfile: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchDetailsModal, setMatchDetailsModal] = useState<any>(null);

  useEffect(() => {
    if (!id) {
      navigate('/players');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch player profile
        const profileRes = await publicService.getPlayerProfile(id);
        setProfile(profileRes.data);

        // Fetch recent matches for the user
        const matchesRes = await userService.getRecentMatches(id);
        const matchesData = matchesRes.data?.data || matchesRes.data || [];
        setMatches(matchesData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Error loading profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const refetchMatches = async () => {
    try {
      if (id) {
        const matchesRes = await userService.getRecentMatches(id);
        const matchesData = matchesRes.data?.data || matchesRes.data || [];
        setMatches(matchesData);
      }
    } catch (err) {
      console.error('Error refetching matches:', err);
    }
  };

  const openMatchDetails = (match: any) => {
    console.log('openMatchDetails called in PlayerProfile with match:', match);
    setMatchDetailsModal(match);
  };

  const closeMatchDetails = () => {
    setMatchDetailsModal(null);
  };

  const winnerEloChange = (match: any) => (match.winner_elo_after || 0) - (match.winner_elo_before || 0);
  const loserEloChange = (match: any) => (match.loser_elo_after || 0) - (match.loser_elo_before || 0);

  if (loading) {
    return <div className="auth-container"><p>{t('loading')}</p></div>;
  }

  if (error) {
    return (
      <div className="auth-container">
        <p className="error-message">{error}</p>
        <button onClick={() => navigate('/players')}>{t('back_to_players')}</button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="auth-container">
        <p>Profile not found</p>
        <button onClick={() => navigate('/players')}>{t('back_to_players')}</button>
      </div>
    );
  }

  return (
    <div className="profile-page-content">
      <h1>{profile?.nickname}'s Profile</h1>
      
      {profile && (
        <>
          <ProfileStats player={profile} />

          <EloChart 
            matches={matches}
            currentPlayerId={id || ''}
          />

          <OpponentStats 
            matches={matches}
            currentPlayerId={id || ''}
          />

          <RecentGamesTable 
            matches={matches.slice(0, 30)}
            currentPlayerId={id || ''}
            onMatchConfirmed={refetchMatches}
            onViewDetails={openMatchDetails}
          />
        </>
      )}

      {/* Match Details Modal */}
      {matchDetailsModal && (
        <div className="modal-overlay" onClick={closeMatchDetails}>
          <div className="modal-content match-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Match Details</h2>
              <button className="close-btn" onClick={closeMatchDetails}>&times;</button>
            </div>

            <div className="modal-body">
              <div className="details-grid">
                <div className="grid-cell label-cell">Date</div>
                <div className="grid-cell winner-cell" style={{ gridColumn: '2 / 4' }}>{new Date(matchDetailsModal.created_at).toLocaleString()}</div>

                <div className="grid-cell label-cell">Players</div>
                <div className="grid-cell winner-cell">{matchDetailsModal.winner_nickname}</div>
                <div className="grid-cell loser-cell">{matchDetailsModal.loser_nickname}</div>

                <div className="grid-cell label-cell">Factions</div>
                <div className="grid-cell winner-cell">{matchDetailsModal.winner_faction || 'N/A'}</div>
                <div className="grid-cell loser-cell">{matchDetailsModal.loser_faction || 'N/A'}</div>

                <div className="grid-cell label-cell">Map</div>
                <div className="grid-cell winner-cell" style={{ gridColumn: '2 / 4' }}>{matchDetailsModal.map || 'N/A'}</div>

                <div className="grid-cell label-cell">Status</div>
                <div className="grid-cell winner-cell" style={{ gridColumn: '2 / 4' }}>
                  <span className={`status-badge ${matchDetailsModal.status || 'unconfirmed'}`}>
                    {matchDetailsModal.status === 'confirmed' && t('match_status_confirmed')}
                    {matchDetailsModal.status === 'unconfirmed' && t('match_status_unconfirmed')}
                    {matchDetailsModal.status === 'disputed' && t('match_status_disputed')}
                    {matchDetailsModal.status === 'cancelled' && t('match_status_cancelled')}
                    {!matchDetailsModal.status && t('match_status_unconfirmed')}
                  </span>
                </div>

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
                        onClick={() => closeMatchDetails()}
                        title={`Downloads: ${matchDetailsModal.replay_downloads || 0}`}
                      >
                        ⬇️ Download ({matchDetailsModal.replay_downloads || 0})
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="close-modal-btn" onClick={closeMatchDetails}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerProfile;
