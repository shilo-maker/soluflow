import React, { useState, useEffect } from 'react';
import workspaceService from '../services/workspaceService';
import './PassLeadershipModal.css';

const PassLeadershipModal = ({ service, isOpen, onClose, onLeaderChanged }) => {
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && service) {
      fetchWorkspaceMembers();
      setSelectedLeaderId(service.leader_id);
    }
  }, [isOpen, service]);

  const fetchWorkspaceMembers = async () => {
    try {
      setLoading(true);
      console.log('Fetching workspace members for service:', service);
      console.log('Workspace ID:', service?.workspace_id);

      if (!service?.workspace_id) {
        throw new Error('Service does not have a workspace_id');
      }

      const members = await workspaceService.getWorkspaceMembers(service.workspace_id);
      console.log('Fetched members:', members);
      setWorkspaceMembers(members);
    } catch (err) {
      console.error('Error fetching workspace members:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError(`Failed to load workspace members: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedLeaderId) {
      setError('Please select a leader');
      return;
    }

    if (selectedLeaderId === service.leader_id) {
      setError('This member is already the leader');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await onLeaderChanged(selectedLeaderId);
      onClose();
    } catch (err) {
      console.error('Error changing leader:', err);
      setError(err.response?.data?.error || 'Failed to change leader');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content pass-leadership-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Pass Leadership</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="modal-error">{error}</div>}

            <p className="leadership-description">
              Select a new leader for this service. The new leader will control song navigation,
              transposition, and other settings during live sessions.
            </p>

            <div className="form-group">
              <label htmlFor="leader-select">Select New Leader *</label>
              {loading && workspaceMembers.length === 0 ? (
                <div className="loading-members">Loading members...</div>
              ) : (
                <div className="members-list">
                  {workspaceMembers.map(member => (
                    <label
                      key={member.user_id}
                      className={`member-option ${selectedLeaderId === member.user_id ? 'selected' : ''} ${member.user_id === service.leader_id ? 'current-leader' : ''}`}
                    >
                      <input
                        type="radio"
                        name="leader"
                        value={member.user_id}
                        checked={selectedLeaderId === member.user_id}
                        onChange={(e) => setSelectedLeaderId(parseInt(e.target.value))}
                      />
                      <div className="member-info">
                        <div className="member-name">
                          {member.user?.username || member.user?.email || 'Unknown User'}
                          {member.user_id === service.leader_id && (
                            <span className="current-badge">Current Leader</span>
                          )}
                        </div>
                        <div className="member-role">
                          {member.role === 'admin' ? '👑 Admin' :
                           member.role === 'planner' ? '📋 Planner' :
                           '👤 Member'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={loading || !selectedLeaderId}
            >
              {loading ? 'Changing...' : 'Change Leader'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PassLeadershipModal;
