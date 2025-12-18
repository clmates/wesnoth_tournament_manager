import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';
import '../styles/ProfileSidebar.css';

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuthStore();
  const { t } = useTranslation();

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
            <p className="user-elo">{t('label_elo')}</p>
          </div>
        )}

        <ul className="sidebar-nav">
          <li className="nav-item">
            <button 
              className="nav-link"
              onClick={() => handleNavigate('/profile')}
            >
              <span className="nav-icon">👤</span>
              <span>{t('sidebar.my_profile')}</span>
            </button>
          </li>
          <li className="nav-item">
            <button 
              className="nav-link"
              onClick={() => handleNavigate('/my-tournaments')}
            >
              <span className="nav-icon">🏆</span>
              <span>{t('sidebar.my_tournaments')}</span>
            </button>
          </li>
          <li className="nav-item">
            <button 
              className="nav-link"
              onClick={() => handleNavigate('/report-match')}
            >
              <span className="nav-icon">📝</span>
              <span>{t('report_match_link')}</span>
            </button>
          </li>
        </ul>

        {isAdmin && (
          <>
            <div className="sidebar-section">
              <div className="sidebar-section-title">{t('sidebar.admin_options')}</div>
              <ul className="sidebar-nav">
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={() => handleNavigate('/admin')}
                  >
                    <span className="nav-icon">👥</span>
                    <span>{t('sidebar.manage_users')}</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={() => handleNavigate('/admin/announcements')}
                  >
                    <span className="nav-icon">📢</span>
                    <span>{t('announcements')}</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={() => handleNavigate('/admin/faq')}
                  >
                    <span className="nav-icon">❓</span>
                    <span>{t('navbar_faq')}</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={() => handleNavigate('/admin/tournaments')}
                  >
                    <span className="nav-icon">⚙️</span>
                    <span>{t('sidebar.manage_tournaments')}</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={() => handleNavigate('/admin/disputes')}
                  >
                    <span className="nav-icon">⚖️</span>
                    <span>{t('sidebar.match_disputes')}</span>
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
            🚪 {t('navbar_logout')}
          </button>
        </div>
      </div>
    </>
  );
};

export default ProfileSidebar;
