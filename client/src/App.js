import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/layout/Header';
import BottomNav from './components/layout/BottomNav';
import FullscreenButton from './components/FullscreenButton';
import OfflineIndicator from './components/OfflineIndicator';
import './App.css';

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home'));
const Service = lazy(() => import('./pages/Service'));
const GuestServiceView = lazy(() => import('./pages/GuestServiceView'));
const SharedSongView = lazy(() => import('./pages/SharedSongView'));
const GuestLanding = lazy(() => import('./pages/GuestLanding'));
const Library = lazy(() => import('./pages/Library'));
const SongView = lazy(() => import('./pages/SongView'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const WorkspaceManagement = lazy(() => import('./pages/WorkspaceManagement'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// Loading component for Suspense fallback
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#666'
  }}>
    Loading...
  </div>
);

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
      {/* Offline/Online Indicator */}
      <OfflineIndicator />

      {isAuthenticated && !isAuthPage && !isGuestPage && (
        <Header
          title="SoluFlow"
          user={user}
          showLogout={true}
          onLogout={handleLogout}
        />
      )}

      <main className={isAuthPage || isGuestPage ? "auth-content" : "app-content"}>
        <Suspense fallback={<LoadingFallback />}>
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
        </Suspense>
      </main>

      {isAuthenticated && !isAuthPage && !isGuestPage && <BottomNav />}

      {/* Fullscreen button - available on all pages except auth pages */}
      {!isAuthPage && <FullscreenButton />}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <WorkspaceProvider>
                <AppContent />
              </WorkspaceProvider>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
