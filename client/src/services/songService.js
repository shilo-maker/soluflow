import api from './api';

const songService = {
  // Get all songs
  getAllSongs: async (workspaceId = null) => {
    const params = workspaceId ? { workspace_id: workspaceId } : {};
    const response = await api.get('/songs', { params });
    return response.data;
  },

  // Get single song by ID
  getSongById: async (id) => {
    const response = await api.get(`/songs/${id}`);
    return response.data;
  },

  // Search songs
  searchSongs: async (query, workspaceId = null) => {
    const params = { q: query };
    if (workspaceId) params.workspace_id = workspaceId;
    const response = await api.get('/songs/search', { params });
    return response.data;
  },

  // Create new song
  createSong: async (songData) => {
    const response = await api.post('/songs', songData);
    return response.data;
  },

  // Update song
  updateSong: async (id, songData) => {
    const response = await api.put(`/songs/${id}`, songData);
    return response.data;
  },

  // Delete song
  deleteSong: async (id) => {
    const response = await api.delete(`/songs/${id}`);
    return response.data;
  }
};

export default songService;
