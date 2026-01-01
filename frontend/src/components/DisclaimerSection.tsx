import React from 'react';
import { useTranslation } from 'react-i18next';

const DisclaimerSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="footer-section">
      <h3 className="footer-title">{t('footer_disclaimer') || 'Legal Notice'}</h3>
      <div className="disclaimer-box">
        <p className="disclaimer-text">
          {t('footer.disclaimer_affiliation')}
        </p>
      </div>
      <div className="disclaimer-box">
        <p className="disclaimer-text">
          {t('footer.disclaimer_assets')}
        </p>
      </div>
    </div>
  );
};

export default DisclaimerSection;
