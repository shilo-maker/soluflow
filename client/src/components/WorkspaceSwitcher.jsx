import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useLanguage } from '../contexts/LanguageContext';
import './WorkspaceSwitcher.css';

const WorkspaceSwitcher = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
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

  // Format workspace name based on language
  const formatWorkspaceName = (workspace) => {
    if (workspace.workspace_type === 'personal') {
      // Extract username from "[username]'s Workspace" pattern
      const match = workspace.name.match(/^(.+)'s Workspace$/);
      if (match) {
        const username = match[1];
        if (language === 'he') {
          return `הסביבה של ${username}`;
        }
        return workspace.name; // Keep original English format
      }
    }
    return workspace.name; // Return as-is for team workspaces
  };

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
      setError(t('workspace.workspaceNameRequired'));
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

  // Don't show switcher if no workspaces at all
  if (workspaces.length === 0) {
    return null;
  }

  // If no active workspace but we have workspaces, try to use the first one
  const displayWorkspace = activeWorkspace || workspaces[0];

  return (
    <div className="workspace-switcher" ref={dropdownRef}>
      <button
        className="workspace-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
      >
        <span className="workspace-name">{formatWorkspaceName(displayWorkspace)}</span>
        <span className={`workspace-type-badge ${displayWorkspace.workspace_type}`}>
          {displayWorkspace.workspace_type === 'personal' ? (
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
                    <span className="workspace-item-name">{formatWorkspaceName(workspace)}</span>
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
                    title={t('workspace.workspaceSettings')}
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
              + {t('workspace.createTeamWorkspace')}
            </button>
          )}

          {isCreating && (
            <form className="create-workspace-form" onSubmit={handleCreateWorkspace}>
              <input
                type="text"
                placeholder={t('workspace.workspaceName')}
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                autoFocus
                maxLength={50}
              />
              <div className="form-buttons">
                <button type="submit" className="btn-create" disabled={loading}>
                  {t('workspace.create')}
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
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}

          {!canCreateOrganization && !isCreating && (
            <div className="workspace-limit-message">
              {t('workspace.maxWorkspacesReached')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
