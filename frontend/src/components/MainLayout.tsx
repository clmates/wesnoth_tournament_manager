import React from 'react';
import ProfileSidebar from './ProfileSidebar';
import '../styles/MainLayout.css';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="main-layout">
      <aside className="sidebar-container">
        <ProfileSidebar isOpen={true} onClose={() => {}} />
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
