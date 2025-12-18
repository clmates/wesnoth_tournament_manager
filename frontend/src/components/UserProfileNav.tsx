import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import '../styles/UserProfileNav.css';

const UserProfileNav: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();

  const handleNavigate = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="user-profile-nav">
      <div className="nav-container">
        <div className="nav-links">
          <button 
            className="nav-link"
            onClick={() => handleNavigate('/profile')}
            title={t('sidebar.my_profile')}
          >
            <span className="nav-icon">👤</span>
            <span className="nav-text">{t('sidebar.my_profile')}</span>
          </button>

          <button 
            className="nav-link"
            onClick={() => handleNavigate('/my-matches')}
            title={t('sidebar.my_matches')}
          >
            <span className="nav-icon">⚔️</span>
            <span className="nav-text">{t('sidebar.my_matches')}</span>
          </button>

          <button 
            className="nav-link"
            onClick={() => handleNavigate('/my-tournaments')}
            title={t('sidebar.my_tournaments')}
          >
            <span className="nav-icon">🏆</span>
            <span className="nav-text">{t('sidebar.my_tournaments')}</span>
          </button>

          <button 
            className="nav-link"
            onClick={() => handleNavigate('/report-match')}
            title={t('report_match_link')}
          >
            <span className="nav-icon">📝</span>
            <span className="nav-text">{t('report_match_link')}</span>
          </button>

          {isAdmin && (
            <div className="nav-separator"></div>
          )}

          {isAdmin && (
            <>
              <button 
                className="nav-link admin-link"
                onClick={() => handleNavigate('/admin')}
                title={t('sidebar.manage_users')}
              >
                <span className="nav-icon">👥</span>
                <span className="nav-text">{t('sidebar.manage_users')}</span>
              </button>

              <button 
                className="nav-link admin-link"
                onClick={() => handleNavigate('/admin/tournaments')}
                title={t('sidebar.manage_tournaments')}
              >
                <span className="nav-icon">⚙️</span>
                <span className="nav-text">{t('sidebar.manage_tournaments')}</span>
              </button>

              <button 
                className="nav-link admin-link"
                onClick={() => handleNavigate('/admin/announcements')}
                title={t('admin_announcements')}
              >
                <span className="nav-icon">📢</span>
                <span className="nav-text">{t('admin_announcements') || 'News'}</span>
              </button>

              <button 
                className="nav-link admin-link"
                onClick={() => handleNavigate('/admin/faq')}
                title={t('navbar_faq')}
              >
                <span className="nav-icon">❓</span>
                <span className="nav-text">{t('navbar_faq') || 'FAQ'}</span>
              </button>

              <button 
                className="nav-link admin-link"
                onClick={() => handleNavigate('/admin/disputes')}
                title={t('sidebar.match_disputes')}
              >
                <span className="nav-icon">⚖️</span>
                <span className="nav-text">{t('sidebar.match_disputes')}</span>
              </button>

              <button 
                className="nav-link admin-link"
                onClick={() => handleNavigate('/admin/audit')}
                title="Audit Logs"
              >
                <span className="nav-icon">🔒</span>
                <span className="nav-text">Audit Logs</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default UserProfileNav;
