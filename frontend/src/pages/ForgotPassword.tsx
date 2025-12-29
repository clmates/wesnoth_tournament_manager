import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import MainLayout from '../components/MainLayout';
import '../styles/Auth.css';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [nickname, setNickname] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [discordAvailable, setDiscordAvailable] = useState(true);
  const [checkingDiscord, setCheckingDiscord] = useState(true);

  // Check if Discord password reset is available
  useEffect(() => {
    const checkDiscord = async () => {
      try {
        const response = await authService.checkDiscordPasswordResetAvailable();
        setDiscordAvailable(response.data.available);
      } catch (err) {
        console.error('Error checking Discord availability:', err);
        setDiscordAvailable(false);
      } finally {
        setCheckingDiscord(false);
      }
    };

    checkDiscord();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!nickname.trim() || !discordId.trim()) {
      setError(t('auth.error_all_fields_required') || 'All fields are required');
      return;
    }

    setLoading(true);
    try {
      await authService.requestPasswordReset({
        nickname: nickname.trim(),
        discord_id: discordId.trim()
      });

      setMessage(t('auth.password_reset_sent') || 'If your account and Discord ID match, you will receive a temporary password via Discord DM');
      setSubmitted(true);
      
      // Reset form
      setNickname('');
      setDiscordId('');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || 'Request failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="auth-container">
        <div className="auth-card">
          <h1>{t('auth.forgot_password') || 'Forgot Password?'}</h1>
          
          {checkingDiscord ? (
            <p className="loading-message">{t('auth.loading') || 'Loading...'}</p>
          ) : !discordAvailable ? (
            <>
              <p className="error-message">
                ❌ {t('auth.discord_not_available') || 'Discord integration is not enabled on this server. Please contact an administrator for password reset assistance.'}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="auth-button"
              >
                {t('auth.return_to_login')}
              </button>
            </>
          ) : !submitted ? (
            <>
              <p className="auth-description">
                {t('auth.forgot_password_description') || 'Enter your nickname and Discord ID to receive a temporary password via Discord DM. You will be required to change it after logging in.'}
              </p>

              {error && <p className="error-message">{error}</p>}
              {message && <p className="success-message">{message}</p>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="nickname">{t('auth.label_nickname')}</label>
                  <input
                    id="nickname"
                    type="text"
                    placeholder={t('auth.placeholder_nickname')}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="discord_id">{t('auth.label_discord_id')}</label>
                  <input
                    id="discord_id"
                    type="text"
                    placeholder={t('auth.placeholder_discord_id')}
                    value={discordId}
                    onChange={(e) => setDiscordId(e.target.value)}
                    disabled={loading}
                  />
                  <small className="form-hint">
                    {t('auth.discord_id_hint') || 'Your Discord ID can be found in Discord user settings when Developer Mode is enabled'}
                  </small>
                </div>

                <button type="submit" disabled={loading} className="auth-button">
                  {loading ? t('auth.loading') : t('auth.send_reset')}
                </button>
              </form>

              <div className="auth-footer">
                <p>
                  {t('auth.back_to_login')}{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="link-button"
                  >
                    {t('auth.login')}
                  </button>
                </p>
              </div>
            </>
          ) : (
            <div className="success-container">
              <p className="success-message">✅ {message}</p>
              <p className="auth-description">
                {t('auth.redirecting_to_login') || 'Redirecting to login in a few seconds...'}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="auth-button"
              >
                {t('auth.return_to_login')}
              </button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ForgotPassword;
