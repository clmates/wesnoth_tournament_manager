import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService, userService } from '../services/api';
import { useAuthStore } from '../store/authStore';

const Login: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setToken, setUserId, setIsAdmin } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Login with Wesnoth credentials
      const response = await authService.login(username, password);
      
      // Validate token before storing
      if (!response.data.token || !response.data.userId) {
        throw new Error('Invalid response: missing token or userId');
      }
      
      setToken(response.data.token);
      setUserId(response.data.userId);
      localStorage.setItem('username', response.data.username);
      
      // Get user profile to check if admin
      try {
        const profileRes = await userService.getProfile();
        setIsAdmin(profileRes.data.is_admin || false);
        
        // Change language to user's preferred language
        const userLanguage = profileRes.data.language || 'en';
        if (userLanguage !== i18n.language) {
          i18n.changeLanguage(userLanguage);
        }
      } catch (err) {
        console.error('Error getting profile:', err);
        setIsAdmin(false);
      }
      
      navigate('/');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Login failed. Please check your credentials.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-12 px-4 bg-white rounded-lg shadow-sm py-8">
      <h1 className="text-center mb-2 text-2xl font-bold text-gray-800">{t('login_title')}</h1>
      <p className="text-center mb-6 text-gray-600">{t('login_wesnoth_account', 'Log in with your Wesnoth account')}</p>
      
      {error && (
        <p className="bg-red-100 text-red-800 px-4 py-3 rounded-md mb-4 border-l-4 border-red-600">
          {error}
        </p>
      )}
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder={t('login_username', 'Wesnoth Username')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          required
          disabled={loading}
          autoFocus
        />
        
        <input
          type="password"
          placeholder={t('login_password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          required
          disabled={loading}
        />
        
        <button 
          type="submit" 
          disabled={loading} 
          className="w-full px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? t('login_loading', 'Logging in...') : t('login_button')}
        </button>
      </form>
      
      <p className="text-center mt-6 text-sm text-gray-600">
        {t('login_need_account', "Don't have a Wesnoth account?")}{' '}
        <a 
          href="https://www.wesnoth.org/account/register" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          {t('login_create_wesnoth', 'Create one on Wesnoth.org')}
        </a>
      </p>
    </div>
  );
};

export default Login;
