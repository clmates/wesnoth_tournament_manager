import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { userService } from '../services/api';
import '../styles/Navbar.css';

const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, isAdmin, logout } = useAuthStore();
  const [userNickname, setUserNickname] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);

  const languages = [
    { code: 'en', name: 'English', countryCode: 'us' },
    { code: 'es', name: 'Español', countryCode: 'es' },
    { code: 'zh', name: '中文', countryCode: 'cn' },
    { code: 'de', name: 'Deutsch', countryCode: 'de' },
    { code: 'ru', name: 'Русский', countryCode: 'ru' },
  ];

  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  useEffect(() => {
    if (isAuthenticated) {
      const fetchUserProfile = async () => {
        try {
          const res = await userService.getProfile();
          setUserNickname(res.data.nickname);
        } catch (err) {
          console.error('Error fetching profile:', err);
        }
      };
      fetchUserProfile();
    }
  }, [isAuthenticated]);

  // Debug: Log auth state on mount and when it changes
  useEffect(() => {
    console.log('=== Navbar Auth Debug ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('isAdmin:', isAdmin);
    console.log('token in localStorage:', localStorage.getItem('token'));
    console.log('userId in localStorage:', localStorage.getItem('userId'));
    console.log('================================');
  }, [isAuthenticated, isAdmin]);

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    setLanguageDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/">{t('app_name')}</Link>
        </div>

        <div className="navbar-links">
          <Link to="/">{t('navbar_home')}</Link>
          <Link to="/players">{t('navbar_players')}</Link>
          <Link to="/rankings">{t('navbar_ranking')}</Link>
          <Link to="/tournaments">{t('navbar_tournaments')}</Link>
          <Link to="/matches">{t('navbar_matches')}</Link>
          <Link to="/faq">{t('navbar_faq')}</Link>

          {isAuthenticated && (
              <Link to="/report-match" className="report-match-link">
              {t('report_match_link')}
            </Link>
          )}

          {isAdmin && (
            <div className="admin-menu">
              <button 
                className="admin-btn"
                onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
              >
                ⚙️ Admin ▼
              </button>
              {adminDropdownOpen && (
                <div className="admin-dropdown">
                  <Link to="/admin" className="dropdown-item" onClick={() => setAdminDropdownOpen(false)}>
                    {t('admin_users') || 'Users'}
                  </Link>
                  <Link to="/admin/announcements" className="dropdown-item" onClick={() => setAdminDropdownOpen(false)}>
                    {t('admin_announcements') || 'Announcements'}
                  </Link>
                  <Link to="/admin/faq" className="dropdown-item" onClick={() => setAdminDropdownOpen(false)}>
                    {t('admin_faq') || 'FAQ'}
                  </Link>
                  <Link to="/admin/tournaments" className="dropdown-item" onClick={() => setAdminDropdownOpen(false)}>
                    {t('admin_tournaments') || 'Tournaments'}
                  </Link>
                  <Link to="/admin/disputes" className="dropdown-item" onClick={() => setAdminDropdownOpen(false)}>
                    {t('admin_disputes') || 'Disputes'}
                  </Link>
                </div>
              )}
            </div>
          )}

          {isAuthenticated && (
            <div className="user-menu">
              <button 
                className="user-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {userNickname} ▼
              </button>
              {dropdownOpen && (
                <div className="user-dropdown">
                  <Link to="/user" className="dropdown-item">
                    {t('navbar_profile') || 'Profile'}
                  </Link>
                  <button 
                    className="dropdown-item logout-item"
                    onClick={handleLogout}
                  >
                    {t('navbar_logout') || 'Logout'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!isAuthenticated && (
            <>
              <Link to="/login">{t('navbar_login')}</Link>
              <Link to="/register">{t('navbar_register')}</Link>
            </>
          )}
        </div>

        <div className="language-selector">
          <div className="language-dropdown">
            <button 
              className="language-btn"
              onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
            >
              <img 
                src={`https://flagcdn.com/w20/${currentLanguage.countryCode}.png`}
                alt={currentLanguage.code}
                className="flag-img"
              />
              <span className="lang-code">{currentLanguage.code.toUpperCase()}</span>
            </button>
            {languageDropdownOpen && (
              <div className="language-menu">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    className={`language-option ${lang.code === i18n.language ? 'active' : ''}`}
                    onClick={() => changeLanguage(lang.code)}
                  >
                    <img 
                      src={`https://flagcdn.com/w20/${lang.countryCode}.png`}
                      alt={lang.code}
                      className="flag-img"
                    />
                    <span className="lang-text">{lang.code.toUpperCase()} - {lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
