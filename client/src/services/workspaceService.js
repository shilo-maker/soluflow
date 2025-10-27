import api from './api';

const workspaceService = {
  // Get all user's workspaces
  getAllWorkspaces: async () => {
    const response = await api.get('/workspaces');
    return response.data;
  },

  // Get specific workspace details
  getWorkspaceById: async (id) => {
    const response = await api.get(`/workspaces/${id}`);
    return response.data;
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

  // Get workspace members
  getWorkspaceMembers: async (workspaceId) => {
    const response = await api.get(`/workspaces/${workspaceId}/members`);
    return response.data;
  }
};

export default workspaceService;
