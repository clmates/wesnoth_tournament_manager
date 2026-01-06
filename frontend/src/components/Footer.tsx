import React, { Suspense, lazy } from 'react';
import '../styles/Footer.css';

const DisclaimerSection = lazy(() => import('./DisclaimerSection'));

const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <Suspense fallback={<div className="disclaimer-skeleton" role="status" aria-label="Loading footer content" />}>
          <DisclaimerSection />
        </Suspense>
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
