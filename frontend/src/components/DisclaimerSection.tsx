import React from 'react';
import { useTranslation } from 'react-i18next';

const DisclaimerSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-xl font-semibold text-cyan-400 m-0 pb-3 border-b-2 border-cyan-400/30">{t('footer_disclaimer') || 'Legal Notice'}</h3>
      <div className="bg-white/5 border border-cyan-400/20 rounded-lg p-4">
        <p className="m-0 text-sm leading-relaxed text-gray-300 whitespace-pre-line">
          {t('footer.disclaimer_affiliation')}
        </p>
      </div>
      <div className="bg-white/5 border border-cyan-400/20 rounded-lg p-4">
        <p className="m-0 text-sm leading-relaxed text-gray-300 whitespace-pre-line">
          {t('footer.disclaimer_assets')}
        </p>
      </div>
    </div>
  );
};

export default DisclaimerSection;
