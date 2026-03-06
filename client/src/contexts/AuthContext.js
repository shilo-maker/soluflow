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
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = authService.getToken();
      if (token) {
        // Check if we're offline
        if (!navigator.onLine) {
          // Offline: Try to load cached user data from localStorage
          const cachedUser = localStorage.getItem('user');
          if (cachedUser) {
            try {
              const parsedUser = JSON.parse(cachedUser);
              setUser(parsedUser);
              setIsAuthenticated(true);
              setLoading(false);
              return;
            } catch (e) {
              // Continue if parsing fails
            }
          }
          // If no cached data, still allow access with token
          setUser({ id: 'offline', username: 'Offline User' });
          setIsAuthenticated(true);
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
        const cachedUser = localStorage.getItem('user');
        if (cachedUser) {
          try {
            setUser(JSON.parse(cachedUser));
            setIsAuthenticated(true);
            setLoading(false);
            return;
          } catch (e) {
            // Continue to logout if parsing fails
          }
        }
        // Even without cached user data, keep them "logged in" with a stub
        setUser({ id: 'offline', username: 'Offline User' });
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }

      // Token is invalid or expired (confirmed by server while online)
      authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

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
