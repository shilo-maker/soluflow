import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import './AcceptInvite.css';

const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { acceptInvite } = useWorkspace();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(null);

  useEffect(() => {
    // If user is not authenticated, redirect to login with returnUrl
    if (!isAuthenticated) {
      navigate(`/login?returnUrl=/workspace/invite/${token}`);
    }
  }, [isAuthenticated, navigate, token]);

  const handleAcceptInvite = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await acceptInvite(token);
      setWorkspaceName(data.workspace?.name);
      setSuccess(true);

      // Redirect to home after 2 seconds
      setTimeout(() => {
        window.location.href = '/home';
      }, 2000);
    } catch (err) {
      console.error('Failed to accept invite:', err);
      let errorMessage = 'Failed to accept invite';

      // Parse specific error messages
      if (err.message.includes('expired')) {
        errorMessage = 'This invite link has expired. Please request a new one.';
      } else if (err.message.includes('invalid')) {
        errorMessage = 'This invite link is invalid or has been used.';
      } else if (err.message.includes('already a member')) {
        errorMessage = 'You are already a member of this workspace.';
      } else if (err.message.includes('workspace limit')) {
        errorMessage = 'You have reached the maximum number of workspaces (4). Please leave a workspace before joining a new one.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="accept-invite-page">
        <div className="invite-card">
          <div className="loading-text">Redirecting to login...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="accept-invite-page">
      <div className="invite-card">
        <div className="invite-icon">📨</div>

        {!success && !error && (
          <>
            <h1>Workspace Invitation</h1>
            <p className="invite-description">
              You've been invited to join a workspace on SoluFlow.
              Click the button below to accept the invitation.
            </p>

            <button
              className="btn-accept"
              onClick={handleAcceptInvite}
              disabled={loading}
            >
              {loading ? 'Accepting...' : 'Accept Invitation'}
            </button>

            <button
              className="btn-cancel"
              onClick={() => navigate('/home')}
              disabled={loading}
            >
              Cancel
            </button>
          </>
        )}

        {success && (
          <>
            <div className="success-icon">✓</div>
            <h1>Welcome!</h1>
            <p className="success-message">
              You've successfully joined {workspaceName ? `"${workspaceName}"` : 'the workspace'}!
            </p>
            <p className="redirect-message">Redirecting to home...</p>
          </>
        )}

        {error && (
          <>
            <div className="error-icon">⚠️</div>
            <h1>Unable to Accept Invite</h1>
            <p className="error-message">{error}</p>
            <button
              className="btn-home"
              onClick={() => navigate('/home')}
            >
              Go to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
