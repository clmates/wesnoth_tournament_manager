import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import MainLayout from '../components/MainLayout';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (confirm = false) => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.post('/auth/request-password-reset', {
        nickname: input.includes('@') ? undefined : input,
        email: input.includes('@') ? input : undefined,
        confirm,
      });
      if (res.data.requiresConfirmation) {
        setMaskedEmail(res.data.maskedEmail);
        setRequiresConfirmation(true);
      } else {
        setSuccess(res.data.message || t('auth.reset_email_sent'));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.reset_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleRequest(false);
  };

  const handleConfirm = () => {
    handleRequest(true);
  };

  return (
    <MainLayout>
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded shadow">
        <h2 className="text-xl font-bold mb-4">{t('auth.reset_password') || 'Restablecer contraseña'}</h2>
        {error && <div className="mb-4 text-red-600">{error}</div>}
        {success && <div className="mb-4 text-green-600">{success}</div>}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!requiresConfirmation ? (
              <>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder={t('auth.nickname_or_email') || 'Nickname o email'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  {t('auth.send_reset') || 'Solicitar reseteo'}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-gray-700">
                  {t('auth.reset_email_will_be_sent') || 'Se enviará un email de reseteo a:'} <span className="font-bold">{maskedEmail}</span>
                </div>
                <button
                  type="button"
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  onClick={handleConfirm}
                  disabled={loading}
                >
                  {t('auth.confirm_and_send') || 'Confirmar y enviar email'}
                </button>
              </div>
            )}
          </form>
        )}
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
      </div>
    </MainLayout>
  );
};

export default ForgotPassword;
