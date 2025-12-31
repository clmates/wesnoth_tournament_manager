import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/Footer.css';

const Footer: React.FC = () => {
  const { t } = useTranslation();

  return (
    <footer className="app-footer">
      <div className="footer-content">
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
      </div>
      <div className="footer-bottom">
        <p className="footer-copyright">
          © 2024 Wesnoth Tournament Manager. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
