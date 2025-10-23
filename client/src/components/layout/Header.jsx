import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import WorkspaceSwitcher from '../WorkspaceSwitcher';
import './Header.css';

const Header = ({ title, user, showLogout = false, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const isOnUsersPage = location.pathname === '/users';

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="app-title">
          <img src="/navbar.png" alt="SoluFlow" className="app-logo" />
        </div>
        <div className="header-actions">
          {user && !user.isGuest && <WorkspaceSwitcher />}
          {user && (
            <span
              className="username"
              onClick={() => navigate('/settings')}
              title={t('common.settings')}
            >
              [{user.username}]
            </span>
          )}
          {user?.role === 'admin' && !isOnUsersPage && (
            <button className="btn-users" onClick={() => navigate('/users')}>
              {t('common.users')}
            </button>
          )}
          {showLogout && (
            <button className="btn-logout" onClick={onLogout}>
              {t('common.logout')}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
