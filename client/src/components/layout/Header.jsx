import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { GRADIENT_PRESETS } from '../../contexts/ThemeContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
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
  const { t, language, isRTL } = useLanguage();
  const { theme } = useTheme();
  const { workspaces, activeWorkspace, switchWorkspace, loading: workspaceLoading } = useWorkspace();
  const isOnUsersPage = location.pathname === '/users';
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Format workspace name based on language
  const formatWorkspaceName = (workspace) => {
    if (!workspace) return '';
    if (workspace.workspace_type === 'personal') {
      const match = workspace.name.match(/^(.+)'s Workspace$/);
      if (match) {
        const username = match[1];
        if (language === 'he') {
          return `הסביבה של ${username}`;
        }
        return workspace.name;
      }
    }
    return workspace.name;
  };

  const handleSwitchWorkspace = async (workspaceId) => {
    try {
      await switchWorkspace(workspaceId);
      setUserMenuOpen(false);
      // Navigate to library to refresh content with new workspace
      navigate('/library');
    } catch (err) {
      console.error('Failed to switch workspace:', err);
    }
  };

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
          {/* Workspace name */}
          {user && !user.isGuest && activeWorkspace && (
            <span
              className="header-workspace-text"
              style={{ color: currentPreset.accentColor }}
            >
              ({t('workspace.workspaceSuffix')}) {activeWorkspace.workspace_type === 'personal'
                ? t('workspace.personalWorkspace')
                : activeWorkspace.name
              }
            </span>
          )}
          {user && (
            <div className="user-menu-container">
              <button
                className="settings-icon-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(!userMenuOpen);
                }}
                title={t('common.settings')}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
              {userMenuOpen && (
                <div className="user-dropdown-menu">
                  {/* Workspace Section */}
                  {!user.isGuest && workspaces.length > 0 && (
                    <>
                      <div className="menu-section-label">{t('workspace.myWorkspaces')}</div>
                      <div className="workspace-list-compact">
                        {workspaces.map((workspace) => (
                          <button
                            key={workspace.id}
                            className={`menu-item workspace-item-compact ${workspace.is_active ? 'active' : ''}`}
                            onClick={() => handleSwitchWorkspace(workspace.id)}
                            disabled={workspaceLoading || workspace.is_active}
                          >
                            <span className="workspace-icon">
                              {workspace.workspace_type === 'personal' ? '👤' : '👥'}
                            </span>
                            <span className="workspace-name-text">{formatWorkspaceName(workspace)}</span>
                            {workspace.is_active && <span className="active-check">✓</span>}
                          </button>
                        ))}
                      </div>
                      {activeWorkspace && (
                        <button
                          className="menu-item workspace-settings-link"
                          onClick={() => {
                            setUserMenuOpen(false);
                            navigate('/workspace/settings');
                          }}
                        >
                          {t('workspace.workspaceSettings')}
                        </button>
                      )}
                      <div className="menu-divider" />
                    </>
                  )}

                  {/* User Menu Items */}
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
                      className="menu-item logout-item"
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
