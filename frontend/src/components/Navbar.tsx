import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { userService } from '../services/api';
import '../styles/Navbar.css';

const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, logout } = useAuthStore();
  const [userNickname, setUserNickname] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const userBtnRef = useRef<HTMLButtonElement>(null);
  const languageBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const [languageDropdownPosition, setLanguageDropdownPosition] = useState<{ top: number; right: number } | null>(null);

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

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (dropdownOpen && userBtnRef.current) {
      const rect = userBtnRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        right: window.innerWidth - rect.right,
      });
    }
  }, [dropdownOpen]);

  // Calculate language dropdown position when it opens
  useEffect(() => {
    if (languageDropdownOpen && languageBtnRef.current) {
      const rect = languageBtnRef.current.getBoundingClientRect();
      setLanguageDropdownPosition({
        top: rect.bottom + window.scrollY,
        right: window.innerWidth - rect.right,
      });
    }
  }, [languageDropdownOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-menu') && !target.closest('.language-dropdown')) {
        setDropdownOpen(false);
        setLanguageDropdownOpen(false);
      }
    };

    if (dropdownOpen || languageDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [dropdownOpen, languageDropdownOpen]);

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
    navigate('/');
  };

  const handleNavigateAndClose = (path: string) => {
    setDropdownOpen(false);
    navigate(path);
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
          <Link to="/statistics">{t('statistics') || 'Statistics'}</Link>
          <Link to="/tournaments">{t('navbar_tournaments')}</Link>
          <Link to="/matches">{t('navbar_matches')}</Link>
          <Link to="/faq">{t('navbar_faq')}</Link>

          {isAuthenticated && (
              <Link to="/report-match" className="report-match-link">
              {t('report_match_link')}
            </Link>
          )}

          {isAuthenticated && (
            <div className="user-menu">
              <button 
                ref={userBtnRef}
                className="user-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {userNickname} ▼
              </button>
              {dropdownOpen && dropdownPosition && createPortal(
                <div 
                  className="user-dropdown-portal"
                  style={{
                    position: 'fixed',
                    top: `${dropdownPosition.top}px`,
                    right: `${dropdownPosition.right}px`,
                    left: 'auto',
                    zIndex: 9999,
                  }}
                >
                  <button 
                    className="dropdown-item"
                    onClick={() => handleNavigateAndClose('/user')}
                  >
                    {t('navbar_profile') || 'Profile'}
                  </button>
                  <button 
                    className="dropdown-item logout-item"
                    onClick={handleLogout}
                  >
                    {t('navbar_logout') || 'Logout'}
                  </button>
                </div>,
                document.body
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
              ref={languageBtnRef}
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
            {languageDropdownOpen && languageDropdownPosition && createPortal(
              <div 
                className="language-menu-portal"
                style={{
                  position: 'fixed',
                  top: `${languageDropdownPosition.top}px`,
                  right: `${languageDropdownPosition.right}px`,
                  left: 'auto',
                  zIndex: 9999,
                }}
              >
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
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
