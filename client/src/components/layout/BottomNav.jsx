import React from 'react';
import { NavLink } from 'react-router-dom';
import './BottomNav.css';

const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      <NavLink
        to="/home"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <div className="nav-label">HOME</div>
      </NavLink>

      <NavLink
        to="/service"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <div className="nav-label">SERVICE</div>
      </NavLink>

      <NavLink
        to="/library"
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <div className="nav-label">LIBRARY</div>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
