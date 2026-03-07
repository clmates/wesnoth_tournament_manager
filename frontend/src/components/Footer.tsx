import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gradient-to-r from-gray-900 to-gray-800 text-gray-100 py-4 px-4 border-t-4 border-blue-500 flex-shrink-0">
      <div className="text-center">
        <p className="text-sm text-gray-500 m-0">
          © 2024 Wesnoth Tournament Manager. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
