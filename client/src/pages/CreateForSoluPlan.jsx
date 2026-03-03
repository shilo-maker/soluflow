import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import serviceService from '../services/serviceService';
import ServiceEditModal from '../components/ServiceEditModal';
import './CreateForSoluPlan.css';

const CreateForSoluPlan = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, checkAuth } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [authHandled, setAuthHandled] = useState(false);
  const [createdService, setCreatedService] = useState(null);
  const [copied, setCopied] = useState(false);

  const returnUrl = searchParams.get('return_url') || '';

  // Build prefill from URL params (once)
  const prefill = useRef(null);
  if (!prefill.current) {
    const title = searchParams.get('title') || '';
    const date = searchParams.get('date') || '';
    const time = searchParams.get('time') || '';
    const location = searchParams.get('location') || '';
    const datetime = date && time ? `${date}T${time}` : date ? `${date}T12:00` : '';
    prefill.current = { title, datetime, location: location ? `[Generated] ${location}` : '' };
  }

  // Handle token from URL params for cross-app auth
  useEffect(() => {
    const handleAuth = async () => {
      const tokenParam = searchParams.get('token');

      // Clean token from URL for security (stays in browser history otherwise)
      if (tokenParam) {
        const cleanParams = new URLSearchParams(searchParams);
        cleanParams.delete('token');
        const remaining = cleanParams.toString();
        const cleanUrl = window.location.pathname + (remaining ? `?${remaining}` : '');
        window.history.replaceState({}, '', cleanUrl);
      }

      if (!isAuthenticated && tokenParam) {
        // Store token from SoluPlan and trigger auth check
        localStorage.setItem('token', tokenParam);
        try {
          await checkAuth();
        } catch (err) {
          console.error('Cross-app auth failed:', err);
        }
      }
      setAuthHandled(true);
    };

    handleAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to login if not authenticated and no token provided
  useEffect(() => {
    if (authHandled && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [authHandled, isAuthenticated, navigate]);

  const handleSave = async (formData, setlist) => {
    if (!activeWorkspace?.id) {
      throw new Error('Workspace not loaded yet. Please wait a moment and try again.');
    }

    const serviceData = {
      ...formData,
      workspace_id: activeWorkspace.id,
      leader_id: user.id,
      created_by: user.id,
    };

    const newService = await serviceService.createService(serviceData);

    // Add songs to setlist if provided
    if (setlist && setlist.length > 0) {
      for (let i = 0; i < setlist.length; i++) {
        const song = setlist[i];
        await serviceService.addSongToService(newService.id, {
          song_id: song.id,
          position: i,
          segment_type: 'song',
        });
      }
    }

    setCreatedService(newService);

    // Tell ServiceEditModal to NOT call onClose — we show a success screen instead
    return { skipClose: true };
  };

  const handleCopyCode = async () => {
    if (!createdService?.code) return;
    try {
      await navigator.clipboard.writeText(createdService.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = createdService.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReturnToSoluPlan = () => {
    if (!returnUrl || !createdService?.code) return;
    const separator = returnUrl.includes('?') ? '&' : '?';
    window.location.href = `${returnUrl}${separator}code=${createdService.code}`;
  };

  const handleStayInSoluFlow = () => {
    navigate(`/service/${createdService.id}`);
  };

  // Show loading until auth is resolved
  if (!authHandled || !isAuthenticated) {
    return (
      <div className="create-for-soluplan-loading">
        <div className="loading-spinner" />
        <p>Authenticating...</p>
      </div>
    );
  }

  // Success screen after service creation
  if (createdService) {
    return (
      <div className="create-for-soluplan-success">
        <div className="success-card">
          <div className="success-icon">&#10003;</div>
          <h2>Setlist Created!</h2>
          <p className="success-title">{createdService.title}</p>

          <div className="service-code-display">
            <label>Service Code</label>
            <div className="code-row">
              <span className="code-value">{createdService.code}</span>
              <button
                className="btn-copy"
                onClick={handleCopyCode}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="success-actions">
            {returnUrl && (
              <button
                className="btn-return-soluplan"
                onClick={handleReturnToSoluPlan}
              >
                Return to SoluPlan
              </button>
            )}
            <button
              className="btn-stay-soluflow"
              onClick={handleStayInSoluFlow}
            >
              Stay in SoluFlow
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show ServiceEditModal in create mode with prefill
  return (
    <div className="create-for-soluplan-page">
      <ServiceEditModal
        service={null}
        isOpen={true}
        onClose={() => {
          // User cancelled — go back to SoluPlan or SoluFlow home
          if (returnUrl) {
            window.location.href = returnUrl;
          } else {
            navigate('/service');
          }
        }}
        onSave={handleSave}
        prefill={prefill.current}
      />
    </div>
  );
};

export default CreateForSoluPlan;
