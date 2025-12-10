import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import MainLayout from '../components/MainLayout';
import UserRecentMatches from '../components/UserRecentMatches';

const MyMatches: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  return (
    <MainLayout>
      <UserRecentMatches />
    </MainLayout>
  );
};

export default MyMatches;
