import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { GRADIENT_PRESETS } from '../../contexts/ThemeContext';
import WorkspaceSwitcher from '../WorkspaceSwitcher';
import './Header.css';

// Helper function to get hue rotation for each theme
const getHueRotation = (preset) => {
  const rotations = {
    professional: 0,      // Blue-purple (base color)
    warm: 320,           // Pink-coral
    nature: 100,         // Green-teal
    elegant: 180         // Dark blue-gray
  };
  return rotations[preset] || 0;
};

const Header = ({ title, user, showLogout = false, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isRTL } = useLanguage();
  const { theme } = useTheme();
  const isOnUsersPage = location.pathname === '/users';
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (userMenuOpen) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen]);

  // Get the current gradient preset
  const currentPreset = GRADIENT_PRESETS[theme?.gradientPreset] || GRADIENT_PRESETS.professional;

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="app-title">
          <span
            className="app-logo-text"
            style={{
              color: currentPreset.accentColor
            }}
          >
            FLOW
          </span>
        </div>
        <div className="header-actions">
          {user && !user.isGuest && <WorkspaceSwitcher />}
          {user && (
            <div className="user-menu-container">
              <span
                className="username"
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                }}
                title={t('common.settings')}
              >
                [{user.username}]
              </span>
              {userMenuOpen && (
                <div className="user-dropdown-menu">
                  <button
                    className="menu-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/settings');
                    }}
                  >
                    {t('common.settings')}
                  </button>
                  {user?.role === 'admin' && !isOnUsersPage && (
                    <button
                      className="menu-item"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/users');
                      }}
                    >
                      {t('common.users')}
                    </button>
                  )}
                  {showLogout && (
                    <button
                      className="menu-item"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout();
                      }}
                    >
                      {t('common.logout')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
