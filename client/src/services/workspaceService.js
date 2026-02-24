import api from './api';

const workspaceService = {
  // Get all user's workspaces
  getAllWorkspaces: async () => {
    const response = await api.get('/workspaces');
    return response.data.workspaces || response.data;
  },

  // Get specific workspace details
  getWorkspaceById: async (id) => {
    const response = await api.get(`/workspaces/${id}`);
    const workspace = response.data.workspace || response.data;

    // Flatten nested User data in members for the frontend
    if (workspace.members) {
      workspace.members = workspace.members.map(m => {
        const u = m.user || m.User || {};
        return {
          id: u.id || m.user_id || m.userId,
          username: u.username || m.username,
          email: u.email || m.email,
          role: m.role,
        };
      });
    }

    return workspace;
  },

  // Create new team workspace
  createWorkspace: async (name) => {
    const response = await api.post('/workspaces', { name });
    return response.data;
  },

  // Switch active workspace
  switchWorkspace: async (id) => {
    const response = await api.put(`/workspaces/${id}/switch`);
    return response.data;
  },

  // Delete workspace (team only)
  deleteWorkspace: async (id) => {
    const response = await api.delete(`/workspaces/${id}`);
    return response.data;
  },

  // Generate invite link
  generateInvite: async (workspaceId, expiresInDays = 7) => {
    const response = await api.post(`/workspaces/${workspaceId}/invite`, { expiresInDays });
    return response.data;
  },

  // Accept invite
  acceptInvite: async (token) => {
    const response = await api.post(`/workspaces/join/${token}`);
    return response.data;
  },

  // Leave workspace
  leaveWorkspace: async (id) => {
    const response = await api.delete(`/workspaces/${id}/leave`);
    return response.data;
  },

  // Update member role (admin only)
  updateMemberRole: async (workspaceId, userId, role) => {
    const response = await api.put(`/workspaces/${workspaceId}/members/${userId}/role`, { role });
    return response.data;
  },

  // Remove member from workspace (admin only)
  removeMember: async (workspaceId, userId) => {
    const response = await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
    return response.data;
  },

  // Get workspace members
  getWorkspaceMembers: async (workspaceId) => {
    const response = await api.get(`/workspaces/${workspaceId}/members`);
    return response.data;
  }
};

export default workspaceService;
