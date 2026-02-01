import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import MainLayout from '../components/MainLayout';

const VerifyEmail: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage(t('auth.verify_email_missing_token') || 'Token de verificación no válido.');
      return;
    }
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(res => {
        setStatus('success');
        setMessage(res.data.message || t('auth.verify_email_success'));
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.error || t('auth.verify_email_error'));
      });
  }, [searchParams, t]);

  return (
    <MainLayout>
      <div className="max-w-md mx-auto mt-12 p-6 bg-white rounded shadow text-center">
        <h2 className="text-xl font-bold mb-4">{t('auth.verify_email_title') || 'Verificación de email'}</h2>
        {status === 'pending' && <div className="text-gray-600">{t('auth.verifying') || 'Verificando...'}</div>}
        {status !== 'pending' && (
          <>
            <div className={status === 'success' ? 'text-green-600 mb-4' : 'text-red-600 mb-4'}>{message}</div>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => navigate('/login')}
            >
              {t('auth.return_to_login') || 'Volver a iniciar sesión'}
            </button>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default VerifyEmail;
