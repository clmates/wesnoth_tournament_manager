import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { CountrySelector } from '../components/CountrySelector';
import { AvatarSelector } from '../components/AvatarSelector';
import LanguageSelector from '../components/LanguageSelector';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    nickname: '',
    password: '',
    confirmPassword: '',
    discordId: '',
    country: '',
    avatar: '',
    language: i18n.language || 'en',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordHints, setShowPasswordHints] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [avatarSectionCollapsed, setAvatarSectionCollapsed] = useState(true);

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
        country: formData.country || null,
        avatar: formData.avatar || null,
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
    <div className="w-full max-w-4xl mx-auto my-12 px-4 bg-white rounded-lg shadow-sm py-8">
      <div>
        <h1 className="text-center mb-6 text-2xl font-bold text-gray-800">Create Account</h1>
        
        {error && <div className="bg-red-100 text-red-800 px-4 py-3 rounded-md mb-4 border-l-4 border-red-600">{error}</div>}
        {success && <div className="bg-green-100 text-green-800 px-4 py-3 rounded-md mb-4 border-l-4 border-green-600">{success}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="mb-6">
            <label htmlFor="email" className="block font-semibold text-gray-800 mb-2 text-sm">Email:</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="your@email.com"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="nickname" className="block font-semibold text-gray-800 mb-2 text-sm">Nickname:</label>
            <input
              id="nickname"
              type="text"
              name="nickname"
              value={formData.nickname}
              onChange={handleInputChange}
              placeholder="your_nickname"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              required
            />
            <small className="text-gray-600 text-xs mt-1 block">3-20 characters, letters, numbers, and underscores only</small>
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block font-semibold text-gray-800 mb-2 text-sm">Password:</label>
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
              className={formData.password && !isPasswordValid ? 'w-full px-3 py-2 border border-red-500 rounded-md focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed' : 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed'}
            />
            {showPasswordHints && (
              <div className="mt-4 p-4 bg-gray-50 border-l-4 border-blue-500 rounded-md animate-slideDown">
                <div className="font-semibold text-gray-800 mb-2 text-sm">Password requirements:</div>
                {passwordValidation.map((rule, idx) => (
                  <div
                    key={idx}
                    className={rule.satisfied ? 'inline-flex items-center gap-2 mb-2 text-green-600 text-sm' : 'inline-flex items-center gap-2 mb-2 text-gray-500 text-sm'}
                  >
                    <span className="font-bold">{rule.satisfied ? '✓' : '✗'}</span>
                    <span>{rule.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block font-semibold text-gray-800 mb-2 text-sm">Confirm Password:</label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="••••••"
              disabled={loading}
              required
              className={formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword ? 'w-full px-3 py-2 border border-red-500 rounded-md focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 transition-all bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed' : 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed'}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="discordId" className="block font-semibold text-gray-800 mb-2 text-sm">Discord ID (Optional):</label>
            <input
              id="discordId"
              type="text"
              name="discordId"
              value={formData.discordId}
              onChange={handleInputChange}
              placeholder="your_discord_id"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <small className="text-gray-600 text-xs mt-1 block">Your Discord user ID for notifications</small>
          </div>

          <div className="mb-6">
            <LanguageSelector
              selectedLanguage={formData.language}
              onLanguageChange={(language) => {
                setFormData((prev) => ({ ...prev, language }));
                i18n.changeLanguage(language);
              }}
              label={t('register_language')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4 p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
            <CountrySelector
              value={formData.country}
              onChange={(country) => setFormData(prev => ({ ...prev, country }))}
              showFlag={true}
              disabled={loading}
            />
          </div>

          <div className="my-4 border border-gray-200 rounded-lg bg-gray-50">
            <button
              type="button"
              onClick={() => setAvatarSectionCollapsed(!avatarSectionCollapsed)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors font-semibold text-gray-800 rounded-lg"
            >
              <span>{t('profile.avatar') || 'Avatar'}</span>
              <span className={`text-lg transition-transform ${avatarSectionCollapsed ? '' : 'rotate-180'}`}>▼</span>
            </button>
            {!avatarSectionCollapsed && (
              <div className="p-4 border-t border-gray-200">
                <AvatarSelector
                  value={formData.avatar}
                  onChange={(avatar) => setFormData(prev => ({ ...prev, avatar }))}
                  disabled={loading}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="text-center mt-4">
          Already have an account? <a href="/login" className="text-blue-500 hover:underline">Login here</a>
        </p>
      </div>

      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-9999 animate-fadeIn" onClick={() => {
          setShowWelcomeModal(false);
          navigate('/login');
        }}>
          <div className="bg-white p-10 rounded-xl max-w-md w-11/12 shadow-2xl animate-slideIn" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-gray-800 mb-4 text-center text-2xl font-bold">🎉 Welcome to Wesnoth Tournament Manager!</h2>
            <p className="text-gray-700 text-center leading-relaxed mb-4">Your account has been created successfully.</p>
            <p className="bg-blue-100 border-l-4 border-blue-400 p-4 text-blue-800 font-medium text-center mb-6 rounded">
              📧 Please check your email and follow the verification link to activate your account.
            </p>
            <div className="bg-indigo-50 border-2 border-indigo-500 rounded-lg p-6 mb-6 text-center">
              <p className="text-gray-800 mb-2"><strong className="text-indigo-600 text-lg">Join our Discord community:</strong></p>
              <a 
                href="https://discord.gg/XUTpvBQNP6" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block bg-indigo-500 text-white px-6 py-3 rounded-lg font-semibold text-lg my-4 hover:bg-indigo-600 transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                https://discord.gg/XUTpvBQNP6
              </a>
              <p className="text-gray-700 text-sm italic">You'll receive a notification there when your account is approved!</p>
            </div>
            <button 
              className="w-full px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-semibold"
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
