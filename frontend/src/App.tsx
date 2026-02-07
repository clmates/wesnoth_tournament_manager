import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import { useAuthStore } from './store/authStore';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import MaintenanceBanner from './components/MaintenanceBanner';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
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
import PlayerStatsPage from './pages/PlayerStatsPage';
import ReportMatch from './pages/ReportMatch';
import AdminAnnouncements from './pages/AdminAnnouncements';
import AdminFAQ from './pages/AdminFAQ';
import AdminTournaments from './pages/AdminTournaments';
import AdminDisputes from './pages/AdminDisputes';
import AdminAudit from './pages/AdminAudit';
import AdminMapsAndFactions from './pages/AdminMapsAndFactions';
import AdminBalanceEvents from './pages/AdminBalanceEvents';
import FAQ from './pages/FAQ';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import VerifyEmail from './pages/VerifyEmail';
import { adminService } from './services/api';
import './App.css';

const App: React.FC = () => {
  const { isAdmin, token, validateToken, isValidating } = useAuthStore();
  const [authChecked, setAuthChecked] = React.useState(false);
  const [maintenanceMode, setMaintenanceMode] = React.useState(false);

  useEffect(() => {
    // Validate token on app load if token exists
    const checkAuth = async () => {
      if (token) {
        await validateToken();
      }
      setAuthChecked(true);
    };
    
    checkAuth();
  }, [token, validateToken]);

  useEffect(() => {
    // Fetch maintenance status on app load
    const checkMaintenance = async () => {
      try {
        const res = await adminService.getMaintenanceStatus();
        setMaintenanceMode(res.data.maintenance_mode);
      } catch (error) {
        console.error('Error fetching maintenance status:', error);
      }
    };

    checkMaintenance();

    // Check maintenance status every 30 seconds
    const interval = setInterval(checkMaintenance, 30000);
    return () => clearInterval(interval);
  }, []);

  // Show loading while validating auth
  if (isValidating && !authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <MaintenanceBanner isVisible={maintenanceMode} />
        <Navbar />
        <main className={`main-content ${maintenanceMode ? 'pt-24' : ''}`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/user" element={<User />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/player/:id" element={<PlayerProfile />} />
            <Route path="/player/:playerId/stats" element={<PlayerStatsPage />} />
            <Route path="/force-password-change" element={<ForcePasswordChange />} />
            <Route path="/reset-password" element={<ForcePasswordChange />} />
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
            <Route path="/admin/balance-events" element={<AdminBalanceEvents />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </I18nextProvider>
  );
};

export default App;
