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
          />
        </>
      )}
    </div>
  );
};

export default PlayerProfile;
