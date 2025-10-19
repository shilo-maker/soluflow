import React from 'react';
import './Header.css';

const Header = ({ title, user, showLogout = false, onLogout }) => {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="app-title">{title || 'SoluFlow'}</div>
        <div className="header-actions">
          {user && <span className="username">[{user.username}]</span>}
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
