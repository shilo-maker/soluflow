import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { GRADIENT_PRESETS } from '../../contexts/ThemeContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import authService from '../../services/authService';
import './Header.css';

const Header = ({ title, user, showLogout = false, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { workspaces, activeWorkspace, switchWorkspace, loading: workspaceLoading } = useWorkspace();
  const isOnUsersPage = location.pathname === '/users';
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [appMenuPos, setAppMenuPos] = useState({});
  const [userMenuPos, setUserMenuPos] = useState({});
  const appMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const appBtnRef = useRef(null);
  const userBtnRef = useRef(null);

  // Compute fixed dropdown position from trigger button
  const computeDropdownPos = (btnRef) => {
    if (!btnRef.current) return {};
    const rect = btnRef.current.getBoundingClientRect();
    const pos = { position: 'fixed', top: rect.bottom + 4, zIndex: 1001 };
    // Align to whichever side has more room
    if (rect.right > window.innerWidth / 2) {
      pos.right = window.innerWidth - rect.right;
    } else {
      pos.left = rect.left;
    }
    return pos;
  };

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

  const SOLUCAST_URL = process.env.REACT_APP_SOLUCAST_URL || 'https://solucast.app';

  const [ssoError, setSsoError] = useState(null);

  const handleOpenSoluCast = async () => {
    if (ssoLoading) return;
    setSsoLoading(true);
    setSsoError(null);
    let newWindow = null;
    try {
      // Open window synchronously (before await) to avoid popup blockers
      newWindow = window.open('about:blank', '_blank');
      const { code } = await authService.generateSSOCode();
      const url = `${SOLUCAST_URL}/sso?code=${code}`;
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        window.location.href = url;
      }
      setAppMenuOpen(false);
    } catch (error) {
      console.error('SSO code generation failed:', error);
      if (newWindow) newWindow.close();
      setSsoError('Failed to connect');
      setTimeout(() => setSsoError(null), 3000);
    } finally {
      setSsoLoading(false);
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (appMenuOpen && appMenuRef.current && !appMenuRef.current.contains(e.target)) {
        setAppMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen, appMenuOpen]);

  // Recompute dropdown position on window resize
  useEffect(() => {
    if (!appMenuOpen && !userMenuOpen) return;
    const handleResize = () => {
      if (appMenuOpen) setAppMenuPos(computeDropdownPos(appBtnRef));
      if (userMenuOpen) setUserMenuPos(computeDropdownPos(userBtnRef));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [appMenuOpen, userMenuOpen]);

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
          {/* App Switcher (waffle menu) */}
          {user && !user.isGuest && (
            <div className="app-switcher-container" ref={appMenuRef}>
              <button
                ref={appBtnRef}
                className="app-switcher-button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!appMenuOpen) setAppMenuPos(computeDropdownPos(appBtnRef));
                  setAppMenuOpen(!appMenuOpen);
                  setUserMenuOpen(false);
                }}
                title="Switch apps"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  {[2, 8, 14].map(cy =>
                    [2, 8, 14].map(cx => (
                      <circle key={`${cx}-${cy}`} cx={cx + 1} cy={cy + 1} r="1.8" fill="currentColor" />
                    ))
                  )}
                </svg>
              </button>
              {appMenuOpen && (
                <div className="app-switcher-dropdown" style={appMenuPos}>
                  {/* SoluFlow (current) */}
                  <div className="app-card app-card-active">
                    <div className="app-card-icon" style={{ background: 'linear-gradient(135deg, #4ecdc4, #2ba89e)' }}>SF</div>
                    <div className="app-card-info">
                      <div className="app-card-name">SoluFlow</div>
                      <div className="app-card-desc">{t('common.currentApp')}</div>
                    </div>
                  </div>
                  {/* SoluCast */}
                  <button
                    className="app-card app-card-link"
                    onClick={handleOpenSoluCast}
                    disabled={ssoLoading}
                  >
                    <div className="app-card-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>SC</div>
                    <div className="app-card-info">
                      <div className={`app-card-name${ssoError ? ' app-card-error' : ''}`}>{ssoLoading ? 'Opening...' : ssoError ? ssoError : 'SoluCast'}</div>
                      <div className="app-card-desc">{t('common.presentation')}</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {user && (
            <div className="user-menu-container" ref={userMenuRef}>
              <button
                ref={userBtnRef}
                className="settings-icon-button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!userMenuOpen) setUserMenuPos(computeDropdownPos(userBtnRef));
                  setUserMenuOpen(!userMenuOpen);
                  setAppMenuOpen(false);
                }}
                title={t('common.settings')}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
              {userMenuOpen && (
                <div className="user-dropdown-menu" style={userMenuPos}>
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
