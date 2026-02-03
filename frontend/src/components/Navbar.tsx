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
  const languageBtnMobileRef = useRef<HTMLButtonElement>(null);
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
    if (languageDropdownOpen) {
      const ref = languageBtnMobileRef.current || languageBtnRef.current;
      if (ref) {
        const rect = ref.getBoundingClientRect();
        setLanguageDropdownPosition({
          top: rect.bottom + window.scrollY,
          right: window.innerWidth - rect.right,
        });
      }
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
    <nav className="w-full bg-primary text-white shadow-sm p-3 min-h-[60px] flex items-center relative z-[999] overflow-hidden max-md:flex-col max-md:min-h-auto max-md:gap-2">
      <div className="w-full max-w-full mx-auto px-2 flex justify-between items-center gap-2 relative z-[999] max-md:w-full max-md:flex-col max-md:gap-2 overflow-x-auto -webkit-overflow-scrolling-touch">
        
        {/* Brand + Language Selector Row */}
        <div className="flex justify-between items-center gap-4 max-md:w-full max-md:gap-2">
          {/* Brand */}
          <div className="flex-shrink-0 min-w-fit">
            <Link to="/" className="text-2xl font-bold text-white hover:opacity-90 transition-opacity max-sm:text-xl">
              {t('app_name')}
            </Link>
          </div>

          {/* Language Selector for Mobile */}
          <div className="hidden max-md:flex gap-1 flex-shrink-0">
            <div className="language-dropdown relative z-[2000]">
              <button 
                ref={languageBtnMobileRef}
                className="px-2 py-2 bg-white/10 text-white border border-white/30 rounded hover:bg-white/20 transition-all flex items-center gap-1 font-semibold max-sm:px-1 max-sm:text-xs"
                onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
                title="Change language"
              >
                <img 
                  src={`https://flagcdn.com/w20/${currentLanguage.countryCode}.png`}
                  alt={currentLanguage.code}
                  className="w-5 h-3 rounded flex-shrink-0"
                />
              </button>
            </div>
          </div>
        </div>

        {/* Links and Controls Container */}
        <div className="flex flex-1 justify-between items-center gap-2 max-md:w-full max-md:flex-col-reverse">
          {/* Links */}
          <div className="flex flex-1 justify-center items-center gap-2 max-md:overflow-x-auto max-md:-webkit-overflow-scrolling-touch max-md:scrollbar-none max-md:w-full max-lg:flex-nowrap min-w-0">
          <Link to="/" className="text-white hover:bg-white/10 px-3 py-2 rounded transition-colors min-h-[40px] flex items-center flex-shrink-0 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm">
            {t('navbar_home')}
          </Link>
          <Link to="/players" className="text-white hover:bg-white/10 px-3 py-2 rounded transition-colors min-h-[40px] flex items-center flex-shrink-0 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm">
            {t('navbar_players')}
          </Link>
          <Link to="/rankings" className="text-white hover:bg-white/10 px-3 py-2 rounded transition-colors min-h-[40px] flex items-center flex-shrink-0 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm">
            {t('navbar_ranking')}
          </Link>
          <Link to="/statistics" className="text-white hover:bg-white/10 px-3 py-2 rounded transition-colors min-h-[40px] flex items-center flex-shrink-0 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm">
            {t('statistics') || 'Statistics'}
          </Link>
          <Link to="/tournaments" className="text-white hover:bg-white/10 px-3 py-2 rounded transition-colors min-h-[40px] flex items-center flex-shrink-0 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm">
            {t('navbar_tournaments')}
          </Link>
          <Link to="/matches" className="text-white hover:bg-white/10 px-3 py-2 rounded transition-colors min-h-[40px] flex items-center flex-shrink-0 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm">
            {t('navbar_matches')}
          </Link>
          <Link to="/faq" className="text-white hover:bg-white/10 px-3 py-2 rounded transition-colors min-h-[40px] flex items-center flex-shrink-0 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm">
            {t('navbar_faq')}
          </Link>

          {/* Report Match Button */}
          {isAuthenticated && (
            <Link to="/report-match" className="bg-gradient-purple text-white px-3 py-2 rounded hover:opacity-90 hover:shadow-lg transition-all font-semibold min-h-[40px] flex items-center flex-shrink-0 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm">
              {t('report_match_link')}
            </Link>
          )}

          {/* User Menu */}
          {isAuthenticated && (
            <div className="user-menu relative self-center z-[2000] flex-shrink-0">
              <button 
                ref={userBtnRef}
                className="bg-secondary text-white px-3 py-2 rounded font-semibold hover:bg-blue-700 transition-colors max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm flex-shrink-0 whitespace-nowrap"
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
              <Link to="/login" className="text-white hover:bg-white/10 px-3 py-2 rounded transition-colors min-h-[40px] flex items-center flex-shrink-0 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm">
                {t('navbar_login')}
              </Link>
              <Link to="/register" className="text-white hover:bg-white/10 px-3 py-2 rounded transition-colors min-h-[40px] flex items-center flex-shrink-0 max-sm:px-2 max-sm:py-1.5 max-sm:text-xs max-md:px-2.5 max-md:py-1.5 max-md:text-sm">
                {t('navbar_register')}
              </Link>
            </>
          )}
          </div>

          {/* Language Selector - Desktop Only */}
          <div className="hidden md:flex gap-1 flex-shrink-0 min-w-fit">
            <div className="language-dropdown relative z-[2000]">
              <button 
                ref={languageBtnRef}
                className="px-2 py-2 bg-white/10 text-white border border-white/30 rounded hover:bg-white/20 transition-all flex items-center gap-1 font-semibold"
                onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
                title="Change language"
              >
                <img 
                  src={`https://flagcdn.com/w20/${currentLanguage.countryCode}.png`}
                alt={currentLanguage.code}
                className="w-5 h-3 rounded flex-shrink-0 max-sm:w-4 max-sm:h-2.5"
              />
              <span className="text-sm max-sm:hidden max-md:text-xs">{currentLanguage.code.toUpperCase()}</span>
            </button>
            {languageDropdownOpen && languageDropdownPosition && createPortal(
              <div 
                className="bg-white text-gray-800 min-w-[150px] rounded shadow-md z-[9999] overflow-hidden flex flex-col"
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
                    className={`flex items-center gap-2 w-full text-left px-3 py-2 transition-colors text-xs md:text-sm ${
                      lang.code === i18n.language 
                        ? 'bg-blue-100 font-semibold text-secondary' 
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => changeLanguage(lang.code)}
                  >
                    <img 
                      src={`https://flagcdn.com/w20/${lang.countryCode}.png`}
                      alt={lang.code}
                      className="w-5 h-3 rounded flex-shrink-0"
                    />
                    <span className="text-xs md:text-sm">{lang.code.toUpperCase()}</span>
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
        </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
