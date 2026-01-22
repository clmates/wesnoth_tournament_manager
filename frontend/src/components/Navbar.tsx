import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { userService } from '../services/api';

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
    <nav className="w-full bg-primary text-white shadow-sm p-3 min-h-[60px] flex items-center relative z-[999]">
      <div className="w-full max-w-full mx-auto px-4 flex justify-between items-center gap-4 flex-wrap relative z-[999]">
        {/* Brand */}
        <div className="flex-shrink-0">
          <Link to="/" className="text-2xl font-bold text-white hover:opacity-90 transition-opacity">
            {t('app_name')}
          </Link>
        </div>

        {/* Links */}
        <div className="flex flex-wrap flex-1 justify-center items-center gap-4 max-md:flex-col max-md:w-full max-md:order-3 max-md:mt-4 max-sm:gap-2">
          <Link to="/" className="text-white hover:bg-white/10 px-4 py-2 rounded transition-colors min-h-[40px] flex items-center max-sm:px-2 max-sm:text-sm">
            {t('navbar_home')}
          </Link>
          <Link to="/players" className="text-white hover:bg-white/10 px-4 py-2 rounded transition-colors min-h-[40px] flex items-center max-sm:px-2 max-sm:text-sm">
            {t('navbar_players')}
          </Link>
          <Link to="/rankings" className="text-white hover:bg-white/10 px-4 py-2 rounded transition-colors min-h-[40px] flex items-center max-sm:px-2 max-sm:text-sm">
            {t('navbar_ranking')}
          </Link>
          <Link to="/statistics" className="text-white hover:bg-white/10 px-4 py-2 rounded transition-colors min-h-[40px] flex items-center max-sm:px-2 max-sm:text-sm">
            {t('statistics') || 'Statistics'}
          </Link>
          <Link to="/tournaments" className="text-white hover:bg-white/10 px-4 py-2 rounded transition-colors min-h-[40px] flex items-center max-sm:px-2 max-sm:text-sm">
            {t('navbar_tournaments')}
          </Link>
          <Link to="/matches" className="text-white hover:bg-white/10 px-4 py-2 rounded transition-colors min-h-[40px] flex items-center max-sm:px-2 max-sm:text-sm">
            {t('navbar_matches')}
          </Link>
          <Link to="/faq" className="text-white hover:bg-white/10 px-4 py-2 rounded transition-colors min-h-[40px] flex items-center max-sm:px-2 max-sm:text-sm">
            {t('navbar_faq')}
          </Link>

          {/* Report Match Button */}
          {isAuthenticated && (
            <Link to="/report-match" className="bg-gradient-purple text-white px-5 py-2 rounded hover:opacity-90 hover:shadow-lg transition-all font-semibold min-h-[40px] flex items-center max-sm:px-3 max-sm:text-sm">
              {t('report_match_link')}
            </Link>
          )}

          {/* User Menu */}
          {isAuthenticated && (
            <div className="user-menu relative self-center z-[2000]">
              <button 
                ref={userBtnRef}
                className="bg-secondary text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition-colors max-sm:w-full"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                {userNickname} ▼
              </button>
              {dropdownOpen && dropdownPosition && createPortal(
                <div 
                  className="bg-white text-gray-800 w-48 rounded shadow-md z-[9999] overflow-hidden flex flex-col min-w-[180px]"
                  style={{
                    position: 'fixed',
                    top: `${dropdownPosition.top}px`,
                    right: `${dropdownPosition.right}px`,
                    left: 'auto',
                  }}
                >
                  <button 
                    className="block w-full text-left px-4 py-3 hover:bg-gray-100 transition-colors text-sm"
                    onClick={() => handleNavigateAndClose('/user')}
                  >
                    {t('navbar_profile') || 'Profile'}
                  </button>
                  <button 
                    className="block w-full text-left px-4 py-3 hover:bg-red-50 transition-colors text-sm border-t border-gray-200 text-danger font-semibold"
                    onClick={handleLogout}
                  >
                    {t('navbar_logout') || 'Logout'}
                  </button>
                </div>,
                document.body
              )}
            </div>
          )}

          {/* Auth Links */}
          {!isAuthenticated && (
            <>
              <Link to="/login" className="text-white hover:bg-white/10 px-4 py-2 rounded transition-colors min-h-[40px] flex items-center max-sm:px-2 max-sm:text-sm">
                {t('navbar_login')}
              </Link>
              <Link to="/register" className="text-white hover:bg-white/10 px-4 py-2 rounded transition-colors min-h-[40px] flex items-center max-sm:px-2 max-sm:text-sm">
                {t('navbar_register')}
              </Link>
            </>
          )}
        </div>

        {/* Language Selector */}
        <div className="flex gap-2 max-md:order-4 max-md:w-full max-md:mt-2">
          <div className="language-dropdown relative z-[2000]">
            <button 
              ref={languageBtnRef}
              className="px-3 py-2 bg-white/10 text-white border border-white/30 rounded hover:bg-white/20 transition-all flex items-center gap-2 font-semibold max-md:w-full max-md:justify-center"
              onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
            >
              <img 
                src={`https://flagcdn.com/w20/${currentLanguage.countryCode}.png`}
                alt={currentLanguage.code}
                className="w-6 h-3.75 rounded flex-shrink-0"
              />
              <span className="text-sm">{currentLanguage.code.toUpperCase()}</span>
            </button>
            {languageDropdownOpen && languageDropdownPosition && createPortal(
              <div 
                className="bg-white text-gray-800 min-w-[200px] rounded shadow-md z-[9999] overflow-hidden flex flex-col"
                style={{
                  position: 'fixed',
                  top: `${languageDropdownPosition.top}px`,
                  right: `${languageDropdownPosition.right}px`,
                  left: 'auto',
                }}
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    className={`flex items-center gap-3 w-full text-left px-4 py-3 transition-colors text-sm ${
                      lang.code === i18n.language 
                        ? 'bg-blue-100 font-semibold text-secondary' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => changeLanguage(lang.code)}
                  >
                    <img 
                      src={`https://flagcdn.com/w20/${lang.countryCode}.png`}
                      alt={lang.code}
                      className="w-6 h-3.75 rounded flex-shrink-0"
                    />
                    <span className="text-sm">{lang.code.toUpperCase()} - {lang.name}</span>
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
