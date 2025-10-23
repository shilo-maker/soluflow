import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import WorkspaceSwitcher from '../WorkspaceSwitcher';
import './Header.css';

const Header = ({ title, user, showLogout = false, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
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

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="app-title">
          <img src="/navbar.png" alt="SoluFlow" className="app-logo" />
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
