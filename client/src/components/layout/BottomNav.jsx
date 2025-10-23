import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import './BottomNav.css';

const BottomNav = () => {
  const { t } = useLanguage();

  return (
    <nav className="bottom-nav">
      <NavLink
        to="/home"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <div className="nav-label">{t('bottomNav.home').toUpperCase()}</div>
      </NavLink>

      <NavLink
        to="/service"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <div className="nav-label">{t('service.title').toUpperCase()}</div>
      </NavLink>

      <NavLink
        to="/library"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <div className="nav-label">{t('bottomNav.library').toUpperCase()}</div>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
