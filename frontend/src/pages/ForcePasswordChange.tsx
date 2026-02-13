import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Force Password Change Page - DISABLED
 * Password changes are no longer managed by this application.
 * All password management is handled by Wesnoth.
 */
const ForcePasswordChange: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-2xl mx-auto my-12 px-4 bg-white rounded-lg shadow-sm py-8">
      <h1 className="text-center mb-6 text-2xl font-bold text-gray-800">
        {t('force_password_change_disabled', 'Password Management Disabled')}
      </h1>
      
      <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6">
        <p className="text-gray-800 mb-4">
          {t('force_password_change_info', 'Password management is no longer available in this application.')}
        </p>
        
        <p className="text-gray-700">
          {t('force_password_change_wesnoth', 'Your password is managed by the official Wesnoth website. To change your password, please visit:')}
        </p>
      </div>
      
      <div className="text-center mb-6">
        <a 
          href="https://www.wesnoth.org/account/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-block px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {t('force_password_change_wesnoth_account', 'Wesnoth Account Settings')}
        </a>
      </div>
      
      <div className="text-center">
        <a 
          href="/login" 
          className="inline-block px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
        >
          {t('force_password_change_go_to_login', 'Go to Login')}
        </a>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
