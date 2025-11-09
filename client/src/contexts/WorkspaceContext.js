import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import workspaceService from '../services/workspaceService';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

export const WorkspaceProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load user's workspaces
  const loadWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await workspaceService.getAllWorkspaces();
      setWorkspaces(data);

      // Set active workspace (the one marked as active)
      const active = data.find(ws => ws.is_active);
      setActiveWorkspace(active || null);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      setError(err.message || 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Load workspaces when user logs in
  useEffect(() => {
    if (isAuthenticated) {
      loadWorkspaces();
    }
  }, [isAuthenticated, loadWorkspaces]);

  // Switch active workspace
  const switchWorkspace = async (workspaceId) => {
    try {
      setLoading(true);
      setError(null);

      const data = await workspaceService.switchWorkspace(workspaceId);

      // Update workspaces list to reflect new active workspace
      setWorkspaces(prev =>
        prev.map(ws => ({
          ...ws,
          is_active: ws.id === workspaceId
        }))
      );

      // Update active workspace
      const newActive = workspaces.find(ws => ws.id === workspaceId);
      setActiveWorkspace(newActive);

      return data;
    } catch (err) {
      console.error('Failed to switch workspace:', err);
      setError(err.message || 'Failed to switch workspace');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Create new team workspace
  const createWorkspace = async (name) => {
    try {
      setLoading(true);
      setError(null);

      const newWorkspace = await workspaceService.createWorkspace(name);

      // Add new workspace to list
      setWorkspaces(prev => [...prev, newWorkspace]);

      return newWorkspace;
    } catch (err) {
      console.error('Failed to create workspace:', err);
      setError(err.message || 'Failed to create workspace');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Leave workspace
  const leaveWorkspace = async (workspaceId) => {
    try {
      setLoading(true);
      setError(null);

      await workspaceService.leaveWorkspace(workspaceId);

      // Remove workspace from list
      setWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId));

      // If leaving active workspace, switch to first available
      if (activeWorkspace?.id === workspaceId) {
        const remaining = workspaces.filter(ws => ws.id !== workspaceId);
        if (remaining.length > 0) {
          await switchWorkspace(remaining[0].id);
        } else {
          setActiveWorkspace(null);
        }
      }
    } catch (err) {
      console.error('Failed to leave workspace:', err);
      setError(err.message || 'Failed to leave workspace');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Delete workspace
  const deleteWorkspace = async (workspaceId) => {
    try {
      setLoading(true);
      setError(null);

      await workspaceService.deleteWorkspace(workspaceId);

      // Remove workspace from list
      setWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId));

      // If deleting active workspace, switch to first available
      if (activeWorkspace?.id === workspaceId) {
        const remaining = workspaces.filter(ws => ws.id !== workspaceId);
        if (remaining.length > 0) {
          await switchWorkspace(remaining[0].id);
        } else {
          setActiveWorkspace(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      setError(err.message || 'Failed to delete workspace');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Generate invite link
  const generateInvite = async (workspaceId, expiresInDays = 7) => {
    try {
      setError(null);
      const data = await workspaceService.generateInvite(workspaceId, expiresInDays);
      return data;
    } catch (err) {
      console.error('Failed to generate invite:', err);
      setError(err.message || 'Failed to generate invite');
      throw err;
    }
  };

  // Accept invite
  const acceptInvite = async (token) => {
    try {
      setLoading(true);
      setError(null);

      const data = await workspaceService.acceptInvite(token);

      // Reload workspaces to include new one
      await loadWorkspaces();

      return data;
    } catch (err) {
      console.error('Failed to accept invite:', err);
      setError(err.message || 'Failed to accept invite');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Check if user can join more workspaces (max 5)
  const canJoinMore = workspaces.length < 5;

  // Count team workspaces (max 4)
  const teamCount = workspaces.filter(ws => ws.workspace_type === 'organization').length;
  const canCreateOrganization = teamCount < 4;

  const value = {
    workspaces,
    activeWorkspace,
    loading,
    error,
    canJoinMore,
    canCreateOrganization,
    teamCount,
    loadWorkspaces,
    switchWorkspace,
    createWorkspace,
    leaveWorkspace,
    deleteWorkspace,
    generateInvite,
    acceptInvite
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};
