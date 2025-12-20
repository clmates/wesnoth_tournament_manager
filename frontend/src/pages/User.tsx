import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import MainLayout from '../components/MainLayout';
import ProfileStats from '../components/ProfileStats';
import EloChart from '../components/EloChart';
import OpponentStats from '../components/OpponentStats';
import RecentGamesTable from '../components/RecentGamesTable';
import '../styles/UserProfile.css';

const User: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, userId } = useAuthStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

            <RecentGamesTable 
              matches={matches.slice(0, 30)}
              currentPlayerId={userId || ''}
              onMatchConfirmed={refetchMatches}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default User;
