import React, { createContext, useState, useContext, useEffect } from 'react';
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

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
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
              console.log('[Auth] Offline mode: Using cached user data');
              setUser(parsedUser);
              setIsAuthenticated(true);
              setLoading(false);
              return;
            } catch (e) {
              console.warn('[Auth] Failed to parse cached user data');
            }
          }
          // If no cached data, still allow access with token
          console.log('[Auth] Offline mode: Token exists but no cached user data');
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

      // If we're offline and have a token, don't log out
      if (!navigator.onLine && authService.getToken()) {
        console.log('[Auth] Offline: Keeping existing authentication');
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
      }

      // Token is invalid or expired (when online)
      authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
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
  };

  const register = async (email, password, username, workspaceId, language) => {
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
  };

  const guestLogin = async (code) => {
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
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    // Clear cached user data
    localStorage.removeItem('user');
  };

  const updateUser = (updatedUserData) => {
    setUser(prevUser => {
      const newUser = {
        ...prevUser,
        ...updatedUserData
      };
      // Cache updated user data for offline use
      localStorage.setItem('user', JSON.stringify(newUser));
      return newUser;
    });
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    guestLogin,
    logout,
    checkAuth,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
