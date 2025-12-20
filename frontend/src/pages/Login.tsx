import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authService, userService } from '../services/api';
import { useAuthStore } from '../store/authStore';
import '../styles/Auth.css';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setToken, setUserId, setIsAdmin } = useAuthStore();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await authService.login(nickname, password);
      
      // Validate token before storing
      if (!response.data.token || !response.data.userId) {
        throw new Error('Invalid response: missing token or userId');
      }
      
      setToken(response.data.token);
      setUserId(response.data.userId);
      
      // Get user profile to check if admin and if password must be changed
      try {
        const profileRes = await userService.getProfile();
        console.log('Profile response:', profileRes.data);
        console.log('is_admin value:', profileRes.data.is_admin);
        console.log('password_must_change:', profileRes.data.password_must_change);
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
    <div className="auth-container">
      <h1>{t('login_title')}</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={t('login_nickname')}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={t('login_password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : t('login_button')}
        </button>
      </form>
      <p>
        {t('login_register')} <a href="/register">Register</a>
      </p>
    </div>
  );
};

export default Login;
