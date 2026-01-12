import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import enTranslations from '../locales/en.json';
import heTranslations from '../locales/he.json';

const LanguageContext = createContext();

const translations = {
  en: enTranslations,
  he: heTranslations
};

export const LanguageProvider = ({ children }) => {
  const { user } = useAuth();
  // Check localStorage for saved language preference, default to Hebrew for guests
  const savedLanguage = localStorage.getItem('guestLanguage') || 'he';
  const [language, setLanguageState] = useState(savedLanguage);
  const [isRTL, setIsRTL] = useState(savedLanguage === 'he');

  // Load user's language preference
  useEffect(() => {
    if (user && !user.isGuest && user.language) {
      // Logged-in user: use their saved language preference
      setLanguageState(user.language);
      setIsRTL(user.language === 'he');
      // Update document direction
      document.documentElement.dir = user.language === 'he' ? 'rtl' : 'ltr';
      document.documentElement.lang = user.language;
    } else {
      // Guest user: use localStorage or default to Hebrew
      const guestLang = localStorage.getItem('guestLanguage') || 'he';
      setLanguageState(guestLang);
      setIsRTL(guestLang === 'he');
      document.documentElement.dir = guestLang === 'he' ? 'rtl' : 'ltr';
      document.documentElement.lang = guestLang;
    }
  }, [user]);

  // Function to get translation by key path (e.g., "common.login")
  const t = (key, defaultValue = '') => {
    const keys = key.split('.');
    let value = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue || key;
      }
    }

    return value || defaultValue || key;
  };

  // Function to change language and update user profile
  const setLanguage = async (newLanguage) => {
    if (!['en', 'he'].includes(newLanguage)) {
      console.error('Invalid language:', newLanguage);
      return;
    }

    try {
      // Update local state immediately for better UX
      setLanguageState(newLanguage);
      setIsRTL(newLanguage === 'he');
      document.documentElement.dir = newLanguage === 'he' ? 'rtl' : 'ltr';
      document.documentElement.lang = newLanguage;

      // Update on server if user is logged in
      if (user && !user.isGuest) {
        await api.put('/auth/profile', { language: newLanguage });
      } else {
        // For guests, save to localStorage
        localStorage.setItem('guestLanguage', newLanguage);
      }
    } catch (error) {
      console.error('Failed to update language:', error);
      // Revert on error
      const oldLanguage = user?.language || localStorage.getItem('guestLanguage') || 'he';
      setLanguageState(oldLanguage);
      setIsRTL(oldLanguage === 'he');
      document.documentElement.dir = oldLanguage === 'he' ? 'rtl' : 'ltr';
      document.documentElement.lang = oldLanguage;
      throw error;
    }
  };

  const value = {
    language,
    setLanguage,
    t,
    isRTL
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return default values when used outside provider (e.g., PDF generation)
    return {
      language: 'he',
      setLanguage: () => {},
      t: (key) => key,
      isRTL: true
    };
  }
  return context;
};

export default LanguageContext;
