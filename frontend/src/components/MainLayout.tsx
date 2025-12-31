import React from 'react';
import UserProfileNav from './UserProfileNav';
import '../styles/MainLayout.css';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="main-layout">
      <UserProfileNav />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
