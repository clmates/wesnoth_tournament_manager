import React from 'react';
import { useTranslation } from 'react-i18next';

interface MaintenanceBannerProps {
  isVisible: boolean;
}

const MaintenanceBanner: React.FC<MaintenanceBannerProps> = ({ isVisible }) => {
  const { t } = useTranslation();

  if (!isVisible) return null;

  return (
    <div className="fixed top-16 left-0 right-0 bg-red-600 text-white px-4 py-4 shadow-lg z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-3">
        <div className="text-2xl animate-pulse">🔧</div>
        <div className="flex flex-col">
          <h2 className="font-bold text-lg">{t('maintenance.title')}</h2>
          <p className="text-sm text-red-100">{t('maintenance.message')}</p>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceBanner;
