import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService, userService } from '../services/api';
import { useAuthStore } from '../store/authStore';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setToken, setUserId, setIsAdmin } = useAuthStore();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await authService.login(usernameOrEmail, password);
      
      // Validate token before storing
      if (!response.data.token || !response.data.userId) {
        throw new Error('Invalid response: missing token or userId');
      }
      
      setToken(response.data.token);
      setUserId(response.data.userId);
      
      // Get user profile to check if admin and if password must be changed
      try {
        const profileRes = await userService.getProfile();
        if (import.meta.env.VITE_DEBUG_LOGS === 'true') {
          console.log('Profile response:', profileRes.data);
          console.log('is_admin value:', profileRes.data.is_admin);
          console.log('password_must_change:', profileRes.data.password_must_change);
        }
        setIsAdmin(profileRes.data.is_admin || false);
        
        // Check if user must change password
        if (profileRes.data.password_must_change) {
          // Redirect to forced password change page
          sessionStorage.setItem('mustChangePassword', 'true');
          navigate('/force-password-change');
          return;
        }
      } catch (err) {
        console.error('Error getting profile:', err);
        setIsAdmin(false);
      }
      
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-12 px-4 bg-white rounded-lg shadow-sm py-8">
      <h1 className="text-center mb-6 text-2xl font-bold text-gray-800">{t('login_title')}</h1>
      {error && <p className="bg-red-100 text-red-800 px-4 py-3 rounded-md mb-4 border-l-4 border-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder={t('login_nickname_or_email')} 
          value={usernameOrEmail}
          onChange={(e) => setUsernameOrEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          required
        />
        <input
          type="password"
          placeholder={t('login_password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          required
        />
        <button type="submit" disabled={loading} className="w-full px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
          {loading ? 'Loading...' : t('login_button')}
        </button>
      </form>
      <p className="text-center mt-4">
        {t('login_register')} <a href="/register" className="text-blue-500 hover:underline">Register</a>
      </p>
      <p className="text-center mt-4">
        {t('login_forgot_password')} <a href="/forgot-password" className="text-blue-500 hover:underline">Forgot Password?</a>
      </p>
    </div>
  );
};

export default Login;
