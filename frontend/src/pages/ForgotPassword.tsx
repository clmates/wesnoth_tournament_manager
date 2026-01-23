import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import MainLayout from '../components/MainLayout';

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
      <div className="w-full max-w-4xl mx-auto my-12 px-4 bg-white rounded-lg shadow-sm py-8">
        <div>
          <h1 className="text-center text-2xl font-bold text-gray-800 mb-6">{t('auth.forgot_password') || 'Forgot Password?'}</h1>
          
          {checkingDiscord ? (
            <p className="text-center text-gray-600">{t('auth.loading') || 'Loading...'}</p>
          ) : !discordAvailable ? (
            <>
              <p className="bg-red-100 text-red-800 px-4 py-3 rounded-md mb-4 border-l-4 border-red-600">
                ❌ {t('auth.discord_not_available') || 'Discord integration is not enabled on this server. Please contact an administrator for password reset assistance.'}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-60"
              >
                {t('auth.return_to_login')}
              </button>
            </>
          ) : !submitted ? (
            <>
              <p className="text-center text-gray-600 mb-6">
                {t('auth.forgot_password_description') || 'Enter your nickname and Discord ID to receive a temporary password via Discord DM. You will be required to change it after logging in.'}
              </p>

              {error && <p className="bg-red-100 text-red-800 px-4 py-3 rounded-md mb-4 border-l-4 border-red-600">{error}</p>}
              {message && <p className="bg-green-100 text-green-800 px-4 py-3 rounded-md mb-4 border-l-4 border-green-600">{message}</p>}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="nickname" className="block font-semibold text-gray-700 mb-2">{t('auth.label_nickname')}</label>
                  <input
                    id="nickname"
                    type="text"
                    placeholder={t('auth.placeholder_nickname')}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    disabled={loading}
                    autoComplete="username"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50"
                  />
                </div>

                <div>
                  <label htmlFor="discord_id" className="block font-semibold text-gray-700 mb-2">{t('auth.label_discord_id')}</label>
                  <input
                    id="discord_id"
                    type="text"
                    placeholder={t('auth.placeholder_discord_id')}
                    value={discordId}
                    onChange={(e) => setDiscordId(e.target.value)}
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-50"
                  />
                </div>

                <button type="submit" disabled={loading} className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading ? t('auth.loading') : t('auth.send_reset')}
                </button>
              </form>

              <div className="text-center mt-6">
                <p className="text-gray-600">
                  {t('auth.back_to_login')}{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-blue-500 hover:underline font-semibold"
                  >
                    {t('auth.login')}
                  </button>
                </p>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="bg-green-100 text-green-800 px-4 py-3 rounded-md mb-4 border-l-4 border-green-600">✅ {message}</p>
              <p className="text-gray-600 mb-6">
                {t('auth.redirecting_to_login') || 'Redirecting to login in a few seconds...'}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
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
