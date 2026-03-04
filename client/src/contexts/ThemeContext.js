import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
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
  warm: {
    name: 'Peach Rose',
    colors: ['#8f3d50', '#a3485e', '#BC556F', '#F9A470', '#fcd5b8'],
    accentColor: '#BC556F',
    accentColorDark: '#a3485e',
    accentColorRgb: '188, 85, 111',
    logoGradient: ['#a3485e', '#BC556F', '#F9A470', '#fcd5b8', '#a3485e'],
    sidebarGradient: 'linear-gradient(90deg, #F9A470, #BC556F)',
    bodyBackground: 'linear-gradient(to bottom right, #f9fafb, rgba(253, 242, 240, 0.3), rgba(252, 228, 223, 0.3))',
    description: 'Peach-rose palette - warm and inviting'
  },
  flow: {
    name: 'Flow',
    colors: ['#1e1b4b', '#3730a3', '#6366f1', '#818cf8', '#a5b4fc'],
    accentColor: '#6366f1',
    accentColorDark: '#4f46e5',
    accentColorRgb: '99, 102, 241',
    logoGradient: ['#3730a3', '#6366f1', '#a5b4fc', '#c7d2fe', '#3730a3'],
    sidebarGradient: 'linear-gradient(to bottom right, #1e1b4b, #4338ca, #7c3aed)',
    bodyBackground: 'linear-gradient(to bottom right, #f9fafb, rgba(238, 242, 255, 0.3), rgba(224, 231, 254, 0.3))',
    description: 'Indigo-violet palette - spiritual and contemplative'
  },
  professional: {
    name: 'Professional',
    colors: ['#667eea', '#764ba2', '#5e72e4', '#825ee4', '#6f86d6'],
    accentColor: '#667eea',
    accentColorDark: '#5a67d8',
    accentColorRgb: '102, 126, 234',
    logoGradient: ['#4a5fd8', '#764ba2', '#b89fff', '#d4a9ff', '#4a5fd8'],
    sidebarGradient: 'linear-gradient(to bottom right, #3b3086, #667eea, #764ba2)',
    bodyBackground: 'linear-gradient(to bottom right, #f9fafb, rgba(238, 235, 255, 0.3), rgba(224, 219, 254, 0.3))',
    description: 'Classic blue-purple palette - trustworthy and calm'
  },
  nature: {
    name: 'Nature',
    colors: ['#115e59', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4'],
    accentColor: '#14b8a6',
    accentColorDark: '#0d9488',
    accentColorRgb: '20, 184, 166',
    logoGradient: ['#0f766e', '#14b8a6', '#5eead4', '#99f6e4', '#0f766e'],
    sidebarGradient: 'linear-gradient(to bottom right, #115e59, #0891b2, #059669)',
    bodyBackground: 'linear-gradient(to bottom right, #f9fafb, rgba(240, 253, 251, 0.3), rgba(207, 250, 254, 0.3))',
    description: 'Fresh teal palette - calming and growth-oriented'
  },
  elegant: {
    name: 'Elegant',
    colors: ['#1a2332', '#2c3e50', '#34495e', '#546e7a', '#607d8b'],
    accentColor: '#607d8b',
    accentColorDark: '#546e7a',
    accentColorRgb: '96, 125, 139',
    logoGradient: ['#1a2332', '#546e7a', '#8ba6b8', '#607d8b', '#1a2332'],
    sidebarGradient: 'linear-gradient(to bottom right, #1a2332, #34495e, #546e7a)',
    bodyBackground: 'linear-gradient(to bottom right, #f9fafb, rgba(236, 239, 241, 0.3), rgba(224, 228, 231, 0.3))',
    description: 'Dark navy and gray - elegant and professional'
  }
};

const defaultTheme = {
  gradientPreset: 'warm',
  textColor: '#000000',
  chordColor: '#ad9100',
  chordSize: 1.0
};

const guestTheme = {
  gradientPreset: 'warm',
  textColor: '#000000',
  chordColor: '#ad9100',
  chordSize: 1.0
};

// Normalize theme data — handles both snake_case (from API) and camelCase (from localStorage)
const normalizeTheme = (data) => {
  if (!data || typeof data !== 'object') return defaultTheme;
  return {
    gradientPreset: data.gradient_preset || data.gradientPreset || defaultTheme.gradientPreset,
    textColor: data.text_color || data.textColor || defaultTheme.textColor,
    chordColor: data.chord_color || data.chordColor || defaultTheme.chordColor,
    chordSize: data.chord_size ?? data.chordSize ?? defaultTheme.chordSize,
  };
};

export const ThemeProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  // Initialize theme: try localStorage first, fallback to defaultTheme (not guest theme)
  const getInitialTheme = () => {
    const cachedTheme = localStorage.getItem('userTheme');
    if (cachedTheme) {
      try {
        return normalizeTheme(JSON.parse(cachedTheme));
      } catch (e) {
        return defaultTheme;
      }
    }
    return defaultTheme;
  };

  const [theme, setTheme] = useState(getInitialTheme);
  const [loading, setLoading] = useState(true);

  // Load theme preferences when user logs in
  useEffect(() => {
    const loadThemePreferences = async () => {
      if (isAuthenticated && user && !user.isGuest) {
        try {
          const response = await api.get('/users/theme/preferences');
          const userTheme = normalizeTheme(response.data);
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
      document.documentElement.style.setProperty('--theme-text-color', theme.textColor || defaultTheme.textColor);
      document.documentElement.style.setProperty('--theme-chord-color', theme.chordColor || defaultTheme.chordColor);
      document.documentElement.style.setProperty('--theme-chord-size', String(theme.chordSize ?? defaultTheme.chordSize));

      // Apply body background from preset
      const preset = GRADIENT_PRESETS[theme.gradientPreset] || GRADIENT_PRESETS.warm;
      document.body.style.background = preset.bodyBackground;
      document.body.style.backgroundSize = '';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.minHeight = '100vh';
      document.body.style.animation = '';

      // Set accent color for section headers and buttons
      document.documentElement.style.setProperty('--theme-accent-color', preset.accentColor);

      // Update primary colors (affects all buttons, form focus, badges, etc.)
      document.documentElement.style.setProperty('--color-primary', preset.accentColor);
      document.documentElement.style.setProperty('--color-primary-dark', preset.accentColorDark);
      document.documentElement.style.setProperty('--color-primary-rgb', preset.accentColorRgb);

      // Update shadows to match
      document.documentElement.style.setProperty('--shadow-primary', `0 2px 8px rgba(${preset.accentColorRgb}, 0.4)`);
      document.documentElement.style.setProperty('--shadow-primary-hover', `0 4px 12px rgba(${preset.accentColorRgb}, 0.6)`);

      // Update workspace badge colors to match the theme
      document.documentElement.style.setProperty('--color-badge-personal', preset.accentColor);
      document.documentElement.style.setProperty('--color-badge-workspace', preset.accentColor);

      // Set sidebar gradient as CSS variable for Sidebar component
      document.documentElement.style.setProperty('--sidebar-gradient', preset.sidebarGradient);

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

  const updateTheme = useCallback(async (newTheme) => {
    try {
      const response = await api.put('/users/theme/preferences', newTheme);
      const updatedTheme = normalizeTheme(response.data.themePreferences || response.data.theme_preferences || response.data);
      setTheme(updatedTheme);
      localStorage.setItem('userTheme', JSON.stringify(updatedTheme));
      return response.data;
    } catch (error) {
      console.error('Error updating theme preferences:', error);
      throw error;
    }
  }, []);

  const resetTheme = useCallback(async () => {
    try {
      await api.put('/users/theme/preferences', defaultTheme);
      setTheme(defaultTheme);
      localStorage.setItem('userTheme', JSON.stringify(defaultTheme));
    } catch (error) {
      console.error('Error resetting theme:', error);
      throw error;
    }
  }, []);

  const value = useMemo(() => ({
    theme,
    updateTheme,
    resetTheme,
    loading,
    defaultTheme
  }), [theme, updateTheme, resetTheme, loading]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
