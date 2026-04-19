import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import { useAuthStore } from './store/authStore';
import { useNotificationStore } from './stores/notificationStore';
import { connectToNotifications, disconnectFromNotifications } from './services/socketService';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import MaintenanceBanner from './components/MaintenanceBanner';
import { ToastContainer } from './components/ToastNotification';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import User from './pages/User';
import Profile from './pages/Profile';
import PlayerProfile from './pages/PlayerProfile';
import Matches from './pages/Matches';
import MyMatches from './pages/MyMatches';
import Admin from './pages/Admin';
import MyStats from './pages/MyStats';
import MyTournaments from './pages/MyTournaments';
import Rankings from './pages/Rankings';
import Statistics from './pages/Statistics';
import Players from './pages/Players';
import PlayerStatsPage from './pages/PlayerStatsPage';
import AdminAnnouncements from './pages/AdminAnnouncements';
import AdminFAQ from './pages/AdminFAQ';
import AdminTournaments from './pages/AdminTournaments';
import AdminDisputes from './pages/AdminDisputes';
import AdminAudit from './pages/AdminAudit';
import AdminReplays from './pages/AdminReplays';
import AdminMapsAndFactions from './pages/AdminMapsAndFactions';
import AdminBalanceEvents from './pages/AdminBalanceEvents';
import FAQ from './pages/FAQ';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import { adminService } from './services/api';
import { getUnreadNotifications, markAsRead } from './services/notificationService';
import './App.css';

const App: React.FC = () => {
  const { isAdmin, token, validateToken, isValidating } = useAuthStore();
  const { addToast } = useNotificationStore();
  const [authChecked, setAuthChecked] = React.useState(false);
  const [maintenanceMode, setMaintenanceMode] = React.useState(false);
  const [notificationsLoaded, setNotificationsLoaded] = React.useState(false);

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
    // Connect to Socket.IO when user is authenticated and WebSockets are enabled
    const enableWebSockets = import.meta.env.VITE_ENABLE_WEBSOCKETS === 'true';
    
    if (token && authChecked && enableWebSockets) {
      console.log('🔌 Initializing Socket.IO connection...');
      connectToNotifications();

      return () => {
        // Cleanup: disconnect on unmount or when token changes
        disconnectFromNotifications();
      };
    } else if (token && authChecked && !enableWebSockets) {
      console.log('⚠️ WebSocket notifications disabled - using database fallback only');
    }
  }, [token, authChecked]);

  useEffect(() => {
    // Load unread notifications when user accesses the app
    const loadNotifications = async () => {
      if (token && authChecked && !notificationsLoaded) {
        try {
          // Load generic notifications
          const notifications = await getUnreadNotifications();
          console.log('📬 Loaded notifications:', notifications);
          
                    // Show toast for each notification
          if (Array.isArray(notifications)) {
            for (const notification of notifications) {
              addToast({
                title: notification.title,
                message: notification.message,
                type: notification.type === 'schedule_proposal' ? 'schedule_proposal' : 'success',
              });
              
              // Mark as read after showing
              await markAsRead(notification.id);
            }
          } else {
            console.warn('⚠️ Notifications is not an array:', typeof notifications);
          }
          
          // Load pending schedule confirmations
          try {
            const response = await fetch('/api/tournament-scheduling/pending-confirmations', {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('✅ Pending schedules loaded:', data);
              
              if (data.schedules && data.schedules.length > 0) {
                console.log(`📅 Found ${data.schedules.length} pending schedules`);
                
                // Show notification for each pending schedule
                for (const schedule of data.schedules) {
                  try {
                    const scheduleDate = new Date(schedule.scheduledDatetime);
                    const formattedDate = scheduleDate.toLocaleString('es-ES', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    
                    // Show toast notification
                    addToast({
                      title: `⏰ Schedule Pending: ${schedule.tournamentName}`,
                      message: `Match scheduled for ${formattedDate}. Please confirm.`,
                      type: 'schedule_proposal',
                    });
                    console.log('📢 Shown notification for schedule:', schedule.matchId);
                  } catch (notificationError) {
                    console.error('Error showing schedule notification:', notificationError);
                  }
                }
              } else {
                console.log('✅ No pending schedules');
              }
            } else {
              console.warn('⚠️ Failed to load pending schedules:', response.status, response.statusText);
            }
          } catch (scheduleError) {
            console.warn('Could not load pending schedules:', scheduleError);
          }
          
          setNotificationsLoaded(true);
        } catch (error) {
          console.error('❌ Error loading notifications:', error);
        }
      }
    };

    loadNotifications();
  }, [token, authChecked, notificationsLoaded]);

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
        <ToastContainer />
        <main className={`main-content ${maintenanceMode ? 'pt-40' : ''}`}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/user" element={<User />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/player/:id" element={<PlayerProfile />} />
            <Route path="/player/:playerId/stats" element={<PlayerStatsPage />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/my-matches" element={<MyMatches />} />
            <Route path="/players" element={<Players />} />
            <Route path="/rankings" element={<Rankings />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournament/:id" element={<TournamentDetail />} />
            <Route path="/my-stats" element={<MyStats />} />
            <Route path="/my-tournaments" element={<MyTournaments />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/announcements" element={<AdminAnnouncements />} />
            <Route path="/admin/faq" element={<AdminFAQ />} />
            <Route path="/admin/tournaments" element={<AdminTournaments />} />
            <Route path="/admin/disputes" element={<AdminDisputes />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
            <Route path="/admin/replays" element={<AdminReplays />} />
            <Route path="/admin/maps-and-factions" element={<AdminMapsAndFactions />} />
            <Route path="/admin/balance-events" element={<AdminBalanceEvents />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
    </I18nextProvider>
  );
};

export default App;
