import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import '../styles/Auth.css';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    nickname: '',
    password: '',
    confirmPassword: '',
    discordId: '',
    language: i18n.language || 'en',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordHints, setShowPasswordHints] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

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
      satisfied: rule.regex.test(formData.password)
    }));
  };

  const passwordValidation = getPasswordValidation();
  const isPasswordValid = passwordValidation.every(rule => rule.satisfied);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.email || !formData.nickname || !formData.password || !formData.confirmPassword) {
      setError('Email, nickname, and password are required');
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    // Validate nickname format (alphanumeric and underscore, 3-20 chars)
    const nicknameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!nicknameRegex.test(formData.nickname)) {
      setError('Nickname must be 3-20 characters and contain only letters, numbers, and underscores');
      return false;
    }

    // Validate password against all rules
    const validation = getPasswordValidation();
    const failedRules = validation.filter(rule => !rule.satisfied);
    if (failedRules.length > 0) {
      setError(`Password requirements not met: ${failedRules.map(r => r.label).join(', ')}`);
      return false;
    }

    // Validate password match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        email: formData.email,
        nickname: formData.nickname,
        password: formData.password,
        discord_id: formData.discordId || null,
        language: formData.language,
      });

      setSuccess('Registration successful!');
      setShowWelcomeModal(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Create Account</h1>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="your@email.com"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="nickname">Nickname:</label>
            <input
              id="nickname"
              type="text"
              name="nickname"
              value={formData.nickname}
              onChange={handleInputChange}
              placeholder="your_nickname"
              disabled={loading}
              required
            />
            <small>3-20 characters, letters, numbers, and underscores only</small>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              onFocus={() => setShowPasswordHints(true)}
              onBlur={() => setShowPasswordHints(false)}
              placeholder="••••••"
              disabled={loading}
              required
              className={formData.password && !isPasswordValid ? 'input-invalid' : ''}
            />
            {showPasswordHints && (
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
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="••••••"
              disabled={loading}
              required
              className={formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword ? 'input-invalid' : ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="discordId">Discord ID (Optional):</label>
            <input
              id="discordId"
              type="text"
              name="discordId"
              value={formData.discordId}
              onChange={handleInputChange}
              placeholder="your_discord_id"
              disabled={loading}
            />
            <small>Your Discord user ID for notifications</small>
          </div>

          <div className="form-group">
            <label htmlFor="language">Preferred Language:</label>
            <select
              id="language"
              name="language"
              value={formData.language}
              onChange={handleInputChange}
              disabled={loading}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <a href="/login">Login here</a>
        </p>
      </div>

      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="modal-overlay" onClick={() => {
          setShowWelcomeModal(false);
          navigate('/login');
        }}>
          <div className="modal-content welcome-modal" onClick={(e) => e.stopPropagation()}>
            <h2>🎉 Welcome to Wesnoth Tournament Manager!</h2>
            <p>Your account has been created successfully.</p>
            <p className="warning-text">
              ⚠️ Your account is temporarily locked. An admin will review and unlock it soon.
            </p>
            <div className="discord-invite">
              <p><strong>Join our Discord community:</strong></p>
              <a 
                href="https://discord.gg/XUTpvBQNP6" 
                target="_blank" 
                rel="noopener noreferrer"
                className="discord-link"
              >
                https://discord.gg/XUTpvBQNP6
              </a>
              <p className="discord-note">You'll receive a notification there when your account is approved!</p>
            </div>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setShowWelcomeModal(false);
                navigate('/login');
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
