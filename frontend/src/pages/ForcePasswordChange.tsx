import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

const ForcePasswordChange: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordHints, setShowPasswordHints] = useState(false);

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
  const isPasswordValid = passwordValidation.every(rule => rule.satisfied);

  useEffect(() => {
    // Si hay token en la URL, permitir acceso al formulario sin autenticación ni flag
    if (token) return;
    // Si no hay token, requiere autenticación y flag
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const flag = sessionStorage.getItem('mustChangePassword');
    if (flag !== 'true') {
      navigate('/');
      return;
    }
  }, [isAuthenticated, navigate, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!newPassword || !confirmPassword) {
      setError('Both password fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordValid) {
      const failedRules = passwordValidation.filter(rule => !rule.satisfied);
      setError(`Password requirements not met: ${failedRules.map(r => r.label).join(', ')}`);
      return;
    }

    setLoading(true);

    try {
      if (token) {
        // Reset por email
        await api.post('/auth/reset-password', { token, newPassword });
        setMessage('Password changed successfully! You can now log in.');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        // Cambio forzado tras login
        await api.post('/auth/force-change-password', { newPassword });
        setMessage('Password changed successfully! Redirecting to home...');
        sessionStorage.removeItem('mustChangePassword');
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0] || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto my-12 px-4 bg-white rounded-lg shadow-sm py-8">
      <div>
        <h1 className="text-center text-2xl font-bold text-gray-800 mb-6">
          {token ? 'Reset Your Password' : 'Change Your Password'}
        </h1>
        <p className="text-center text-gray-600 mb-6 font-medium">
          {token
            ? 'You have requested a password reset. Please set a new password to continue.'
            : 'Your password was reset by an administrator. Please set a new password to continue.'}
        </p>

        {error && <div className="bg-red-100 text-red-800 px-4 py-3 rounded-md mb-4 border-l-4 border-red-600">{error}</div>}
        {message && <div className="bg-green-100 text-green-800 px-4 py-3 rounded-md mb-4 border-l-4 border-green-600">{message}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="newPassword" className="block font-semibold text-gray-700 mb-2">New Password:</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onFocus={() => setShowPasswordHints(true)}
              onBlur={() => setShowPasswordHints(false)}
              placeholder="••••••"
              disabled={loading}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
                newPassword && !isPasswordValid ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
              }`}
            />
            {showPasswordHints && newPassword && (
              <div className="mt-4 p-4 bg-gray-50 border-l-4 border-blue-500 rounded-md">
                <div className="font-semibold text-gray-700 mb-3">Password requirements:</div>
                {passwordValidation.map((rule, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 mb-2 ${rule.satisfied ? 'text-green-600' : 'text-gray-500'}`}
                  >
                    <span className={`font-bold ${rule.satisfied ? 'text-green-600' : 'text-gray-400'}`}>{rule.satisfied ? '✓' : '✗'}</span>
                    <span className="text-sm">{rule.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block font-semibold text-gray-700 mb-2">Confirm Password:</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••"
              disabled={loading}
              required
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
                newPassword && confirmPassword && newPassword !== confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
              }`}
            />
          </div>

          <button type="submit" disabled={loading || !isPasswordValid} className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
