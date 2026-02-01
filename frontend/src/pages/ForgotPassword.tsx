import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../components/MainLayout';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.post('/auth/request-password-reset', {
        email,
      });
      setSuccess(res.data.message || t('auth.reset_email_sent') || 'If an account exists with that email, you will receive a password reset link.');
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.reset_error') || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded shadow">
        <h2 className="text-xl font-bold mb-4">{t('auth.reset_password') || 'Reset Password'}</h2>
        {error && <div className="mb-4 text-red-600">{error}</div>}
        {success && <div className="mb-4 text-green-600">{success}</div>}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-gray-600 text-sm mb-4">
              {t('auth.reset_password_description') || 'Enter your email address. If an account exists with that email, you will receive a password reset link.'}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('auth.email') || 'Email'}
              </label>
              <input
                type="email"
                className="w-full border rounded px-3 py-2"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? t('loading') || 'Loading...' : t('auth.send_reset') || 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full text-blue-600 py-2 rounded hover:underline"
            >
              {t('auth.back_to_login') || 'Back to Login'}
            </button>
          </form>
        )}
        {success && (
          <div className="text-center mt-6">
            <p className="text-gray-600">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-blue-500 hover:underline font-semibold"
              >
                {t('auth.back_to_login') || 'Back to Login'}
              </button>
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ForgotPassword;
