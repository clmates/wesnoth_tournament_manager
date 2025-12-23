import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { userService, publicService } from '../services/api';
import ProfileStats from '../components/ProfileStats';
import EloChart from '../components/EloChart';
import OpponentStats from '../components/OpponentStats';
import MatchesTable from '../components/MatchesTable';
import MatchDetailsModal from '../components/MatchDetailsModal';
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
    console.log('Setting matchDetailsModal state to:', match);
    setMatchDetailsModal(match);
    console.log('matchDetailsModal state updated');
  };

  const closeMatchDetails = () => {
    setMatchDetailsModal(null);
  };

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

          <div className="recent-games-container">
            <h2>{t('recent_games')}</h2>
            {/* Direct MatchesTable - not using RecentGamesTable wrapper */}
            <MatchesTable 
              matches={matches.slice(0, 30)}
              currentPlayerId={id || ''}
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
      <MatchDetailsModal 
        match={matchDetailsModal}
        isOpen={!!matchDetailsModal}
        onClose={closeMatchDetails}
      />
    </div>
  );
};

export default PlayerProfile;
