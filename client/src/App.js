import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { LanguageProvider } from './contexts/LanguageContext';
import PrivateRoute from './components/PrivateRoute';
import Header from './components/layout/Header';
import BottomNav from './components/layout/BottomNav';
import FullscreenButton from './components/FullscreenButton';
import Home from './pages/Home';
import Service from './pages/Service';
import GuestServiceView from './pages/GuestServiceView';
import SharedSongView from './pages/SharedSongView';
import GuestLanding from './pages/GuestLanding';
import Library from './pages/Library';
import SongView from './pages/SongView';
import UserManagement from './pages/UserManagement';
import UserSettings from './pages/UserSettings';
import WorkspaceManagement from './pages/WorkspaceManagement';
import AcceptInvite from './pages/AcceptInvite';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import './App.css';

function AppContent() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  // Check if we're on auth pages or guest pages
  const isAuthPage = location.pathname === '/login' ||
                    location.pathname === '/register' ||
                    location.pathname === '/verify-email' ||
                    location.pathname === '/forgot-password' ||
                    location.pathname === '/reset-password';
  const isGuestPage = location.pathname.startsWith('/service/code/') ||
                      location.pathname.startsWith('/song/code/') ||
                      location.pathname.startsWith('/song/') ||
                      (!isAuthenticated && location.pathname === '/');

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#4ECDC4'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="App">
      {isAuthenticated && !isAuthPage && !isGuestPage && (
        <Header
          title="SoluFlow"
          user={user}
          showLogout={true}
          onLogout={handleLogout}
        />
      )}

      <main className={isAuthPage || isGuestPage ? "auth-content" : "app-content"}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/service/code/:code" element={<GuestServiceView />} />
          <Route path="/song/code/:code" element={<SharedSongView />} />

          {/* Root route - conditional based on auth */}
          <Route path="/" element={
            isAuthenticated ? <Navigate to="/home" replace /> : <GuestLanding />
          } />

          {/* Song view - public for guests */}
          <Route path="/song/:id" element={<SongView />} />

          {/* Protected routes */}
          <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/service" element={<PrivateRoute><Service /></PrivateRoute>} />
          <Route path="/service/:id" element={<PrivateRoute><Service /></PrivateRoute>} />
          <Route path="/library" element={<PrivateRoute><Library /></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute><UserManagement /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><UserSettings /></PrivateRoute>} />
          <Route path="/workspace/settings" element={<PrivateRoute><WorkspaceManagement /></PrivateRoute>} />
          <Route path="/workspace/invite/:token" element={<PrivateRoute><AcceptInvite /></PrivateRoute>} />
        </Routes>
      </main>

      {isAuthenticated && !isAuthPage && !isGuestPage && <BottomNav />}

      {/* Fullscreen button - available on all pages except auth pages */}
      {!isAuthPage && <FullscreenButton />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <LanguageProvider>
          <WorkspaceProvider>
            <AppContent />
          </WorkspaceProvider>
        </LanguageProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
