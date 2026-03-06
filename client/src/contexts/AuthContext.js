import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const checkingRef = React.useRef(false);

  // On mount: pick up cross-app token from URL (SoluPlan → SoluFlow SSO),
  // then run the normal auth check.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      // Store the token and clean it from the URL for security
      localStorage.setItem('token', tokenParam);
      params.delete('token');
      const remaining = params.toString();
      const clean = window.location.pathname + (remaining ? `?${remaining}` : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
    }
    checkAuth();

    // Re-validate token when coming back online (replaces stub user with real data)
    const handleOnline = () => {
      const token = authService.getToken();
      if (token) checkAuth();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [checkAuth]);

  // Helper: load cached user from localStorage or return a stub
  const loadCachedUser = useCallback(() => {
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        setUser(parsed);
        setIsAuthenticated(true);
        return true;
      } catch { /* fall through */ }
    }
    // Stub with minimal fields — downstream should guard against missing fields
    setUser({ id: 'offline', username: 'Offline User', _isStub: true });
    setIsAuthenticated(true);
    return true;
  }, []);

  const checkAuth = useCallback(async () => {
    // Concurrency guard — prevent parallel checkAuth calls from racing
    if (checkingRef.current) return;
    checkingRef.current = true;

    try {
      const token = authService.getToken();
      if (token) {
        // Check if we're offline
        if (!navigator.onLine) {
          loadCachedUser();
          setLoading(false);
          return;
        }

        // Online: Verify token is still valid by fetching user data
        const data = await authService.getMe();
        setUser(data.user);
        setIsAuthenticated(true);
        // Cache user data for offline use
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);

      // If we have a token and the failure looks like a network issue, don't log out.
      // navigator.onLine can be wrong, so also check the error shape.
      const isNetworkFailure = !navigator.onLine ||
        error?.error === 'No response from server' ||
        error?.code === 'ERR_NETWORK' ||
        error?.code === 'ECONNABORTED';

      if (isNetworkFailure && authService.getToken()) {
        loadCachedUser();
        setLoading(false);
        return;
      }

      // Token is invalid or expired (confirmed by server while online)
      authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      checkingRef.current = false;
      setLoading(false);
    }
  }, [loadCachedUser]);

  const login = useCallback(async (email, password) => {
    try {
      const data = await authService.login(email, password);
      setUser(data.user);
      setIsAuthenticated(true);
      // Cache user data for offline use
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }, []);

  const register = useCallback(async (email, password, username, workspaceId, language) => {
    try {
      const data = await authService.register(email, password, username, workspaceId, language);
      setUser(data.user);
      setIsAuthenticated(true);
      // Cache user data for offline use
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }, []);

  const guestLogin = useCallback(async (code) => {
    try {
      const data = await authService.guestAuth(code);
      setUser({
        id: data.guestId,
        username: 'Guest',
        isGuest: true,
        service: data.service
      });
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      console.error('Guest login error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    // Clear cached user data
    localStorage.removeItem('user');
  }, []);

  const updateUser = useCallback((updatedUserData) => {
    setUser(prevUser => {
      const newUser = {
        ...prevUser,
        ...updatedUserData
      };
      // Cache updated user data for offline use
      localStorage.setItem('user', JSON.stringify(newUser));
      return newUser;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated,
    login,
    register,
    guestLogin,
    logout,
    checkAuth,
    updateUser
  }), [user, loading, isAuthenticated, login, register, guestLogin, logout, checkAuth, updateUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
