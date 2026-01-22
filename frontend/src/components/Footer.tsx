import React, { Suspense, lazy } from 'react';

const DisclaimerSection = lazy(() => import('./DisclaimerSection'));

const Footer: React.FC = () => {
  return (
    <footer className="bg-gradient-to-r from-gray-900 to-gray-800 text-gray-100 py-8 px-4 border-t-4 border-blue-500 flex-shrink-0">
      <div className="max-w-5xl mx-auto min-h-36">
        <Suspense fallback={<div className="flex flex-col gap-6 p-4 h-32 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-pulse" role="status" aria-label="Loading footer content" />}>
          <DisclaimerSection />
        </Suspense>
      </div>
      <div className="pt-6 border-t border-gray-700 text-center">
        <p className="text-sm text-gray-500 m-0">
          © 2024 Wesnoth Tournament Manager. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
