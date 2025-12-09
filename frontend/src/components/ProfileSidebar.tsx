import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import '../styles/ProfileSidebar.css';

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/');
    onClose();
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      <div className="profile-sidebar">
        <div className="sidebar-header">
          <button className="close-sidebar-btn" onClick={onClose}>✕</button>
        </div>

        {user && (
          <div className="user-profile-card">
            <div className="user-avatar">
              {user.nickname.charAt(0).toUpperCase()}
            </div>
            <h3 className="user-nickname">{user.nickname}</h3>
            <p className="user-elo">ELO Rating</p>
          </div>
        )}

        <ul className="sidebar-nav">
          <li className="nav-item">
            <button 
              className="nav-link"
              onClick={() => handleNavigate('/profile')}
            >
              <span className="nav-icon">👤</span>
              <span>My Profile</span>
            </button>
          </li>
          <li className="nav-item">
            <button 
              className="nav-link"
              onClick={() => handleNavigate('/my-tournaments')}
            >
              <span className="nav-icon">🏆</span>
              <span>My Tournaments</span>
            </button>
          </li>
          <li className="nav-item">
            <button 
              className="nav-link"
              onClick={() => handleNavigate('/report-match')}
            >
              <span className="nav-icon">📝</span>
              <span>Report Match</span>
            </button>
          </li>
        </ul>

        {isAdmin && (
          <>
            <div className="sidebar-section">
              <div className="sidebar-section-title">Admin Options</div>
              <ul className="sidebar-nav">
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={() => handleNavigate('/admin')}
                  >
                    <span className="nav-icon">👥</span>
                    <span>Manage Users</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={() => handleNavigate('/admin/announcements')}
                  >
                    <span className="nav-icon">📢</span>
                    <span>Announcements</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={() => handleNavigate('/admin/faq')}
                  >
                    <span className="nav-icon">❓</span>
                    <span>FAQ</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={() => handleNavigate('/admin/tournaments')}
                  >
                    <span className="nav-icon">⚙️</span>
                    <span>Manage Tournaments</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={() => handleNavigate('/admin/disputes')}
                  >
                    <span className="nav-icon">⚖️</span>
                    <span>Match Disputes</span>
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}

        <div className="sidebar-footer">
          <button 
            className="logout-btn"
            onClick={handleLogout}
          >
            🚪 Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default ProfileSidebar;
