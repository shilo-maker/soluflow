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
    description: 'Classic blue-purple palette - trustworthy and calm'
  },
  warm: {
    name: 'Warm',
    colors: ['#f093fb', '#f5576c', '#fa709a', '#fee140', '#ffa07a'],
    accentColor: '#f5576c',
    description: 'Warm coral and pink - friendly and approachable'
  },
  nature: {
    name: 'Nature',
    colors: ['#56ab2f', '#a8e063', '#38b2ac', '#4fd1c5', '#81e6d9'],
    accentColor: '#38b2ac',
    description: 'Fresh green and teal - calming and growth-oriented'
  },
  elegant: {
    name: 'Elegant',
    colors: ['#1a2332', '#2c3e50', '#34495e', '#546e7a', '#607d8b'],
    accentColor: '#607d8b',
    description: 'Dark navy and gray - elegant and professional'
  }
};

const defaultTheme = {
  gradientPreset: 'professional',
  textColor: '#000000',
  chordColor: '#667eea',
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
  const [theme, setTheme] = useState(guestTheme); // Start with guest theme
  const [loading, setLoading] = useState(true);

  // Load theme preferences when user logs in
  useEffect(() => {
    const loadThemePreferences = async () => {
      if (isAuthenticated && user && !user.isGuest) {
        try {
          const response = await api.get('/users/theme/preferences');
          setTheme(response.data);
        } catch (error) {
          console.error('Error loading theme preferences:', error);
          // Use default theme if there's an error
          setTheme(defaultTheme);
        }
      } else {
        // Use Nature theme for guests (not authenticated)
        setTheme(guestTheme);
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
    }
  }, [theme, loading]);

  const updateTheme = async (newTheme) => {
    try {
      const response = await api.put('/users/theme/preferences', newTheme);
      setTheme(response.data.themePreferences);
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
