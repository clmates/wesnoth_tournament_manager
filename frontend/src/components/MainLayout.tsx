import React from 'react';
import UserProfileNav from './UserProfileNav';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <UserProfileNav />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
