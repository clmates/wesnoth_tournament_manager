import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface PlayerLinkProps {
  nickname: string;
  userId: string;
  className?: string;
}

const PlayerLink: React.FC<PlayerLinkProps> = ({ nickname, userId, className = '' }) => {
  const navigate = useNavigate();
  const { userId: currentUserId } = useAuthStore();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (currentUserId === userId) {
      navigate('/profile');
    } else {
      navigate(`/player/${userId}`);
    }
  };

  return (
    <a 
      href="#" 
      onClick={handleClick}
      className={`player-link ${className}`}
    >
      {nickname}
    </a>
  );
};

export default PlayerLink;
