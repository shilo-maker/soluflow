import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import workspaceService from '../services/workspaceService';
import './AcceptInvite.css';

const MemberInviteResponse = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loadWorkspaces } = useWorkspace();
  const redirectTimer = useRef(null);

  const [inviteDetails, setInviteDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [respondingAction, setRespondingAction] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [declined, setDeclined] = useState(false);

  // Cleanup redirect timer on unmount
  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        setLoading(true);
        const data = await workspaceService.getMemberInviteByToken(token);
        setInviteDetails(data);

        // Auto-submit if action is in URL
        const action = searchParams.get('action');
        if (action === 'accept' || action === 'decline') {
          await handleRespond(action);
        }
      } catch (err) {
        console.error('Failed to load invite:', err);
        setError(err.error || err.message || 'Failed to load invite details');
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRespond = async (action) => {
    try {
      setRespondingAction(action);
      setError(null);
      await workspaceService.respondToMemberInvite(token, action);

      if (action === 'accept') {
        setSuccess(true);
        if (loadWorkspaces) await loadWorkspaces();
        redirectTimer.current = setTimeout(() => {
          navigate('/library');
        }, 2000);
      } else {
        setDeclined(true);
      }
    } catch (err) {
      console.error('Failed to respond to invite:', err);
      setError(err.error || err.message || 'Failed to respond to invite');
    } finally {
      setRespondingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="accept-invite-page">
        <div className="invite-card">
          <div className="loading-text">Loading invitation...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="accept-invite-page">
      <div className="invite-card">
        {error && !success && !declined && (
          <>
            <h1>Invitation Error</h1>
            <p className="error-message">{error}</p>
            <button className="btn-home" onClick={() => navigate('/library')}>
              Go to Library
            </button>
          </>
        )}

        {!error && !success && !declined && inviteDetails && (
          <>
            <h1>Workspace Invitation</h1>
            <p className="invite-description">
              <strong>{inviteDetails.invitedBy?.username}</strong> has invited you to join
              <strong> "{inviteDetails.workspace?.name}"</strong> as a <strong>{inviteDetails.role}</strong>.
            </p>

            <button
              className="btn-accept"
              onClick={() => handleRespond('accept')}
              disabled={!!respondingAction}
            >
              {respondingAction === 'accept' ? 'Accepting...' : 'Accept Invitation'}
            </button>

            <button
              className="btn-cancel"
              onClick={() => handleRespond('decline')}
              disabled={!!respondingAction}
              style={{ marginTop: '10px' }}
            >
              {respondingAction === 'decline' ? 'Declining...' : 'Decline'}
            </button>
          </>
        )}

        {!error && !success && !declined && !inviteDetails && (
          <>
            <h1>Invitation Not Found</h1>
            <p className="invite-description">
              This invitation could not be found. It may have been revoked or already used.
            </p>
            <button className="btn-home" onClick={() => navigate('/library')}>
              Go to Library
            </button>
          </>
        )}

        {success && (
          <>
            <div className="success-icon">&#10003;</div>
            <h1>Welcome!</h1>
            <p className="success-message">
              You've successfully joined "{inviteDetails?.workspace?.name}"!
            </p>
            <p className="redirect-message">Redirecting to library...</p>
          </>
        )}

        {declined && (
          <>
            <h1>Invitation Declined</h1>
            <p className="invite-description">
              You have declined the invitation to join "{inviteDetails?.workspace?.name}".
            </p>
            <button className="btn-home" onClick={() => navigate('/library')}>
              Go to Library
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MemberInviteResponse;
