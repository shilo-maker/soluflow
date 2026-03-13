import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Shield, Users, Link, Trash2, Loader2, Save, AlertTriangle, UserPlus, Search, Mail, Clock, LogOut } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getInitials, getAvatarColor } from '../utils/imageUtils';
import workspaceService from '../services/workspaceService';

const ROLE_OPTIONS = ['admin', 'leader', 'member'];
const ROLE_DISPLAY = { admin: { en: 'Manager', he: 'מנהל' }, planner: { en: 'Member', he: 'חבר' }, leader: { en: 'Leader', he: 'מוביל' }, member: { en: 'Member', he: 'חבר' } };
const getRoleLabel = (role, lang) => ROLE_DISPLAY[role]?.[lang === 'he' ? 'he' : 'en'] || role;

// ─── Inline style objects ────────────────────────────────────────────────────

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '768px' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' },
  heading: { fontSize: '30px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 },
  subtitle: { color: '#4b5563', marginTop: '4px', fontSize: '14px' },

  card: {
    background: 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(4px)',
    borderRadius: '16px',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    padding: '24px',
    transition: 'box-shadow 0.3s',
  },
  cardDanger: {
    border: '2px solid #fecaca',
  },

  sectionHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' },
  sectionTitle: { fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 },
  sectionCount: { fontSize: '14px', color: '#6b7280' },

  flexRow: { display: 'flex', gap: '12px' },
  input: {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    outline: 'none',
    transition: 'all 0.2s',
    background: '#ffffff',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  inputFocused: {
    borderColor: '#BC556F',
    boxShadow: '0 0 0 4px rgba(188,85,111,0.2)',
  },

  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '10px 20px', borderRadius: '12px',
    fontWeight: 600, fontSize: '14px',
    background: 'linear-gradient(to right, #a3485e, #BC556F)',
    color: '#ffffff', border: 'none', cursor: 'pointer',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
    transition: 'all 0.3s', transform: 'translateY(0)',
  },
  btnPrimaryHover: {
    background: 'linear-gradient(to right, #7a3345, #8f3d50)',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
    transform: 'translateY(-2px)',
  },
  btnDanger: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 16px', borderRadius: '8px',
    fontWeight: 600, fontSize: '14px',
    background: '#dc2626', color: '#ffffff',
    border: 'none', cursor: 'pointer',
    transition: 'background 0.2s',
  },
  btnDangerHover: { background: '#b91c1c' },
  btnWarning: {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 16px', borderRadius: '8px',
    fontWeight: 600, fontSize: '14px',
    background: '#f59e0b', color: '#ffffff',
    border: 'none', cursor: 'pointer',
    transition: 'background 0.2s',
  },

  memberRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px', borderRadius: '8px', background: '#f9fafb',
    transition: 'background 0.15s',
  },
  memberRowHover: { background: '#f3f4f6' },
  memberLeft: { display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 },
  avatar: {
    width: '32px', height: '32px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#ffffff', fontWeight: 700, fontSize: '12px', flexShrink: 0,
  },
  memberName: { fontSize: '14px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  memberEmail: { fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  memberRight: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },

  roleSelect: {
    fontSize: '12px', padding: '4px 8px',
    border: '1px solid #e5e7eb', borderRadius: '8px',
    background: '#ffffff', cursor: 'pointer',
  },
  roleBadge: {
    fontSize: '12px', padding: '4px 8px',
    border: '1px solid #e5e7eb', borderRadius: '8px',
    background: '#ffffff', color: '#4b5563',
    textTransform: 'capitalize',
  },

  iconBtn: {
    padding: '6px', color: '#9ca3af', background: 'transparent',
    border: 'none', borderRadius: '4px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.15s',
  },
  iconBtnDangerHover: { color: '#dc2626' },
  iconBtnTealHover: { color: '#a3485e' },

  searchContainer: { position: 'relative', flex: 1 },
  searchIcon: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' },

  resultCard: { borderRadius: '8px', border: '1px solid #e5e7eb', padding: '12px' },
  badge: (bg, color) => ({
    fontSize: '12px', padding: '4px 10px', borderRadius: '9999px',
    background: bg, color, fontWeight: 500,
  }),

  pendingRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px', borderRadius: '8px', background: 'rgba(249,250,251,0.6)', opacity: 0.7,
  },
  pendingBadge: {
    fontSize: '12px', padding: '2px 8px', borderRadius: '9999px',
    background: '#fffbeb', color: '#b45309', fontWeight: 500,
  },

  msgError: { fontSize: '14px', color: '#ef4444', marginBottom: '12px' },
  msgSuccess: { fontSize: '14px', color: '#16a34a', marginBottom: '12px' },

  disabled: { opacity: 0.5, cursor: 'not-allowed' },
};

// ─── Avatar helper ───────────────────────────────────────────────────────────

function MemberAvatar({ src, name, size = 32 }) {
  if (src) {
    return <img src={src} alt={name} style={{ ...s.avatar, width: size, height: size, objectFit: 'cover' }} />;
  }
  return (
    <div style={{ ...s.avatar, width: size, height: size, backgroundColor: getAvatarColor(name || '') }}>
      {getInitials(name || '?')}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const WorkspaceManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { activeWorkspace, leaveWorkspace, deleteWorkspace: deleteWs, loadWorkspaces } = useWorkspace();

  // State
  const [workspaceDetails, setWorkspaceDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [nameInitialized, setNameInitialized] = useState(false);
  const [renamePending, setRenamePending] = useState(false);
  const [renameSuccess, setRenameSuccess] = useState('');
  const [renameError, setRenameError] = useState('');
  // Add Member
  const [searchEmail, setSearchEmail] = useState('');
  const [debouncedEmail, setDebouncedEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Member invites
  const [memberInvites, setMemberInvites] = useState([]);
  const [revokingMemberInviteId, setRevokingMemberInviteId] = useState(null);

  // Invite link generation
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteGenSuccess, setInviteGenSuccess] = useState('');
  const [inviteGenError, setInviteGenError] = useState('');

  // Mutations loading
  const [roleUpdatePending, setRoleUpdatePending] = useState(false);
  const [removePending, setRemovePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [leavePending, setLeavePending] = useState(false);
  const [mutationError, setMutationError] = useState('');

  // Hover states
  const [hoveredMember, setHoveredMember] = useState(null);

  const debounceRef = useRef(null);

  const wsId = activeWorkspace?.id;
  const isOrg = activeWorkspace?.workspace_type === 'organization';
  const isOrgAdmin = isOrg && workspaceDetails?.role === 'admin';
  const canManage = isOrg && (workspaceDetails?.role === 'admin');

  // ── Data loading ──

  const loadDetails = useCallback(async () => {
    if (!wsId || !isOrg) return;
    try {
      setLoading(true);
      setError(null);
      const data = await workspaceService.getWorkspaceById(wsId);
      setWorkspaceDetails(data);
    } catch (err) {
      setError(err.error || err.message || 'Failed to load workspace details');
    } finally {
      setLoading(false);
    }
  }, [wsId, isOrg]);

  const loadMemberInvites = useCallback(async () => {
    if (!wsId || !isOrg) return;
    try {
      const data = await workspaceService.getMemberInvites(wsId);
      setMemberInvites(data);
    } catch { /* non-critical */ }
  }, [wsId, isOrg]);

  useEffect(() => {
    loadDetails();
    loadMemberInvites();
  }, [loadDetails, loadMemberInvites]);

  // Initialize name from loaded data
  useEffect(() => {
    if (workspaceDetails && !nameInitialized) {
      setName(workspaceDetails.name || activeWorkspace?.name || '');
      setNameInitialized(true);
    }
  }, [workspaceDetails, nameInitialized, activeWorkspace]);

  // Debounced email search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedEmail(searchEmail.trim().toLowerCase());
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchEmail]);

  useEffect(() => {
    if (!debouncedEmail || !wsId) {
      setSearchResult(null);
      return;
    }
    let cancelled = false;
    const doSearch = async () => {
      try {
        setIsSearching(true);
        const result = await workspaceService.searchUserByEmail(wsId, debouncedEmail);
        if (!cancelled) setSearchResult(result);
      } catch {
        if (!cancelled) setSearchResult(null);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };
    doSearch();
    return () => { cancelled = true; };
  }, [debouncedEmail, wsId]);

  // ── Guards ──

  if (!activeWorkspace) {
    return (
      <div style={s.center}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
      </div>
    );
  }

  if (!isOrg) {
    return (
      <div style={s.center}>
        <div style={{ textAlign: 'center' }}>
          <Shield size={64} style={{ color: '#9ca3af', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>{t('workspace.notAvailable')}</h2>
          <p style={{ color: '#4b5563' }}>{t('workspace.notAvailableDesc')}</p>
        </div>
      </div>
    );
  }

  if (loading && !workspaceDetails) {
    return (
      <div style={s.center}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
      </div>
    );
  }

  // ── Handlers ──

  const handleRename = async () => {
    if (!name.trim() || name.trim() === (workspaceDetails?.name || activeWorkspace?.name)) return;
    try {
      setRenamePending(true); setRenameError(''); setRenameSuccess('');
      await workspaceService.renameWorkspace(wsId, name.trim());
      setRenameSuccess(t('workspace.renameSaved'));
      await loadWorkspaces();
      await loadDetails();
      setTimeout(() => setRenameSuccess(''), 4000);
    } catch (err) {
      setRenameError(err.error || err.message || 'Error');
    } finally {
      setRenamePending(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      setRoleUpdatePending(true); setMutationError('');
      await workspaceService.updateMemberRole(wsId, userId, role);
      await loadDetails();
    } catch (err) {
      setMutationError(err.error || err.message || 'Error');
    } finally {
      setRoleUpdatePending(false);
    }
  };

  const handleRemoveMember = async (userId, memberName) => {
    if (!window.confirm(t('workspace.removeConfirm'))) return;
    try {
      setRemovePending(true); setMutationError('');
      await workspaceService.removeMember(wsId, userId);
      await loadDetails();
    } catch (err) {
      setMutationError(err.error || err.message || 'Error');
    } finally {
      setRemovePending(false);
    }
  };

  const handleSendMemberInvite = async () => {
    if (!debouncedEmail || sendingInvite) return;
    try {
      setSendingInvite(true); setInviteError(''); setInviteSuccess('');
      await workspaceService.sendMemberInvite(wsId, debouncedEmail, inviteRole);
      setInviteSuccess(t('workspace.inviteSent'));
      setSearchEmail(''); setDebouncedEmail(''); setInviteRole('member'); setSearchResult(null);
      loadMemberInvites();
      setTimeout(() => setInviteSuccess(''), 4000);
    } catch (err) {
      setInviteError(err.error || err.message || 'Error');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeMemberInvite = async (inviteId) => {
    try {
      setRevokingMemberInviteId(inviteId);
      await workspaceService.revokeMemberInvite(wsId, inviteId);
      loadMemberInvites();
    } catch (err) {
      setMutationError(err.error || err.message || 'Error');
    } finally {
      setRevokingMemberInviteId(null);
    }
  };

  const handleGenerateInvite = async () => {
    if (!wsId) return;
    try {
      setGeneratingInvite(true); setInviteGenError(''); setInviteGenSuccess('');
      const result = await workspaceService.generateInvite(wsId);
      const url = result.inviteLink || `${window.location.origin}/workspace/invite/${result.token}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt(t('workspace.copyLink'), url);
      }
      setInviteGenSuccess(t('workspace.inviteGenerated'));
      setTimeout(() => setInviteGenSuccess(''), 4000);
    } catch (err) {
      setInviteGenError(err.error || err.message || 'Error');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm(t('workspace.leaveConfirm'))) return;
    try {
      setLeavePending(true);
      await leaveWorkspace(wsId);
      navigate('/library');
      window.location.reload();
    } catch (err) {
      setMutationError(err.error || err.message || 'Error');
    } finally {
      setLeavePending(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('workspace.deleteConfirm'))) return;
    try {
      setDeletePending(true);
      await deleteWs(wsId);
      await loadWorkspaces();
      navigate('/library');
    } catch (err) {
      setMutationError(err.error || err.message || 'Error');
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <div style={s.page}>
      {/* Page title */}
      <div>
        <h1 style={s.heading}>
          {isOrgAdmin ? <Settings size={32} /> : <Users size={32} />}
          {isOrgAdmin ? t('workspace.title') : t('workspace.membersTitle')}
        </h1>
        <p style={s.subtitle}>
          {isOrgAdmin ? t('workspace.subtitle') : t('workspace.membersSubtitle')}
        </p>
      </div>

      {error && <p style={s.msgError}>{error}</p>}

      {/* General — admin only */}
      {isOrgAdmin && (
        <div style={s.card}>
          <h2 style={{ ...s.sectionTitle, marginBottom: '16px' }}>{t('workspace.general')}</h2>
          <div style={s.flexRow}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              style={{ ...s.input, flex: 1 }}
              placeholder={t('workspace.workspaceName')}
              onFocus={(e) => Object.assign(e.currentTarget.style, s.inputFocused)}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; }}
            />
            <HoverButton
              base={s.btnPrimary}
              hover={s.btnPrimaryHover}
              onClick={handleRename}
              disabled={!name.trim() || name.trim() === (workspaceDetails?.name || activeWorkspace?.name || '') || renamePending}
            >
              {renamePending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
              {t('common.save')}
            </HoverButton>
          </div>
          {renameError && <p style={{ ...s.msgError, marginTop: '8px', marginBottom: 0, fontSize: '14px' }}>{renameError}</p>}
          {renameSuccess && <p style={{ ...s.msgSuccess, marginTop: '8px', marginBottom: 0, fontSize: '14px' }}>{renameSuccess}</p>}
        </div>
      )}

      {/* Add Member — admin only */}
      {isOrgAdmin && (
        <div style={s.card}>
          <div style={s.sectionHeader}>
            <UserPlus size={20} style={{ color: '#a3485e' }} />
            <h2 style={s.sectionTitle}>{t('workspace.addMember')}</h2>
          </div>

          <div style={{ ...s.flexRow, marginBottom: '12px' }}>
            <div style={s.searchContainer}>
              <Search size={16} style={s.searchIcon} />
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder={t('workspace.searchByEmail')}
                style={{ ...s.input, paddingLeft: '36px' }}
                onFocus={(e) => Object.assign(e.currentTarget.style, s.inputFocused)}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; }}
              />
            </div>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              style={{ ...s.roleSelect, fontSize: '14px', padding: '8px 12px' }}
            >
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{getRoleLabel(r, language)}</option>)}
            </select>
          </div>

          {isSearching && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280', padding: '8px 0' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {t('workspace.searching')}
            </div>
          )}

          {searchResult && !isSearching && debouncedEmail && (
            <div style={s.resultCard}>
              {searchResult.found ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={s.memberLeft}>
                    <MemberAvatar src={searchResult.user?.avatar_url} name={searchResult.user?.name || searchResult.user?.email || '?'} />
                    <div style={{ minWidth: 0 }}>
                      <div style={s.memberName}>{searchResult.user?.name || searchResult.user?.username || searchResult.user?.email}</div>
                      <div style={s.memberEmail}>{searchResult.user?.email}</div>
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {searchResult.alreadyMember ? (
                      <span style={s.badge('#f3f4f6', '#4b5563')}>{t('workspace.alreadyMember')}</span>
                    ) : searchResult.alreadyInvited ? (
                      <span style={s.badge('#fffbeb', '#b45309')}>{t('workspace.alreadyInvited')}</span>
                    ) : (
                      <HoverButton base={s.btnPrimary} hover={s.btnPrimaryHover} onClick={handleSendMemberInvite} disabled={sendingInvite}>
                        {sendingInvite ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={16} />}
                        {t('workspace.invite')}
                      </HoverButton>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', padding: '4px 0', margin: 0 }}>
                  {t('workspace.noUserFound')}
                </p>
              )}
            </div>
          )}

          {inviteError && <p style={{ ...s.msgError, marginTop: '8px', marginBottom: 0, fontSize: '14px' }}>{inviteError}</p>}
          {inviteSuccess && <p style={{ ...s.msgSuccess, marginTop: '8px', marginBottom: 0, fontSize: '14px' }}>{inviteSuccess}</p>}
        </div>
      )}

      {/* Members */}
      <div style={s.card}>
        <div style={s.sectionHeader}>
          <Users size={20} style={{ color: '#a3485e' }} />
          <h2 style={s.sectionTitle}>{t('workspace.members')}</h2>
          <span style={s.sectionCount}>({workspaceDetails?.members?.length || 0})</span>
        </div>

        {(mutationError) && <p style={{ ...s.msgError, fontSize: '14px' }}>{mutationError}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {workspaceDetails?.members?.map((member) => {
            const isCurrentUser = member.id === user?.id;
            const displayName = member.username || member.name || member.email;

            return (
              <div
                key={member.id}
                style={{
                  ...s.memberRow,
                  ...(hoveredMember === member.id ? s.memberRowHover : {}),
                }}
                onMouseEnter={() => setHoveredMember(member.id)}
                onMouseLeave={() => setHoveredMember(null)}
              >
                <div style={s.memberLeft}>
                  <MemberAvatar src={member.avatar_url} name={displayName} />
                  <div style={{ minWidth: 0 }}>
                    <div style={s.memberName}>
                      {displayName}
                      {isCurrentUser && (
                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#a3485e', fontWeight: 600 }}>{t('workspace.you')}</span>
                      )}
                    </div>
                    <div style={s.memberEmail}>{member.email}</div>
                  </div>
                </div>

                <div style={s.memberRight}>
                  {isOrgAdmin ? (
                    <>
                      <select
                        value={member.role || 'member'}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        disabled={isCurrentUser || roleUpdatePending}
                        style={{ ...s.roleSelect, ...(isCurrentUser || roleUpdatePending ? s.disabled : {}) }}
                      >
                        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{getRoleLabel(r, language)}</option>)}
                      </select>
                      {!isCurrentUser && (
                        <button
                          onClick={() => handleRemoveMember(member.id, displayName)}
                          disabled={removePending}
                          style={{ ...s.iconBtn, ...(removePending ? s.disabled : {}) }}
                          title={t('workspace.removeMember')}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    <span style={s.roleBadge}>{getRoleLabel(member.role || 'member', language)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pending Member Invites */}
        {memberInvites && memberInvites.length > 0 && (
          <>
            <div style={{ ...s.sectionHeader, marginTop: '24px', marginBottom: '12px' }}>
              <Clock size={16} style={{ color: '#f59e0b' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>{t('workspace.pendingInvites')}</h3>
              <span style={s.sectionCount}>({memberInvites.length})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {memberInvites.map((inv) => {
                const displayName = inv.invitedUser?.name || inv.invited_email?.split('@')[0] || inv.invited_email;
                return (
                  <div key={inv.id} style={s.pendingRow}>
                    <div style={s.memberLeft}>
                      <MemberAvatar src={inv.invitedUser?.avatar_url} name={displayName} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ ...s.memberName, color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {displayName}
                          <span style={s.pendingBadge}>{t('workspace.pending')}</span>
                        </div>
                        <div style={s.memberEmail}>{inv.invited_email}</div>
                      </div>
                    </div>
                    <div style={s.memberRight}>
                      <span style={s.roleBadge}>{getRoleLabel(inv.role, language)}</span>
                      {isOrgAdmin && (
                        <button
                          onClick={() => handleRevokeMemberInvite(inv.id)}
                          disabled={!!revokingMemberInviteId}
                          style={{ ...s.iconBtn, ...(revokingMemberInviteId ? s.disabled : {}) }}
                          title={t('workspace.revokeInvite')}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Invite Link — admin/planner: generate + copy */}
      {canManage && (
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ ...s.sectionHeader, marginBottom: 0 }}>
              <Link size={20} style={{ color: '#a3485e' }} />
              <h2 style={s.sectionTitle}>{t('workspace.inviteLinks')}</h2>
            </div>
            <HoverButton base={{ ...s.btnPrimary, fontSize: '14px' }} hover={s.btnPrimaryHover} onClick={handleGenerateInvite} disabled={generatingInvite}>
              {generatingInvite ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Link size={16} />}
              {t('workspace.generateInvite')}
            </HoverButton>
          </div>
          {inviteGenError && <p style={{ ...s.msgError, fontSize: '14px' }}>{inviteGenError}</p>}
          {inviteGenSuccess && <p style={{ ...s.msgSuccess, fontSize: '14px' }}>{inviteGenSuccess}</p>}
        </div>
      )}

      {/* Leave Workspace — non-admin org members */}
      {isOrg && !isOrgAdmin && (
        <div style={{ ...s.card, ...s.cardDanger }}>
          <div style={s.sectionHeader}>
            <LogOut size={20} style={{ color: '#f59e0b' }} />
            <h2 style={{ ...s.sectionTitle, color: '#b45309' }}>{t('workspace.leaveWorkspace')}</h2>
          </div>
          <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>{t('workspace.leaveDesc')}</p>
          <HoverButton
            base={s.btnWarning}
            hover={{ background: '#d97706' }}
            onClick={handleLeave}
            disabled={leavePending}
          >
            {leavePending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <LogOut size={16} />}
            {t('workspace.leaveWorkspace')}
          </HoverButton>
        </div>
      )}

      {/* Danger Zone — admin only */}
      {isOrgAdmin && (
        <div style={{ ...s.card, ...s.cardDanger }}>
          <div style={s.sectionHeader}>
            <AlertTriangle size={20} style={{ color: '#dc2626' }} />
            <h2 style={{ ...s.sectionTitle, color: '#b91c1c' }}>{t('workspace.dangerZone')}</h2>
          </div>
          <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '16px' }}>{t('workspace.deleteDesc')}</p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <HoverButton
              base={s.btnWarning}
              hover={{ background: '#d97706' }}
              onClick={handleLeave}
              disabled={leavePending}
            >
              {leavePending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <LogOut size={16} />}
              {t('workspace.leaveWorkspace')}
            </HoverButton>

            <HoverButton
              base={s.btnDanger}
              hover={s.btnDangerHover}
              onClick={handleDelete}
              disabled={deletePending}
            >
              {deletePending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
              {t('workspace.deleteWorkspace')}
            </HoverButton>
          </div>

          {mutationError && <p style={{ ...s.msgError, marginTop: '12px', marginBottom: 0, fontSize: '14px' }}>{mutationError}</p>}
        </div>
      )}
    </div>
  );
};

// ─── HoverButton helper ──────────────────────────────────────────────────────

function HoverButton({ base, hover, onClick, disabled, children }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...base,
        ...(isHovered && !disabled ? hover : {}),
        ...(disabled ? s.disabled : {}),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </button>
  );
}

export default WorkspaceManagement;
