import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n/config';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import User from './pages/User';
import Profile from './pages/Profile';
import Matches from './pages/Matches';
import MyMatches from './pages/MyMatches';
import Admin from './pages/Admin';
import MyStats from './pages/MyStats';
import MyTournaments from './pages/MyTournaments';
import Rankings from './pages/Rankings';
import Players from './pages/Players';
import ReportMatch from './pages/ReportMatch';
import AdminAnnouncements from './pages/AdminAnnouncements';
import AdminFAQ from './pages/AdminFAQ';
import AdminTournaments from './pages/AdminTournaments';
import AdminDisputes from './pages/AdminDisputes';
import AdminAudit from './pages/AdminAudit';
import FAQ from './pages/FAQ';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import './App.css';

const App: React.FC = () => {
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
            <Route path="/matches" element={<Matches />} />
            <Route path="/my-matches" element={<MyMatches />} />
            <Route path="/players" element={<Players />} />
            <Route path="/rankings" element={<Rankings />} />
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
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </BrowserRouter>
    </I18nextProvider>
  );
};

export default App;
