import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Forgot Password Page - DISABLED
 * Password recovery is no longer available in this application.
 * All passwords are managed by Wesnoth. Use the Wesnoth forum to reset your password.
 */
const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-2xl mx-auto my-12 px-4 bg-white rounded-lg shadow-sm py-8">
      <h1 className="text-center mb-6 text-2xl font-bold text-gray-800">
        {t('forgot_password_disabled', 'Password Recovery Disabled')}
      </h1>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6">
        <p className="text-gray-800 mb-4">
          {t('forgot_password_info', 'Password recovery is no longer available in this application.')}
        </p>
        
        <p className="text-gray-700 mb-4">
          {t('forgot_password_instruction', 'Your Wesnoth password is managed by the official Wesnoth website.')}
        </p>
        
        <div className="bg-white p-4 rounded border border-blue-200 mb-4">
          <p className="text-gray-700 mb-2">
            {t('forgot_password_reset', 'To reset your Wesnoth password:')}
          </p>
          <ol className="list-decimal list-inside text-gray-700 space-y-2 ml-2">
            <li>
              {t('forgot_password_step1', 'Visit')}{' '}
              <a 
                href="https://www.wesnoth.org/account/login" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline font-semibold"
              >
                wesnoth.org/account/login
              </a>
            </li>
            <li>
              {t('forgot_password_step2', 'Click "Forgot password?" link')}
            </li>
            <li>
              {t('forgot_password_step3', 'Follow the password reset instructions')}
            </li>
            <li>
              {t('forgot_password_step4', 'Log in to this tournament manager with your new password')}
            </li>
          </ol>
        </div>
      </div>
      
      <div className="text-center">
        <a 
          href="/login" 
          className="inline-block px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {t('forgot_password_go_to_login', 'Go to Login')}
        </a>
      </div>
    </div>
  );
};

export default ForgotPassword;
