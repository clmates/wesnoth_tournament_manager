import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import '../styles/Auth.css';

const ForcePasswordChange: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
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
    // Check if user has been authenticated and has the forced password change flag
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const flag = sessionStorage.getItem('mustChangePassword');
    if (flag !== 'true') {
      // Not in forced password change mode, redirect to home
      navigate('/');
      return;
    }
  }, [isAuthenticated, navigate]);

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
      // Use the new force-change-password endpoint that doesn't require old password
      await api.post('/auth/force-change-password', {
        newPassword
      });
      setMessage('Password changed successfully! Redirecting to home...');
      sessionStorage.removeItem('mustChangePassword');
      
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0] || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Change Your Password</h1>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '1.5rem', fontWeight: '500' }}>
          Your password was reset by an administrator. Please set a new password to continue.
        </p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="newPassword">New Password:</label>
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
              className={newPassword && !isPasswordValid ? 'input-invalid' : ''}
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
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password:</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••"
              disabled={loading}
              required
              className={newPassword && confirmPassword && newPassword !== confirmPassword ? 'input-invalid' : ''}
            />
          </div>

          <button type="submit" disabled={loading || !isPasswordValid}>
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
