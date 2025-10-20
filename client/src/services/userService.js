import api from './api';

const userService = {
  // Get all users (admin only)
  getAllUsers: async () => {
    const response = await api.get('/users');
    return response.data;
  },

  // Get single user by ID (admin only)
  getUserById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  // Update user (admin only)
  updateUser: async (id, userData) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  // Delete user (admin only)
  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  }
};

export default userService;
