import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authService, userService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import MainLayout from '../components/MainLayout';
import ProfileStats from '../components/ProfileStats';
import { CountrySelector } from '../components/CountrySelector';
import { AvatarSelector } from '../components/AvatarSelector';

const Profile: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [discordMessage, setDiscordMessage] = useState('');
  const [discordError, setDiscordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [updatingDiscord, setUpdatingDiscord] = useState(false);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [showPasswordHints, setShowPasswordHints] = useState(false);
  const [preferencesCollapsed, setPreferencesCollapsed] = useState(false);
  const [avatarSectionCollapsed, setAvatarSectionCollapsed] = useState(true);

  const languages = useMemo(() => [
    { code: 'en', name: 'English', countryCode: 'us' },
    { code: 'es', name: 'Español', countryCode: 'es' },
    { code: 'zh', name: '中文', countryCode: 'cn' },
    { code: 'de', name: 'Deutsch', countryCode: 'de' },
    { code: 'ru', name: 'Русский', countryCode: 'ru' },
  ], []);

  const currentLanguage = useMemo(() => 
    languages.find(l => l.code === selectedLanguage) || languages[0],
    [selectedLanguage, languages]
  );

  const passwordRules = useMemo(() => [
    { regex: /.{8,}/, label: 'At least 8 characters' },
    { regex: /[A-Z]/, label: 'At least one uppercase letter' },
    { regex: /[a-z]/, label: 'At least one lowercase letter' },
    { regex: /[0-9]/, label: 'At least one number' },
    { regex: /[!@#$%^&*(),.?":{}|<>]/, label: 'At least one special character' },
  ], []);

  const getPasswordValidation = useCallback(() => {
    return passwordRules.map(rule => ({
      ...rule,
      satisfied: rule.regex.test(newPassword)
    }));
  }, [newPassword, passwordRules]);

  const passwordValidation = useMemo(() => getPasswordValidation(), [getPasswordValidation]);
  const isNewPasswordValid = useMemo(() => passwordValidation.every(rule => rule.satisfied), [passwordValidation]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch profile data
        const profileRes = await userService.getProfile();
        console.log('Profile data:', profileRes.data);
        console.log('Country from API:', profileRes.data.country);
        console.log('Avatar from API:', profileRes.data.avatar);
        console.log('Language from API:', profileRes.data.language);
        
        setProfile(profileRes.data);
        
        // Initialize selectors with values from profile
        if (profileRes.data.country) {
          setSelectedCountry(profileRes.data.country);
        }
        if (profileRes.data.avatar) {
          setSelectedAvatar(profileRes.data.avatar);
        }
        
        // Set language from profile
        const langFromDB = profileRes.data.language || 'en';
        console.log('Setting selectedLanguage to:', langFromDB);
        setSelectedLanguage(langFromDB);
        setDiscordId(profileRes.data.discord_id || '');
        console.log('Discord ID from API:', profileRes.data.discord_id);
        
        // Change i18n if different
        if (langFromDB !== i18n.language) {
          i18n.changeLanguage(langFromDB);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, navigate, i18n]);

  const handleLanguageChange = useCallback(async (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    setLanguageDropdownOpen(false);
    setDiscordMessage(t('profile_language_updated') || 'Language updated');
    setTimeout(() => setDiscordMessage(''), 3000);
  }, [t, i18n]);

  const handleCountryChange = useCallback(async (countryCode: string) => {
    setSelectedCountry(countryCode);
    try {
      const res = await userService.updateProfile({ country: countryCode });
      setProfile(res.data);
      setDiscordMessage(t('profile.country_updated') || 'Country updated');
      setTimeout(() => setDiscordMessage(''), 3000);
    } catch (err: any) {
      console.error('Error updating country:', err);
      setDiscordError(err.response?.data?.error || t('profile.error_update_country_failed'));
    }
  }, [t]);

  const handleAvatarChange = useCallback(async (avatarId: string) => {
    setSelectedAvatar(avatarId);
    try {
      const res = await userService.updateProfile({ avatar: avatarId });
      setProfile(res.data);
      setDiscordMessage(t('profile.avatar_updated') || 'Avatar updated');
      setTimeout(() => setDiscordMessage(''), 3000);
    } catch (err: any) {
      console.error('Error updating avatar:', err);
      setDiscordError(err.response?.data?.error || t('profile.error_update_avatar_failed'));
    }
  }, [t]);

  const handleDiscordUpdate = useCallback(async () => {
    if (!discordId.trim()) {
      setDiscordError(t('profile.error_discord_empty'));
      return;
    }

    setUpdatingDiscord(true);
    setDiscordError('');
    setDiscordMessage('');

    try {
      // Debug: show payload and token presence
      console.log('Attempting Discord ID update, payload:', { discordId });
      const token = localStorage.getItem('token');
      console.log('Auth token present:', !!token);

      const res = await userService.updateDiscordId(discordId);
      console.log('Discord update response:', res);
      setProfile(res.data);
      setDiscordMessage(t('discord_id_updated'));
      setTimeout(() => setDiscordMessage(''), 3000);
    } catch (err: any) {
      console.error('Error updating Discord ID:', err);
      // Prefer server message, then axios message, then generic
      const serverMsg = err?.response?.data?.error;
      const axiosMsg = err?.message;
      setDiscordError(serverMsg || axiosMsg || t('profile.error_update_discord_failed'));
    } finally {
      setUpdatingDiscord(false);
    }
  }, [discordId, t]);

  const handleChangePassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('profile.error_all_fields_required'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.error_passwords_not_match'));
      return;
    }

    // Validate against all password rules
    const failedRules = passwordValidation.filter(rule => !rule.satisfied);
    if (failedRules.length > 0) {
      setPasswordError(`Password requirements not met: ${failedRules.map(r => r.label).join(', ')}`);
      return;
    }

    setChangingPassword(true);
    setPasswordError('');
    setPasswordMessage('');

    try {
      await authService.changePassword(oldPassword, newPassword);
      setPasswordMessage(t('profile.password_changed_success'));
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMessage(''), 3000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || t('profile.error_change_password_failed'));
    } finally {
      setChangingPassword(false);
    }
  }, [oldPassword, newPassword, confirmPassword, passwordValidation, t]);

  if (loading) {
    return <div className="auth-container"><p>{t('loading')}</p></div>;
  }

  if (!profile) {
    return <div className="auth-container"><p>{t('profile.not_found')}</p></div>;
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">{t('profile.title')}</h1>

          {profile && (
            <>
              <ProfileStats player={profile} />

              <section className="bg-white rounded-lg shadow-md p-8 mb-8">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-4 border-b-2 border-gray-200">{t('profile.info_title')}</h2>
                <div className="mb-6">
                  <label className="font-semibold text-gray-800 mb-2 block">{t('profile.label_email')}</label>
                  <p className="text-gray-600 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">{profile?.email}</p>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-md p-8 mb-8">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-4 border-b-2 border-gray-200">{t('profile.discord_title')}</h2>
                {discordMessage && <p className="bg-green-100 text-green-800 px-4 py-3 rounded-lg mb-4 border-l-4 border-green-600">{discordMessage}</p>}
                {discordError && <p className="bg-red-100 text-red-800 px-4 py-3 rounded-lg mb-4 border-l-4 border-red-600">{discordError}</p>}
                <div className="flex gap-3 max-md:flex-col">
                  <input
                    type="text"
                    placeholder={t('profile.discord_placeholder')}
                    value={discordId}
                    onChange={(e) => setDiscordId(e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                  <button 
                    onClick={handleDiscordUpdate} 
                    disabled={updatingDiscord}
                    className="px-6 py-3 max-md:w-full bg-gradient-to-r from-purple-500 to-purple-700 text-white rounded-lg font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {updatingDiscord ? t('profile.updating') : t('profile.update_discord_button')}
                  </button>
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-md p-8 mb-8">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-4 border-b-2 border-gray-200">{t('profile_language_settings')}</h2>
                <div className="relative inline-block">
                  <button 
                    className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-800 font-semibold hover:border-blue-500 hover:bg-gray-50 transition-all flex items-center gap-2"
                    onClick={() => setLanguageDropdownOpen(!languageDropdownOpen)}
                  >
                    <img 
                      src={`https://flagcdn.com/w20/${currentLanguage.countryCode}.png`}
                      alt={currentLanguage.code}
                      className="w-6 h-4 rounded"
                    />
                    <span>{currentLanguage.code.toUpperCase()}</span>
                  </button>
                  {languageDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 bg-white text-gray-800 min-w-max rounded-lg shadow-lg z-50 border border-gray-200 overflow-hidden">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors ${
                            lang.code === selectedLanguage 
                              ? 'bg-gradient-to-r from-gray-100 to-blue-100 text-blue-600 font-semibold border-l-4 border-blue-500 pl-3' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleLanguageChange(lang.code)}
                        >
                          <img 
                            src={`https://flagcdn.com/w20/${lang.countryCode}.png`}
                            alt={lang.code}
                            className="w-6 h-4 rounded"
                          />
                          <span>{lang.code.toUpperCase()} - {lang.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-white rounded-lg shadow-md mb-8">
                <div 
                  className="p-8 cursor-pointer flex justify-between items-center hover:bg-gray-50 transition-colors"
                  onClick={() => setPreferencesCollapsed(!preferencesCollapsed)}
                >
                  <h2 className="text-2xl font-semibold text-gray-800 pb-0">{t('profile.preferences_title') || 'Preferences'}</h2>
                  <svg 
                    className={`w-6 h-6 text-gray-600 transition-transform ${preferencesCollapsed ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                {!preferencesCollapsed && (
                  <div className="p-8 pt-0 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <CountrySelector
                        value={selectedCountry}
                        onChange={handleCountryChange}
                        showFlag={true}
                      />
                    </div>
                  </div>
                )}
              </section>

              <section className="bg-white rounded-lg shadow-md mb-8">
                <div className="p-8 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between" onClick={() => setAvatarSectionCollapsed(!avatarSectionCollapsed)}>
                  <h2 className="text-2xl font-semibold text-gray-800 pb-0">{t('profile.avatar') || 'Avatar'}</h2>
                  <svg 
                    className={`w-6 h-6 text-gray-600 transition-transform ${avatarSectionCollapsed ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                {!avatarSectionCollapsed && (
                  <div className="p-8 pt-0 border-t border-gray-200">
                    <AvatarSelector
                      value={selectedAvatar}
                      onChange={handleAvatarChange}
                    />
                  </div>
                )}

              <section className="bg-white rounded-lg shadow-md p-8 mb-8">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6 pb-4 border-b-2 border-gray-200">{t('password_change_title')}</h2>
                {passwordMessage && <p className="bg-green-100 text-green-800 px-4 py-3 rounded-lg mb-4 border-l-4 border-green-600">{passwordMessage}</p>}
                {passwordError && <p className="bg-red-100 text-red-800 px-4 py-3 rounded-lg mb-4 border-l-4 border-red-600">{passwordError}</p>}
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <input
                    type="password"
                    placeholder={t('password_current')}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                  <input
                    type="password"
                    placeholder={t('password_new')}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onFocus={() => setShowPasswordHints(true)}
                    onBlur={() => setShowPasswordHints(false)}
                    required
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${newPassword && !isNewPasswordValid ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'}`}
                  />
                  {showPasswordHints && newPassword && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="text-sm font-semibold text-gray-800 mb-3">Password requirements:</div>
                      {passwordValidation.map((rule, idx) => (
                        <div
                          key={idx}
                          className={`text-sm flex items-center gap-2 mb-2 ${rule.satisfied ? 'text-green-700' : 'text-gray-600'}`}
                        >
                          <span className={`${rule.satisfied ? 'text-green-500' : 'text-red-500'}`}>{rule.satisfied ? '✓' : '✗'}</span>
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    type="password"
                    placeholder={t('password_confirm')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${newPassword && confirmPassword && newPassword !== confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'}`}
                  />
                  <button 
                    type="submit" 
                    disabled={changingPassword || !isNewPasswordValid}
                    className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {changingPassword ? t('profile.changing') : t('password_change_button')}
                  </button>
                </form>
              </section>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Profile;
