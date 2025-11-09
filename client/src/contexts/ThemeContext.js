import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Professional gradient preset themes - Carefully designed for visual harmony
export const GRADIENT_PRESETS = {
  professional: {
    name: 'Professional',
    colors: ['#667eea', '#764ba2', '#5e72e4', '#825ee4', '#6f86d6'],
    accentColor: '#667eea',
    logoGradient: ['#667eea', '#764ba2', '#8b7dd6', '#a991e8', '#667eea'],
    description: 'Classic blue-purple palette - trustworthy and calm'
  },
  warm: {
    name: 'Warm',
    colors: ['#f093fb', '#f5576c', '#fa709a', '#fee140', '#ffa07a'],
    accentColor: '#f5576c',
    logoGradient: ['#f093fb', '#f5576c', '#fa709a', '#ff8fab', '#f093fb'],
    description: 'Warm coral and pink - friendly and approachable'
  },
  nature: {
    name: 'Nature',
    colors: ['#56ab2f', '#a8e063', '#38b2ac', '#4fd1c5', '#81e6d9'],
    accentColor: '#38b2ac',
    logoGradient: ['#56ab2f', '#6cc24a', '#38b2ac', '#4fd1c5', '#56ab2f'],
    description: 'Fresh green and teal - calming and growth-oriented'
  },
  elegant: {
    name: 'Elegant',
    colors: ['#1a2332', '#2c3e50', '#34495e', '#546e7a', '#607d8b'],
    accentColor: '#607d8b',
    logoGradient: ['#34495e', '#546e7a', '#607d8b', '#78909c', '#34495e'],
    description: 'Dark navy and gray - elegant and professional'
  }
};

const defaultTheme = {
  gradientPreset: 'nature',
  textColor: '#000000',
  chordColor: '#38b2ac',
  chordSize: 1.0
};

const guestTheme = {
  gradientPreset: 'nature',
  textColor: '#000000',
  chordColor: '#38b2ac',
  chordSize: 1.0
};

export const ThemeProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  // Initialize theme: try localStorage first, fallback to defaultTheme (not guest theme)
  const getInitialTheme = () => {
    const cachedTheme = localStorage.getItem('userTheme');
    if (cachedTheme) {
      try {
        return JSON.parse(cachedTheme);
      } catch (e) {
        return defaultTheme;
      }
    }
    return defaultTheme; // Start with professional theme instead of guest theme
  };

  const [theme, setTheme] = useState(getInitialTheme);
  const [loading, setLoading] = useState(true);

  // Load theme preferences when user logs in
  useEffect(() => {
    const loadThemePreferences = async () => {
      if (isAuthenticated && user && !user.isGuest) {
        try {
          const response = await api.get('/users/theme/preferences');
          const userTheme = response.data;
          setTheme(userTheme);
          // Cache in localStorage for instant loading next time
          localStorage.setItem('userTheme', JSON.stringify(userTheme));
        } catch (error) {
          console.error('Error loading theme preferences:', error);
          // Use default theme if there's an error
          setTheme(defaultTheme);
          localStorage.setItem('userTheme', JSON.stringify(defaultTheme));
        }
      } else {
        // Use Nature theme for guests (not authenticated)
        setTheme(guestTheme);
        // Clear any cached user theme when logged out
        localStorage.removeItem('userTheme');
      }
      setLoading(false);
    };

    loadThemePreferences();
  }, [isAuthenticated, user]);

  // Apply theme to CSS variables and body gradient
  useEffect(() => {
    if (!loading) {
      // Apply text and chord styling
      document.documentElement.style.setProperty('--theme-text-color', theme.textColor);
      document.documentElement.style.setProperty('--theme-chord-color', theme.chordColor);
      document.documentElement.style.setProperty('--theme-chord-size', theme.chordSize.toString());

      // Apply gradient preset to body
      const preset = GRADIENT_PRESETS[theme.gradientPreset] || GRADIENT_PRESETS.professional;
      const gradientColors = preset.colors.join(', ');
      document.body.style.background = `linear-gradient(-45deg, ${gradientColors})`;
      document.body.style.backgroundSize = '400% 400%';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.minHeight = '100vh';
      document.body.style.animation = 'gradientShift 10s ease infinite';

      // Set accent color for section headers and buttons
      document.documentElement.style.setProperty('--theme-accent-color', preset.accentColor);

      // Update primary color to match the accent color (affects all buttons and UI elements)
      document.documentElement.style.setProperty('--color-primary', preset.accentColor);
      document.documentElement.style.setProperty('--color-primary-dark', preset.accentColor);

      // Update workspace badge colors to match the theme
      document.documentElement.style.setProperty('--color-badge-personal', preset.accentColor);
      document.documentElement.style.setProperty('--color-badge-workspace', preset.accentColor);

      // Set logo gradient colors based on theme
      if (preset.logoGradient && preset.logoGradient.length === 5) {
        document.documentElement.style.setProperty('--logo-gradient-1', preset.logoGradient[0]);
        document.documentElement.style.setProperty('--logo-gradient-2', preset.logoGradient[1]);
        document.documentElement.style.setProperty('--logo-gradient-3', preset.logoGradient[2]);
        document.documentElement.style.setProperty('--logo-gradient-4', preset.logoGradient[3]);
        document.documentElement.style.setProperty('--logo-gradient-5', preset.logoGradient[4]);
      }
    }
  }, [theme, loading]);

  const updateTheme = async (newTheme) => {
    try {
      const response = await api.put('/users/theme/preferences', newTheme);
      const updatedTheme = response.data.themePreferences;
      setTheme(updatedTheme);
      // Cache the updated theme in localStorage
      localStorage.setItem('userTheme', JSON.stringify(updatedTheme));
      return response.data;
    } catch (error) {
      console.error('Error updating theme preferences:', error);
      throw error;
    }
  };

  const resetTheme = async () => {
    try {
      await updateTheme(defaultTheme);
    } catch (error) {
      console.error('Error resetting theme:', error);
      throw error;
    }
  };

  const value = {
    theme,
    updateTheme,
    resetTheme,
    loading,
    defaultTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
