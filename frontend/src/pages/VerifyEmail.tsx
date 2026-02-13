import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Verify Email Page - DISABLED
 * Email verification is no longer part of the authentication process.
 * User registration and email verification have been replaced by Wesnoth authentication.
 */
const VerifyEmail: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-2xl mx-auto my-12 px-4 bg-white rounded-lg shadow-sm py-8">
      <h1 className="text-center mb-6 text-2xl font-bold text-gray-800">
        {t('verify_email_disabled', 'Email Verification Disabled')}
      </h1>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6">
        <p className="text-gray-800 mb-4">
          {t('verify_email_info', 'Email verification is no longer required in this application.')}
        </p>
        
        <p className="text-gray-700">
          {t('verify_email_wesnoth', 'This application now uses Wesnoth authentication. Your account is automatically created when you log in with your Wesnoth credentials.')}
        </p>
      </div>
      
      <div className="text-center">
        <a 
          href="/login" 
          className="inline-block px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {t('verify_email_go_to_login', 'Go to Login')}
        </a>
      </div>
    </div>
  );
};

export default VerifyEmail;
