import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import { useAuthStore } from './store/authStore';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import User from './pages/User';
import Profile from './pages/Profile';
import PlayerProfile from './pages/PlayerProfile';
import ForcePasswordChange from './pages/ForcePasswordChange';
import Matches from './pages/Matches';
import MyMatches from './pages/MyMatches';
import Admin from './pages/Admin';
import MyStats from './pages/MyStats';
import MyTournaments from './pages/MyTournaments';
import Rankings from './pages/Rankings';
import Statistics from './pages/Statistics';
import Players from './pages/Players';
import ReportMatch from './pages/ReportMatch';
import AdminAnnouncements from './pages/AdminAnnouncements';
import AdminFAQ from './pages/AdminFAQ';
import AdminTournaments from './pages/AdminTournaments';
import AdminDisputes from './pages/AdminDisputes';
import AdminAudit from './pages/AdminAudit';
import AdminMapsAndFactions from './pages/AdminMapsAndFactions';
import FAQ from './pages/FAQ';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import './App.css';

const App: React.FC = () => {
  const { isAdmin } = useAuthStore();

  useEffect(() => {
    // Sync isAdmin from localStorage on app load
    const storedIsAdmin = localStorage.getItem('isAdmin') === 'true';
    if (storedIsAdmin !== isAdmin) {
      // This will trigger a re-render with the correct isAdmin value
      console.log('Syncing isAdmin from localStorage:', storedIsAdmin);
    }
  }, [isAdmin]);
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/user" element={<User />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/player/:id" element={<PlayerProfile />} />
            <Route path="/force-password-change" element={<ForcePasswordChange />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/my-matches" element={<MyMatches />} />
            <Route path="/players" element={<Players />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournament/:id" element={<TournamentDetail />} />
            <Route path="/report-match" element={<ReportMatch />} />
            <Route path="/my-stats" element={<MyStats />} />
            <Route path="/my-tournaments" element={<MyTournaments />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/announcements" element={<AdminAnnouncements />} />
            <Route path="/admin/faq" element={<AdminFAQ />} />
            <Route path="/admin/tournaments" element={<AdminTournaments />} />
            <Route path="/admin/disputes" element={<AdminDisputes />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/admin/maps-and-factions" element={<AdminMapsAndFactions />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </BrowserRouter>
    </I18nextProvider>
  );
};

export default App;
