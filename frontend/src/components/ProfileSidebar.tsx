import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from 'react-i18next';

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileSidebar: React.FC<ProfileSidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuthStore();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate('/');
    onClose();
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex justify-end">
          <button className="text-2xl text-gray-600 hover:text-gray-900" onClick={onClose}>✕</button>
        </div>

        {user && (
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
            <div className="w-12 h-12 mx-auto mb-3 bg-blue-500 text-white rounded-full flex items-center justify-center text-lg font-bold">
              {user.nickname.charAt(0).toUpperCase()}
            </div>
            <h3 className="font-semibold text-center text-gray-800 text-sm">{user.nickname}</h3>
            <p className="text-xs text-gray-600 text-center mt-1">{t('label_elo')}</p>
          </div>
        )}

        <ul className="py-4 space-y-1 px-2">
          <li>
            <button 
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-3 text-sm"
              onClick={() => handleNavigate('/profile')}
            >
              <span>👤</span>
              <span>{t('sidebar.my_profile')}</span>
            </button>
          </li>
          <li>
            <button 
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-3 text-sm"
              onClick={() => handleNavigate('/my-tournaments')}
            >
              <span>🏆</span>
              <span>{t('sidebar.my_tournaments')}</span>
            </button>
          </li>
          <li>
            <button 
              className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-3 text-sm"
              onClick={() => handleNavigate('/report-match')}
            >
              <span>📝</span>
              <span>{t('report_match_link')}</span>
            </button>
          </li>
        </ul>

        {isAdmin && (
          <>
            <div className="px-4 py-3 border-t border-gray-200">
              <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">{t('sidebar.admin_options')}</div>
              <ul className="py-2 space-y-1 mt-3">
                <li>
                  <button 
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-3 text-sm"
                    onClick={() => handleNavigate('/admin')}
                  >
                    <span>👥</span>
                    <span>{t('sidebar.manage_users')}</span>
                  </button>
                </li>
                <li>
                  <button 
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-3 text-sm"
                    onClick={() => handleNavigate('/admin/announcements')}
                  >
                    <span>📢</span>
                    <span>{t('announcements')}</span>
                  </button>
                </li>
                <li>
                  <button 
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-3 text-sm"
                    onClick={() => handleNavigate('/admin/faq')}
                  >
                    <span>❓</span>
                    <span>{t('navbar_faq')}</span>
                  </button>
                </li>
                <li>
                  <button 
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-3 text-sm"
                    onClick={() => handleNavigate('/admin/maps-and-factions')}
                  >
                    <span>🗺️</span>
                    <span>Maps & Factions</span>
                  </button>
                </li>
                <li>
                  <button 
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-3 text-sm"
                    onClick={() => handleNavigate('/admin/tournaments')}
                  >
                    <span>⚙️</span>
                    <span>{t('sidebar.manage_tournaments')}</span>
                  </button>
                </li>
                <li>
                  <button 
                    className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-3 text-sm"
                    onClick={() => handleNavigate('/admin/disputes')}
                  >
                    <span>⚖️</span>
                    <span>{t('sidebar.match_disputes')}</span>
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}

        <div className="p-4 border-t border-gray-200">
          <button 
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold text-sm flex items-center justify-center gap-2"
            onClick={handleLogout}
          >
            🚪 {t('navbar_logout')}
          </button>
        </div>
      </div>
    </>
  );
};

export default ProfileSidebar;
