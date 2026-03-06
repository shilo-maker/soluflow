import React, { useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Music, ListMusic, Settings, UserCog, LayoutDashboard, LogOut, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme, GRADIENT_PRESETS } from '../../contexts/ThemeContext';
import { getInitials, getAvatarColor } from '../../utils/imageUtils';
import './Sidebar.css';

// Prefetch route chunks on hover for instant navigation
const routePrefetchMap = {
  '/library': () => import('../../pages/Library'),
  '/services': () => import('../../pages/ServicesList'),
  '/users': () => import('../../pages/UserManagement'),
  '/user/settings': () => import('../../pages/UserSettings'),
};
const prefetched = new Set();

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const isRtl = language === 'he';
  const currentPreset = GRADIENT_PRESETS[theme?.gradientPreset] || GRADIENT_PRESETS.warm;

  // Close mobile sidebar when resizing to desktop viewport
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isOpen) {
        onClose();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, onClose]);

  // Close sidebar on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleLogout = () => {
    onClose();
    logout();
    window.location.href = '/login';
  };

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  const handleNavHover = useCallback((path) => {
    if (prefetched.has(path)) return;
    const prefetchFn = routePrefetchMap[path];
    if (prefetchFn) {
      prefetched.add(path);
      prefetchFn().catch(() => {}); // Silently prefetch chunk
    }
  }, []);

  // Build nav items based on user role
  const navItems = [
    {
      to: '/library',
      icon: Music,
      label: t('bottomNav.library') || 'Library',
    },
    {
      to: '/services',
      icon: ListMusic,
      label: t('service.title') || 'Service',
    },
  ];

  // Admin-only items
  if (user?.role === 'admin') {
    navItems.push({
      to: '/users',
      icon: UserCog,
      label: t('common.users') || 'Users',
    });
    navItems.push({
      to: 'https://solucast.app/admin',
      icon: LayoutDashboard,
      label: 'לוח ניהול שירים',
      external: true,
    });
  }

  // Sidebar gradient driven by theme preset
  const sidebarStyle = {
    background: currentPreset.sidebarGradient,
    backgroundSize: '300% 300%',
    animation: 'gradient-shift 8s ease infinite',
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
        />
      )}

      <aside
        className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}
        style={sidebarStyle}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Close button (mobile only) */}
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>

        {/* Logo / Brand */}
        <div className="sidebar-brand">
          <img src="/neutral_logo.png" alt="SoluFlow" className="sidebar-brand-logo" />
          <span className="sidebar-logo">SoluFlow</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            item.external ? (
              <a
                key={item.to}
                href={item.to}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleNavClick}
                className="sidebar-nav-item"
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </a>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleNavClick}
                onMouseEnter={() => handleNavHover(item.to)}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : ''}`
                }
              >
                <item.icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            )
          ))}
        </nav>

        {/* Bottom section - User info + Logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user-info">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="sidebar-avatar" />
            ) : (
              <span
                className="sidebar-avatar sidebar-avatar-initials"
                style={{ backgroundColor: getAvatarColor(user?.username || user?.email || '') }}
              >
                {getInitials(user?.username || user?.email || '?')}
              </span>
            )}
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">{user?.username || user?.email}</span>
              <span className="sidebar-user-role">{user?.role}</span>
            </div>
          </div>
          <div className="sidebar-footer-actions">
            <button
              className="sidebar-action-btn"
              onClick={() => {
                handleNavClick();
                navigate('/user/settings');
              }}
              title={t('common.settings') || 'Settings'}
            >
              <Settings size={18} />
            </button>
            <button
              className="sidebar-action-btn"
              onClick={handleLogout}
              title={t('common.logout') || 'Logout'}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
