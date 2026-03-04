import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Settings } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import WorkspaceSwitcher from '../WorkspaceSwitcher';
import authService from '../../services/authService';
import workspaceService from '../../services/workspaceService';
import { getInitials, getAvatarColor } from '../../utils/imageUtils';
import './Header.css';

const Header = ({ user, showLogout = false, onLogout, onMenuToggle }) => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { workspaces } = useWorkspace();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [respondingToken, setRespondingToken] = useState(null);
  const [appMenuPos, setAppMenuPos] = useState({});
  const [userMenuPos, setUserMenuPos] = useState({});
  const appMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const appBtnRef = useRef(null);
  const userBtnRef = useRef(null);

  // Compute fixed dropdown position from trigger button
  const computeDropdownPos = useCallback((btnRef) => {
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
  }, []);

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

  // Fetch pending invites for the logged-in user
  useEffect(() => {
    if (!user || user.isGuest) return;
    let cancelled = false;
    const fetchInvites = async () => {
      try {
        const invites = await workspaceService.getMyInvites();
        if (!cancelled) setPendingInvites(invites);
      } catch (err) {
        // Silently ignore — non-critical
      }
    };
    fetchInvites();
    return () => { cancelled = true; };
  }, [user, workspaces]); // re-fetch when workspaces change (after accept)

  const handleRespondInvite = async (token, action) => {
    setRespondingToken(token);
    try {
      await workspaceService.respondToMemberInvite(token, action);
      setPendingInvites(prev => prev.filter(i => i.token !== token));
      if (action === 'accept') {
        // Reload workspaces to include the new one
        window.location.reload();
        return; // Skip finally cleanup — page is reloading
      }
    } catch (err) {
      console.error('Failed to respond to invite:', err);
    }
    setRespondingToken(null);
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
  }, [appMenuOpen, userMenuOpen, computeDropdownPos]);

  return (
    <header className="app-header">
      <div className="header-content">
        {/* Left side: hamburger (mobile) + workspace name */}
        <div className="header-left">
          {/* Hamburger button - mobile only */}
          {onMenuToggle && (
            <button
              className="header-hamburger"
              onClick={onMenuToggle}
              aria-label="Toggle menu"
            >
              <Menu size={24} />
            </button>
          )}

          {/* Workspace switcher */}
          {user && !user.isGuest && <WorkspaceSwitcher />}
        </div>

        <div className="header-actions">
          {user && (
            <div className="user-menu-container" ref={userMenuRef}>
              <button
                ref={userBtnRef}
                className="settings-icon-button user-avatar-button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!userMenuOpen) setUserMenuPos(computeDropdownPos(userBtnRef));
                  setUserMenuOpen(!userMenuOpen);
                  setAppMenuOpen(false);
                }}
                title={t('common.settings')}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.username} className="header-avatar-img" />
                ) : (
                  <span className="header-avatar-initials" style={{ backgroundColor: getAvatarColor(user.username || user.email || '') }}>
                    {getInitials(user.username || user.email || '?')}
                  </span>
                )}
                {pendingInvites.length > 0 && (
                  <span className="invite-badge">{pendingInvites.length}</span>
                )}
              </button>
              {userMenuOpen && (
                <div className="user-dropdown-menu" style={userMenuPos}>
                  {/* User info header */}
                  <div className="user-menu-header">
                    <div className="user-menu-name">{user.username || user.email}</div>
                    {user.email && user.username && (
                      <div className="user-menu-email">{user.email}</div>
                    )}
                  </div>
                  <div className="menu-divider" />

                  {/* Pending Invitations */}
                  {pendingInvites.length > 0 && (
                    <>
                      <div className="menu-section-label">{language === 'he' ? 'הזמנות ממתינות' : 'Pending Invitations'}</div>
                      <div className="pending-invites-list">
                        {pendingInvites.map(invite => (
                          <div key={invite.id} className="pending-invite-dropdown-item">
                            <div className="pending-invite-info">
                              <span className="pending-invite-workspace">{invite.workspace?.name}</span>
                              <span className="pending-invite-role">{invite.role}</span>
                            </div>
                            <div className="pending-invite-actions">
                              <button
                                className="btn-invite-accept"
                                onClick={() => handleRespondInvite(invite.token, 'accept')}
                                disabled={respondingToken === invite.token}
                              >
                                {respondingToken === invite.token ? '...' : '✓'}
                              </button>
                              <button
                                className="btn-invite-decline"
                                onClick={() => handleRespondInvite(invite.token, 'decline')}
                                disabled={respondingToken === invite.token}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="menu-divider" />
                    </>
                  )}

                  {/* User Settings */}
                  <button
                    className="menu-item"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/user/settings');
                    }}
                  >
                    <Settings size={16} />
                    <span>{t('common.settings') || 'User Settings'}</span>
                  </button>

                  {/* Logout */}
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
                    <div className="app-card-icon" style={{ background: 'linear-gradient(135deg, #F9A470, #BC556F)' }}>SF</div>
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
        </div>
      </div>
    </header>
  );
};

export default Header;
