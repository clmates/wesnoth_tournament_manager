import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Register Page - DISABLED
 * Registration is no longer available in the application.
 * Users must create a Wesnoth account at wesnoth.org first,
 * then log in with their Wesnoth credentials.
 */
const Register: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-2xl mx-auto my-12 px-4 bg-white rounded-lg shadow-sm py-8">
      <h1 className="text-center mb-6 text-2xl font-bold text-gray-800">
        {t('register_disabled', 'Registration Disabled')}
      </h1>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6">
        <p className="text-gray-800 mb-4">
          {t('register_info', 'Registration is no longer available in this application.')}
        </p>
        
        <p className="text-gray-700 mb-4">
          {t('register_wesnoth_required', 'To access this tournament manager, you need to:')}
        </p>
        
        <ol className="list-decimal list-inside text-gray-700 space-y-2 ml-2">
          <li>
            {t('register_step1', 'Create a Wesnoth account at')}{' '}
            <a 
              href="https://www.wesnoth.org/account/register" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline font-semibold"
            >
              wesnoth.org
            </a>
          </li>
          <li>
            {t('register_step2', 'Log in to this tournament manager using your Wesnoth username')}
          </li>
          <li>
            {t('register_step3', 'Your profile will be automatically created')}
          </li>
        </ol>
      </div>
      
      <div className="text-center">
        <a 
          href="/login" 
          className="inline-block px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {t('register_go_to_login', 'Go to Login')}
        </a>
      </div>
    </div>
  );
};

export default Register;
