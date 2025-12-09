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

  const languages = [
    { code: 'en', name: 'English', countryCode: 'us' },
    { code: 'es', name: 'Español', countryCode: 'es' },
    { code: 'zh', name: '中文', countryCode: 'cn' },
    { code: 'de', name: 'Deutsch', countryCode: 'de' },
    { code: 'ru', name: 'Русский', countryCode: 'ru' },
  ];

  const currentLanguage = languages.find(l => l.code === selectedLanguage) || languages[0];

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
      setDiscordError('Discord ID cannot be empty');
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
      setDiscordMessage(t('discord_id_updated') || 'Discord ID updated successfully');
      setTimeout(() => setDiscordMessage(''), 3000);
    } catch (err: any) {
      console.error('Error updating Discord ID:', err);
      // Prefer server message, then axios message, then generic
      const serverMsg = err?.response?.data?.error;
      const axiosMsg = err?.message;
      setDiscordError(serverMsg || axiosMsg || 'Failed to update Discord ID');
    } finally {
      setUpdatingDiscord(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    setPasswordError('');
    setPasswordMessage('');

    try {
      await authService.changePassword(oldPassword, newPassword);
      setPasswordMessage('Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMessage(''), 3000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return <div className="auth-container"><p>Loading...</p></div>;
  }

  if (!profile) {
    return <div className="auth-container"><p>Profile not found</p></div>;
  }

  return (
    <MainLayout>
      <div className="profile-page-content">
        <h1>My Profile</h1>

        {profile && (
          <>
            <section className="profile-info">
              <h2>Profile Information</h2>
              <div className="info-group">
                <label>Nickname:</label>
                <p>{profile?.nickname}</p>
              </div>
              <div className="info-group">
                <label>Email:</label>
                <p>{profile?.email}</p>
              </div>
              <div className="info-group">
                <label>ELO Rating:</label>
                <p>
                  {profile?.is_rated ? (
                    <>
                      {profile?.elo_rating || 1200}
                    </>
                  ) : (
                    <>
                      <span style={{ color: '#e67e22', fontWeight: 'bold' }}>Unrated</span>
                      {profile?.matches_played > 0 && (
                        <span style={{ marginLeft: '10px', fontSize: '0.9em' }}>
                          ({profile?.matches_played}/5 matches)
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
              <div className="info-group">
                <label>Level:</label>
                <p>{profile?.level || 'Novato'}</p>
              </div>
            </section>

            <section className="discord-settings">
              <h2>Discord ID</h2>
              {discordMessage && <p className="success-message">{discordMessage}</p>}
              {discordError && <p className="error">{discordError}</p>}
              <div className="discord-input-group">
                <input
                  type="text"
                  placeholder="Enter your Discord ID"
                  value={discordId}
                  onChange={(e) => setDiscordId(e.target.value)}
                />
                <button onClick={handleDiscordUpdate} disabled={updatingDiscord}>
                  {updatingDiscord ? 'Updating...' : 'Update Discord ID'}
                </button>
              </div>
            </section>

            <section className="language-settings">
              <h2>{t('profile_language_settings') || 'Language Settings'}</h2>
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

            <section className="change-password">
              <h2>Change Password</h2>
              {passwordMessage && <p className="success-message">{passwordMessage}</p>}
              {passwordError && <p className="error">{passwordError}</p>}
              <form onSubmit={handleChangePassword}>
                <input
                  type="password"
                  placeholder="Current Password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button type="submit" disabled={changingPassword}>
                  {changingPassword ? 'Changing...' : 'Change Password'}
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
