import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import workspaceService from '../services/workspaceService';
import './WorkspaceManagement.css';

const WorkspaceManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeWorkspace, leaveWorkspace, deleteWorkspace } = useWorkspace();
  const [inviteLink, setInviteLink] = useState(null);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workspaceDetails, setWorkspaceDetails] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const loadWorkspaceDetails = useCallback(async () => {
    if (!activeWorkspace) return;

    try {
      setLoading(true);
      setError(null);
      const data = await workspaceService.getWorkspaceById(activeWorkspace.id);
      setWorkspaceDetails(data);
    } catch (err) {
      console.error('Failed to load workspace details:', err);
      setError(err.message || 'Failed to load workspace details');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    loadWorkspaceDetails();
  }, [loadWorkspaceDetails]);

  // Redirect if user is not admin or planner
  useEffect(() => {
    if (workspaceDetails && workspaceDetails.role) {
      const userRole = workspaceDetails.role;
      if (userRole !== 'admin' && userRole !== 'planner') {
        setError('Access denied. Only admins and planners can access workspace settings.');
        setTimeout(() => {
          navigate('/home');
        }, 2000);
      }
    }
  }, [workspaceDetails, navigate]);

  const handleGenerateInvite = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await workspaceService.generateInvite(activeWorkspace.id, expiresInDays);
      setInviteLink(data.inviteLink);
    } catch (err) {
      console.error('Failed to generate invite:', err);
      setError(err.message || 'Failed to generate invite link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      alert('Invite link copied to clipboard!');
    }
  };

  const handleLeaveWorkspace = async () => {
    if (!activeWorkspace) return;

    try {
      setLoading(true);
      setError(null);
      await leaveWorkspace(activeWorkspace.id);
      navigate('/home');
      window.location.reload();
    } catch (err) {
      console.error('Failed to leave workspace:', err);
      setError(err.message || 'Failed to leave workspace');
    } finally {
      setLoading(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace) return;

    try {
      setLoading(true);
      setError(null);
      await deleteWorkspace(activeWorkspace.id);
      navigate('/home');
      window.location.reload();
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      setError(err.message || 'Failed to delete workspace');
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      setLoading(true);
      setError(null);
      await workspaceService.updateMemberRole(activeWorkspace.id, userId, newRole);
      // Reload workspace details to reflect the change
      await loadWorkspaceDetails();
    } catch (err) {
      console.error('Failed to update role:', err);
      setError(err.message || 'Failed to update member role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to remove ${username} from this workspace?`)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await workspaceService.removeMember(activeWorkspace.id, userId);
      // Reload workspace details to reflect the change
      await loadWorkspaceDetails();
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError(err.message || 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  if (!activeWorkspace) {
    return (
      <div className="workspace-management">
        <div className="error-message">No active workspace found</div>
      </div>
    );
  }

  const isPersonalWorkspace = activeWorkspace.workspace_type === 'personal';
  const canGenerateInvite = !isPersonalWorkspace;
  const canLeave = !isPersonalWorkspace;
  const canDelete = workspaceDetails?.role === 'admin' || workspaceDetails?.created_by === user?.id;

  return (
    <div className="workspace-management">
      <div className="workspace-management-header">
        <button className="btn-back" onClick={() => navigate('/home')}>
          ← Back to Home
        </button>
        <h1>Workspace Settings</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="workspace-info-card">
        <h2>Workspace Information</h2>
        <div className="workspace-info-grid">
          <div className="info-item">
            <span className="info-label">Name:</span>
            <span className="info-value">{activeWorkspace.name}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Type:</span>
            <span className={`workspace-type-badge ${activeWorkspace.workspace_type}`}>
              {activeWorkspace.workspace_type === 'personal' ? 'Personal' : 'Team'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Your Role:</span>
            <span className="info-value role">{workspaceDetails?.role || 'member'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Members:</span>
            <span className="info-value">{workspaceDetails?.members?.length || 0}</span>
          </div>
        </div>
      </div>

      {workspaceDetails?.members && workspaceDetails.members.length > 0 && (
        <div className="members-card">
          <h2>Members</h2>
          <div className="members-list">
            {workspaceDetails.members.map((member) => (
              <div key={member.id} className="member-item">
                <div className="member-info">
                  <span className="member-username">{member.username}</span>
                  <span className="member-email">{member.email}</span>
                </div>
                <div className="member-actions">
                  {workspaceDetails.role === 'admin' && !isPersonalWorkspace && member.id !== user?.id ? (
                    <>
                      <select
                        className="member-role-select"
                        value={member.role || 'member'}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        disabled={loading}
                      >
                        <option value="admin">Admin</option>
                        <option value="planner">Planner</option>
                        <option value="leader">Leader</option>
                        <option value="member">Member</option>
                      </select>
                      <button
                        className="btn-remove-member"
                        onClick={() => handleRemoveMember(member.id, member.username)}
                        disabled={loading}
                        title="Remove member"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className={`member-role ${member.role}`}>
                      {member.role || 'member'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canGenerateInvite && (
        <div className="invite-card">
          <h2>Invite Members</h2>
          <p className="invite-description">
            Generate an invite link to add new members to this team workspace.
            Invite links are temporary and expire after the specified number of days.
          </p>

          <div className="invite-form">
            <div className="form-group">
              <label htmlFor="expiresInDays">Link expires in:</label>
              <select
                id="expiresInDays"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                disabled={loading}
              >
                <option value={1}>1 day</option>
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>

            <button
              className="btn-generate"
              onClick={handleGenerateInvite}
              disabled={loading}
            >
              Generate Invite Link
            </button>
          </div>

          {inviteLink && (
            <div className="invite-link-container">
              <div className="invite-link-box">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="invite-link-input"
                />
                <button
                  className="btn-copy"
                  onClick={handleCopyInviteLink}
                  disabled={loading}
                >
                  Copy
                </button>
              </div>
              <p className="invite-link-note">
                Share this link with people you want to invite. The link will expire in {expiresInDays} day(s).
              </p>
            </div>
          )}
        </div>
      )}

      {isPersonalWorkspace && (
        <div className="personal-workspace-note">
          <strong>Note:</strong> Personal workspaces cannot be shared with other users.
          Create a team workspace to collaborate with others.
        </div>
      )}

      <div className="workspace-actions">
        <h2>Workspace Actions</h2>

        {canLeave && (
          <div className="action-item">
            <div className="action-info">
              <h3>Leave Workspace</h3>
              <p>Remove yourself from this workspace. You can rejoin later with an invite link.</p>
            </div>
            <button
              className="btn-leave"
              onClick={() => setShowLeaveConfirm(true)}
              disabled={loading}
            >
              Leave Workspace
            </button>
          </div>
        )}

        {canDelete && (
          <div className="action-item">
            <div className="action-info">
              <h3>Delete Workspace</h3>
              <p>
                Permanently delete this workspace and all its data. All members will be removed.
                This action cannot be undone.
              </p>
            </div>
            <button
              className="btn-delete"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
            >
              Delete Workspace
            </button>
          </div>
        )}
      </div>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="modal-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Leave Workspace?</h3>
            <p>Are you sure you want to leave "{activeWorkspace.name}"?</p>
            <p>You will need an invite link to rejoin.</p>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowLeaveConfirm(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn-confirm-leave"
                onClick={handleLeaveWorkspace}
                disabled={loading}
              >
                {loading ? 'Leaving...' : 'Leave Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Workspace?</h3>
            <p>Are you sure you want to delete "{activeWorkspace.name}"?</p>
            <p className="warning-text">
              This will permanently delete all workspace data and remove all members.
              This action cannot be undone!
            </p>
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                className="btn-confirm-delete"
                onClick={handleDeleteWorkspace}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceManagement;
