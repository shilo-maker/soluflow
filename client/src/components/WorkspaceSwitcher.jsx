import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2, Check, Plus, ChevronDown, Link, Loader2, Settings, Users } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useLanguage } from '../contexts/LanguageContext';

function WorkspaceIcon({ type }) {
  return type === 'personal' ? (
    <User size={16} />
  ) : (
    <Building2 size={16} />
  );
}

const styles = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  triggerName: {
    maxWidth: '180px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    marginTop: '4px',
    width: '288px',
    maxWidth: 'calc(100vw - 2rem)',
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
    border: '1px solid rgba(229,231,235,0.6)',
    padding: '8px 0',
    zIndex: 1001,
  },
  sectionHeader: {
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  wsButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    textAlign: 'left',
    fontSize: '14px',
    background: 'transparent',
    color: '#374151',
  },
  wsButtonActive: {
    background: '#fdf2f0',
    color: '#8f3d50',
  },
  wsLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    flex: 1,
  },
  wsName: {
    fontSize: '14px',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  roleBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '9999px',
    background: '#f3f4f6',
    color: '#6b7280',
    textTransform: 'capitalize',
    flexShrink: 0,
  },
  wsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  iconBtn: {
    padding: '4px',
    borderRadius: '4px',
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  divider: {
    borderTop: '1px solid #f3f4f6',
    marginTop: '4px',
    paddingTop: '4px',
  },
  createInput: {
    width: '100%',
    fontSize: '14px',
    padding: '6px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
  },
  createBtn: {
    flex: 1,
    fontSize: '12px',
    padding: '6px 12px',
    background: '#a3485e',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  cancelBtn: {
    fontSize: '12px',
    padding: '6px 12px',
    background: 'transparent',
    color: '#6b7280',
    border: 'none',
    cursor: 'pointer',
    transition: 'color 0.15s',
  },
  newWsBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    color: '#4b5563',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  feedback: {
    padding: '6px 12px',
    fontSize: '12px',
    textAlign: 'center',
  },
  skeleton: {
    width: '128px',
    height: '36px',
    background: '#f3f4f6',
    borderRadius: '8px',
  },
};

export default function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const {
    workspaces,
    activeWorkspace,
    loading,
    switchWorkspace,
    createWorkspace,
    generateInvite,
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [switchError, setSwitchError] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [inviteError, setInviteError] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(null);
  const [hovered, setHovered] = useState(null);

  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const copiedTimerRef = useRef(null);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setCreating(false);
    setNewName('');
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        closeDropdown();
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeDropdown();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeDropdown]);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleSwitch = async (ws) => {
    if (ws.id === activeWorkspace?.id) {
      setOpen(false);
      return;
    }
    try {
      setSwitchError(false);
      await switchWorkspace(ws.id);
      setOpen(false);
      navigate('/library');
    } catch {
      setSwitchError(true);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setCreateError(false);
      const ws = await createWorkspace(newName.trim());
      setNewName('');
      setCreating(false);
      setOpen(false);
      try {
        await switchWorkspace(ws.id);
      } catch {
        // created but switch failed
      }
    } catch {
      setCreateError(true);
    }
  };

  const handleInvite = async (e, wsId) => {
    e.stopPropagation();
    try {
      setInviteError(false);
      setInviteLoading(wsId);
      const result = await generateInvite(wsId);
      const url = `${window.location.origin}/workspace/invite/${result.token}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt(t('workspace.copyLink'), url);
      }
      setCopiedId(wsId);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setInviteError(true);
    } finally {
      setInviteLoading(null);
    }
  };

  if (!activeWorkspace) {
    return <div style={styles.skeleton} />;
  }

  const isRtl = document.documentElement.dir === 'rtl';
  const dropdownPos = isRtl ? { right: 0 } : { left: 0 };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => {
          if (!open) {
            setSwitchError(false);
            setCreateError(false);
            setInviteError(false);
          }
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-haspopup="true"
        style={styles.trigger}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#fdf2f0'; e.currentTarget.style.color = '#8f3d50'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}
      >
        <WorkspaceIcon type={activeWorkspace.workspace_type} />
        <span style={styles.triggerName}>
          {activeWorkspace.workspace_type === 'personal'
            ? t('workspace.personalWorkspace')
            : activeWorkspace.name}
        </span>
        <ChevronDown
          size={16}
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div style={{ ...styles.dropdown, ...dropdownPos }} role="menu">
          <div style={styles.sectionHeader}>
            {t('workspace.workspaces')}
          </div>

          {workspaces.map((ws) => {
            const isActive = ws.is_active;
            const isHovered = hovered === ws.id;
            return (
              <button
                key={ws.id}
                role="menuitem"
                style={{
                  ...styles.wsButton,
                  ...(isActive ? styles.wsButtonActive : {}),
                  ...(!isActive && isHovered ? { background: '#f9fafb' } : {}),
                }}
                onMouseEnter={() => setHovered(ws.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleSwitch(ws)}
              >
                <div style={styles.wsLeft}>
                  <WorkspaceIcon type={ws.workspace_type} />
                  <span style={styles.wsName}>
                    {ws.workspace_type === 'personal'
                      ? t('workspace.personalWorkspace')
                      : ws.name}
                  </span>
                  {ws.role && ws.role !== 'member' && (
                    <span style={styles.roleBadge}>{ws.role}</span>
                  )}
                </div>
                <div style={styles.wsRight}>
                  {isActive && ws.workspace_type === 'organization' && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeDropdown();
                        navigate('/workspace/settings');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.stopPropagation();
                          closeDropdown();
                          navigate('/workspace/settings');
                        }
                      }}
                      style={styles.iconBtn}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fce4df'; e.currentTarget.style.color = '#a3485e'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                      title={ws.role === 'admin' ? t('workspace.workspaceSettings') : t('workspace.workspaceMembers')}
                    >
                      {ws.role === 'admin' ? <Settings size={14} /> : <Users size={14} />}
                    </span>
                  )}
                  {ws.workspace_type === 'organization' && ws.role === 'admin' && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleInvite(e, ws.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(e, ws.id); }}
                      style={styles.iconBtn}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fce4df'; e.currentTarget.style.color = '#a3485e'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                      title={copiedId === ws.id ? t('workspace.copied') : t('workspace.copyLink')}
                    >
                      {inviteLoading === ws.id ? (
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Link size={14} />
                      )}
                    </span>
                  )}
                  {isActive && <Check size={16} style={{ color: '#a3485e' }} />}
                </div>
              </button>
            );
          })}

          <div style={styles.divider}>
            {creating ? (
              <div style={{ padding: '8px 12px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') {
                      setCreating(false);
                      setNewName('');
                    }
                  }}
                  placeholder={t('workspace.workspaceName')}
                  maxLength={100}
                  style={styles.createInput}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#BC556F'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(188,85,111,0.2)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || loading}
                    style={{
                      ...styles.createBtn,
                      opacity: (!newName.trim() || loading) ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#7a3345'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#a3485e'; }}
                  >
                    {loading ? t('common.loading') : t('workspace.create')}
                  </button>
                  <button
                    onClick={() => { setCreating(false); setNewName(''); }}
                    style={styles.cancelBtn}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#374151'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                style={styles.newWsBtn}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <Plus size={16} />
                {t('workspace.newWorkspace')}
              </button>
            )}
          </div>

          {copiedId && (
            <div style={{ ...styles.feedback, color: '#16a34a' }}>
              {t('workspace.inviteLinkCopied')}
            </div>
          )}

          {(switchError || createError || inviteError) && (
            <div style={{ ...styles.feedback, color: '#ef4444' }}>
              {[
                switchError && t('workspace.failedSwitch'),
                createError && t('workspace.failedCreate'),
                inviteError && t('workspace.failedInvite'),
              ].filter(Boolean).join('. ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
