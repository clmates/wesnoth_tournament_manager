import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authService, userService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import MainLayout from '../components/MainLayout';
import '../styles/UserProfile.css';

const Profile: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
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

  const languages = [
    { code: 'en', name: 'English', countryCode: 'us' },
    { code: 'es', name: 'Español', countryCode: 'es' },
    { code: 'zh', name: '中文', countryCode: 'cn' },
    { code: 'de', name: 'Deutsch', countryCode: 'de' },
    { code: 'ru', name: 'Русский', countryCode: 'ru' },
  ];

  const currentLanguage = languages.find(l => l.code === selectedLanguage) || languages[0];

  const passwordRules = [
    { regex: /.{8,}/, label: 'At least 8 characters' },
    { regex: /[A-Z]/, label: 'At least one uppercase letter' },
    { regex: /[a-z]/, label: 'At least one lowercase letter' },
    { regex: /[0-9]/, label: 'At least one number' },
    { regex: /[!@#$%^&*(),.?":{}|<>]/, label: 'At least one special character' },
  ];

  const getPasswordValidation = () => {
    return passwordRules.map(rule => ({
      ...rule,
      satisfied: rule.regex.test(newPassword)
    }));
  };

  const passwordValidation = getPasswordValidation();
  const isNewPasswordValid = passwordValidation.every(rule => rule.satisfied);

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
        console.log('Language from API:', profileRes.data.language);
        setProfile(profileRes.data);
        
        // Asegurarse de que se usa el idioma del perfil, no el actual de i18n
        const langFromDB = profileRes.data.language || 'en';
        console.log('Setting selectedLanguage to:', langFromDB);
        setSelectedLanguage(langFromDB);
        setDiscordId(profileRes.data.discord_id || '');
        console.log('Discord ID from API:', profileRes.data.discord_id);
        
        // Cambiar i18n si es diferente
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
  }, [isAuthenticated, navigate]);

  const handleLanguageChange = async (lang: string) => {
    setSelectedLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    setLanguageDropdownOpen(false);
    setDiscordMessage(t('profile_language_updated') || 'Language updated');
    setTimeout(() => setDiscordMessage(''), 3000);
  };

  const handleDiscordUpdate = async () => {
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
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Si es cambio forzado, no requiere contraseña antigua
    const requiresOldPassword = !mustChangePassword;
    
    if (requiresOldPassword && !oldPassword) {
      setPasswordError(t('profile.error_all_fields_required'));
      return;
    }

    if (!newPassword || !confirmPassword) {
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
  };

  if (loading) {
    return <div className="auth-container"><p>{t('loading')}</p></div>;
  }

  if (!profile) {
    return <div className="auth-container"><p>{t('profile.not_found')}</p></div>;
  }

  return (
    <MainLayout>
      <div className="profile-page-content">
        <h1>{t('profile.title')}</h1>

        {mustChangePassword && (
          <div className="alert-password-must-change">
            <strong>⚠️ Important:</strong> Your password has been reset by an administrator. You must change it immediately before continuing.
          </div>
        )}

        {profile && (
          <>
            {!mustChangePassword && (
              <>
                <section className="profile-info">
                  <h2>{t('profile.info_title')}</h2>
                  <div className="info-group">
                    <label>{t('profile.label_nickname')}</label>
                    <p>{profile?.nickname}</p>
                  </div>
                  <div className="info-group">
                    <label>{t('profile.label_email')}</label>
                    <p>{profile?.email}</p>
                  </div>
                  <div className="info-group">
                    <label>{t('profile.label_elo')}</label>
                    <p>
                      {profile?.is_rated ? (
                        <>
                          {profile?.elo_rating || 1200}
                        </>
                      ) : (
                        <>
                          <span style={{ color: '#e67e22', fontWeight: 'bold' }}>{t('unrated')}</span>
                          {profile?.matches_played > 0 && (
                            <span style={{ marginLeft: '10px', fontSize: '0.9em' }}>
                              ({profile?.matches_played}/5 {t('matches_label')})
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
              <div className="info-group">
                <label>{t('profile.label_level')}</label>
                <p>{profile?.level || t('level_novice')}</p>
              </div>
            </section>

            <section className="discord-settings">
              <h2>{t('profile.discord_title')}</h2>
              {discordMessage && <p className="success-message">{discordMessage}</p>}
              {discordError && <p className="error">{discordError}</p>}
              <div className="discord-input-group">
                <input
                  type="text"
                  placeholder={t('profile.discord_placeholder')}
                  value={discordId}
                  onChange={(e) => setDiscordId(e.target.value)}
                />
                <button onClick={handleDiscordUpdate} disabled={updatingDiscord}>
                  {updatingDiscord ? t('profile.updating') : t('profile.update_discord_button')}
                </button>
              </div>
            </section>

            <section className="language-settings">
              <h2>{t('profile_language_settings')}</h2>
              <div className="language-dropdown-profile">
                <button 
                  className="language-btn-profile"
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
                  <div className="language-menu-profile">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        className={`language-option-profile ${lang.code === selectedLanguage ? 'active' : ''}`}
                        onClick={() => handleLanguageChange(lang.code)}
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
            </section>
              </>
            )}

            <section className="change-password">
              <h2>{t('password_change_title')}</h2>
              {passwordMessage && <p className="success-message">{passwordMessage}</p>}
              {passwordError && <p className="error">{passwordError}</p>}
              <form onSubmit={handleChangePassword}>
                {!mustChangePassword && (
                  <input
                    type="password"
                    placeholder={t('password_current')}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                  />
                )}
                {mustChangePassword && (
                  <p style={{ color: '#e67e22', fontWeight: 'bold', marginBottom: '1rem' }}>
                    Enter your new password below:
                  </p>
                )}
                <input
                  type="password"
                  placeholder={t('password_new')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={() => setShowPasswordHints(true)}
                  onBlur={() => setShowPasswordHints(false)}
                  required
                  className={newPassword && !isNewPasswordValid ? 'input-invalid' : ''}
                />
                {showPasswordHints && newPassword && (
                  <div className="password-hints">
                    <div className="password-hint-label">Password requirements:</div>
                    {passwordValidation.map((rule, idx) => (
                      <div
                        key={idx}
                        className={`password-hint ${rule.satisfied ? 'satisfied' : 'unsatisfied'}`}
                      >
                        <span className="hint-icon">{rule.satisfied ? '✓' : '✗'}</span>
                        <span className="hint-text">{rule.label}</span>
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
                  className={newPassword && confirmPassword && newPassword !== confirmPassword ? 'input-invalid' : ''}
                />
                <button type="submit" disabled={changingPassword || (newPassword && !isNewPasswordValid)}>
                  {changingPassword ? t('profile.changing') : t('password_change_button')}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default Profile;
