import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useLanguage } from '../contexts/LanguageContext';
import './WorkspaceSwitcher.css';

const WorkspaceSwitcher = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const {
    workspaces,
    activeWorkspace,
    loading,
    canCreateOrganization,
    switchWorkspace,
    createWorkspace
  } = useWorkspace();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [error, setError] = useState(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsCreating(false);
        setError(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSwitchWorkspace = async (workspaceId) => {
    try {
      setError(null);
      await switchWorkspace(workspaceId);
      setIsOpen(false);
      // Reload the page to refresh all workspace-filtered data
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Failed to switch workspace');
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) {
      setError('Workspace name is required');
      return;
    }

    try {
      setError(null);
      await createWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setIsCreating(false);
    } catch (err) {
      setError(err.message || 'Failed to create workspace');
    }
  };

  if (!activeWorkspace || workspaces.length === 0) {
    return null;
  }

  return (
    <div className="workspace-switcher" ref={dropdownRef}>
      <button
        className="workspace-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
      >
        <span className="workspace-name">{activeWorkspace.name}</span>
        <span className={`workspace-type-badge ${activeWorkspace.workspace_type}`}>
          {activeWorkspace.workspace_type === 'personal' ? (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 8c1.66 0 3-1.34 3-3S9.66 2 8 2 5 3.34 5 5s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V15h14v-1.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          ) : (
            <svg width="16" height="12" viewBox="0 0 24 16" fill="currentColor">
              <path d="M8 8c1.66 0 3-1.34 3-3S9.66 2 8 2 5 3.34 5 5s1.34 3 3 3zm8 0c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 2c-2.33 0-7 1.17-7 3.5V15h14v-1.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V15h6v-1.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          )}
        </span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="workspace-dropdown">
          <div className="workspace-list">
            {workspaces.map((workspace) => (
              <div
                key={workspace.id}
                className={`workspace-item ${workspace.is_active ? 'active' : ''}`}
              >
                <button
                  className="workspace-item-button"
                  onClick={() => handleSwitchWorkspace(workspace.id)}
                  disabled={loading || workspace.is_active}
                >
                  <div className="workspace-item-content">
                    <span className="workspace-item-name">{workspace.name}</span>
                    <span className={`workspace-type-badge ${workspace.workspace_type}`}>
                      {workspace.workspace_type === 'personal' ? (
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 8c1.66 0 3-1.34 3-3S9.66 2 8 2 5 3.34 5 5s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V15h14v-1.5c0-2.33-4.67-3.5-7-3.5z"/>
                        </svg>
                      ) : (
                        <svg width="16" height="12" viewBox="0 0 24 16" fill="currentColor">
                          <path d="M8 8c1.66 0 3-1.34 3-3S9.66 2 8 2 5 3.34 5 5s1.34 3 3 3zm8 0c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 2c-2.33 0-7 1.17-7 3.5V15h14v-1.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V15h6v-1.5c0-2.33-4.67-3.5-7-3.5z"/>
                        </svg>
                      )}
                    </span>
                  </div>
                  {workspace.is_active && <span className="active-indicator">●</span>}
                </button>
                {workspace.is_active && (
                  <button
                    className="workspace-settings-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/workspace/settings');
                      setIsOpen(false);
                    }}
                    title="Workspace Settings"
                  >
                    ⋯
                  </button>
                )}
              </div>
            ))}
          </div>

          {error && <div className="workspace-error">{error}</div>}

          {!isCreating && canCreateOrganization && (
            <button
              className="create-workspace-button"
              onClick={() => setIsCreating(true)}
            >
              + Create Team Workspace
            </button>
          )}

          {isCreating && (
            <form className="create-workspace-form" onSubmit={handleCreateWorkspace}>
              <input
                type="text"
                placeholder="Workspace name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                autoFocus
                maxLength={50}
              />
              <div className="form-buttons">
                <button type="submit" className="btn-create" disabled={loading}>
                  Create
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setIsCreating(false);
                    setNewWorkspaceName('');
                    setError(null);
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!canCreateOrganization && !isCreating && (
            <div className="workspace-limit-message">
              Maximum 3 team workspaces reached
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
