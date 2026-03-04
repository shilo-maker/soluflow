import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WorkspaceProvider } from './contexts/WorkspaceContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './components/layout/AppLayout';
import FullscreenButton from './components/FullscreenButton';
import OfflineIndicator from './components/OfflineIndicator';
import './App.css';

// Lazy load pages for code splitting
const ServicesList = lazy(() => import('./pages/ServicesList'));
const Service = lazy(() => import('./pages/Service'));
const GuestServiceView = lazy(() => import('./pages/GuestServiceView'));
const GuestEditView = lazy(() => import('./pages/GuestEditView'));
const SharedSongView = lazy(() => import('./pages/SharedSongView'));
const GuestLanding = lazy(() => import('./pages/GuestLanding'));
const Library = lazy(() => import('./pages/Library'));
const SongView = lazy(() => import('./pages/SongView'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const WorkspaceManagement = lazy(() => import('./pages/WorkspaceManagement'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const MemberInviteResponse = lazy(() => import('./pages/MemberInviteResponse'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const SongReports = lazy(() => import('./pages/SongReports'));
const SSOCallback = lazy(() => import('./pages/SSOCallback'));
const SolucastRedirect = lazy(() => import('./pages/SolucastRedirect'));
const CreateForSoluPlan = lazy(() => import('./pages/CreateForSoluPlan'));

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
                    location.pathname === '/reset-password' ||
                    location.pathname === '/sso' ||
                    location.pathname === '/create-for-soluplan';
  const isGuestPage = location.pathname.startsWith('/open/') ||
                      location.pathname.startsWith('/services/code/') ||
                      location.pathname.startsWith('/services/edit/') ||
                      location.pathname.startsWith('/service/code/') ||
                      location.pathname.startsWith('/service/edit/') ||
                      location.pathname.startsWith('/song/code/') ||
                      (!isAuthenticated && location.pathname.startsWith('/song/')) ||
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
        color: '#BC556F'
      }}>
        Loading...
      </div>
    );
  }

  const showAppLayout = isAuthenticated && !isAuthPage && !isGuestPage;

  return (
    <div className="App">
      {/* Offline/Online Indicator */}
      <OfflineIndicator />

      {showAppLayout ? (
        <AppLayout user={user} onLogout={handleLogout}>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Root route - redirect to library */}
              <Route path="/" element={<Navigate to="/library" replace />} />

              {/* Song view - accessible when logged in */}
              <Route path="/song/:id" element={<SongView />} />

              {/* Protected routes */}
              <Route path="/home" element={<Navigate to="/library" replace />} />
              <Route path="/services" element={<PrivateRoute><ServicesList /></PrivateRoute>} />
              <Route path="/services/:id" element={<PrivateRoute><Service /></PrivateRoute>} />
              {/* Legacy /service redirects */}
              <Route path="/service" element={<Navigate to="/services" replace />} />
              <Route path="/service/:id" element={<PrivateRoute><Service /></PrivateRoute>} />
              <Route path="/library" element={<PrivateRoute><Library /></PrivateRoute>} />
              <Route path="/users" element={<PrivateRoute><UserManagement /></PrivateRoute>} />
              <Route path="/user/settings" element={<PrivateRoute><UserSettings /></PrivateRoute>} />
              <Route path="/workspace/settings" element={<PrivateRoute><WorkspaceManagement /></PrivateRoute>} />
              <Route path="/workspace/invite/:token" element={<PrivateRoute><AcceptInvite /></PrivateRoute>} />
              <Route path="/workspace/member-invite/:token" element={<PrivateRoute><MemberInviteResponse /></PrivateRoute>} />
              <Route path="/admin/reports" element={<PrivateRoute><SongReports /></PrivateRoute>} />

              {/* Catch-all redirect for unknown paths */}
              <Route path="*" element={<Navigate to="/library" replace />} />
            </Routes>
          </Suspense>
        </AppLayout>
      ) : (
        <main className="auth-content">
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/open/:code" element={<SolucastRedirect />} />
              <Route path="/services/code/:code" element={<GuestServiceView />} />
              <Route path="/services/edit/:editToken" element={<GuestEditView />} />
              {/* Legacy /service/code and /service/edit routes */}
              <Route path="/service/code/:code" element={<GuestServiceView />} />
              <Route path="/service/edit/:editToken" element={<GuestEditView />} />
              <Route path="/song/code/:code" element={<SharedSongView />} />
              <Route path="/sso" element={<SSOCallback />} />
              <Route path="/create-for-soluplan" element={<CreateForSoluPlan />} />

              {/* Workspace invites - accessible before login, redirect handled inside */}
              <Route path="/workspace/invite/:token" element={<AcceptInvite />} />
              <Route path="/workspace/member-invite/:token" element={<MemberInviteResponse />} />

              {/* Root route - guest landing */}
              <Route path="/" element={<GuestLanding />} />

              {/* Song view - public for guests */}
              <Route path="/song/:id" element={<SongView />} />

              {/* Catch-all redirect to login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </main>
      )}

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
