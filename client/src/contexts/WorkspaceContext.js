import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
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

  // LocalStorage cache keys for offline support
  const WORKSPACES_CACHE_KEY = 'soluflow_workspaces_cache';
  const ACTIVE_WORKSPACE_KEY = 'soluflow_active_workspace';

  const getCachedWorkspaces = useCallback(() => {
    try {
      const cached = localStorage.getItem(WORKSPACES_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }, []);

  const cacheWorkspaces = useCallback((data, active) => {
    try {
      localStorage.setItem(WORKSPACES_CACHE_KEY, JSON.stringify(data));
      if (active) {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, JSON.stringify(active));
      }
    } catch (e) {
      console.warn('Failed to cache workspaces to localStorage:', e);
    }
  }, []);

  const getCachedActiveWorkspace = useCallback(() => {
    try {
      const cached = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }, []);

  // Load user's workspaces with offline support
  const loadWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // If offline, use cached data immediately
      if (!navigator.onLine) {
        const cachedData = getCachedWorkspaces();
        if (cachedData) {
          setWorkspaces(cachedData);
          const active = cachedData.find(ws => ws.is_active) || getCachedActiveWorkspace();
          setActiveWorkspace(active || null);
          setLoading(false);
          return;
        }
      }

      const data = await workspaceService.getAllWorkspaces();
      setWorkspaces(data);

      // Set active workspace (the one marked as active)
      const active = data.find(ws => ws.is_active);
      setActiveWorkspace(active || null);

      // Cache for offline use
      cacheWorkspaces(data, active);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      // Try to load from cache on error
      const cachedData = getCachedWorkspaces();
      if (cachedData) {
        setWorkspaces(cachedData);
        const active = cachedData.find(ws => ws.is_active) || getCachedActiveWorkspace();
        setActiveWorkspace(active || null);
        setError(null);
      } else {
        setError(err.message || 'Failed to load workspaces');
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getCachedWorkspaces, getCachedActiveWorkspace, cacheWorkspaces]);

  // Load workspaces when user logs in
  useEffect(() => {
    if (isAuthenticated) {
      loadWorkspaces();
    }
  }, [isAuthenticated, loadWorkspaces]);

  // Switch active workspace
  const switchWorkspace = useCallback(async (workspaceId) => {
    try {
      setLoading(true);
      setError(null);

      const data = await workspaceService.switchWorkspace(workspaceId);

      // Update workspaces list to reflect new active workspace
      const updated = workspaces.map(ws => ({
        ...ws,
        is_active: ws.id === workspaceId
      }));
      const newActive = updated.find(ws => ws.id === workspaceId);

      setWorkspaces(updated);
      setActiveWorkspace(newActive);

      // Update cache with new active workspace
      cacheWorkspaces(updated, newActive);

      return data;
    } catch (err) {
      console.error('Failed to switch workspace:', err);
      setError(err.message || 'Failed to switch workspace');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [workspaces, cacheWorkspaces]);

  // Create new team workspace
  const createWorkspace = useCallback(async (name) => {
    try {
      setLoading(true);
      setError(null);

      const newWorkspace = await workspaceService.createWorkspace(name);

      // Add new workspace to list
      const updated = [...workspaces, newWorkspace];
      setWorkspaces(updated);

      // Update cache with new workspace list
      cacheWorkspaces(updated, activeWorkspace);

      return newWorkspace;
    } catch (err) {
      console.error('Failed to create workspace:', err);
      setError(err.message || 'Failed to create workspace');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [workspaces, activeWorkspace, cacheWorkspaces]);

  // Leave workspace
  const leaveWorkspace = useCallback(async (workspaceId) => {
    try {
      setLoading(true);
      setError(null);

      await workspaceService.leaveWorkspace(workspaceId);

      // Remove workspace from list
      const remaining = workspaces.filter(ws => ws.id !== workspaceId);
      setWorkspaces(remaining);

      // If leaving active workspace, switch to first available
      const newActive = activeWorkspace?.id === workspaceId ? null : activeWorkspace;
      setActiveWorkspace(newActive);

      // Update cache
      cacheWorkspaces(remaining, newActive);
    } catch (err) {
      console.error('Failed to leave workspace:', err);
      setError(err.message || 'Failed to leave workspace');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [workspaces, activeWorkspace, cacheWorkspaces]);

  // Delete workspace
  const deleteWorkspace = useCallback(async (workspaceId) => {
    try {
      setLoading(true);
      setError(null);

      await workspaceService.deleteWorkspace(workspaceId);

      // Remove workspace from list
      const remaining = workspaces.filter(ws => ws.id !== workspaceId);
      setWorkspaces(remaining);

      // If deleting active workspace, clear it
      const newActive = activeWorkspace?.id === workspaceId ? null : activeWorkspace;
      setActiveWorkspace(newActive);

      // Update cache
      cacheWorkspaces(remaining, newActive);
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      setError(err.message || 'Failed to delete workspace');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [workspaces, activeWorkspace, cacheWorkspaces]);

  // Generate invite link
  const generateInvite = useCallback(async (workspaceId, expiresInDays = 7) => {
    try {
      setError(null);
      const data = await workspaceService.generateInvite(workspaceId, expiresInDays);
      return data;
    } catch (err) {
      console.error('Failed to generate invite:', err);
      setError(err.message || 'Failed to generate invite');
      throw err;
    }
  }, []);

  // Accept invite
  const acceptInvite = useCallback(async (token) => {
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
  }, [loadWorkspaces]);

  // Check if user can join more workspaces (max 5)
  const canJoinMore = workspaces.length < 5;

  // Count team workspaces (max 4)
  const teamCount = workspaces.filter(ws => ws.workspace_type === 'organization').length;
  const canCreateOrganization = teamCount < 4;

  const value = useMemo(() => ({
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
  }), [workspaces, activeWorkspace, loading, error, canJoinMore, canCreateOrganization, teamCount, loadWorkspaces, switchWorkspace, createWorkspace, leaveWorkspace, deleteWorkspace, generateInvite, acceptInvite]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};
