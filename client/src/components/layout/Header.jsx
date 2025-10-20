import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import WorkspaceSwitcher from '../WorkspaceSwitcher';
import './Header.css';

const Header = ({ title, user, showLogout = false, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnUsersPage = location.pathname === '/users';

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="app-title">{title || 'SoluFlow'}</div>
        <div className="header-actions">
          {user && !user.isGuest && <WorkspaceSwitcher />}
          {user && <span className="username">[{user.username}]</span>}
          {user?.role === 'admin' && !isOnUsersPage && (
            <button className="btn-users" onClick={() => navigate('/users')}>
              USERS
            </button>
          )}
          {showLogout && (
            <button className="btn-logout" onClick={onLogout}>
              LOGOUT
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
