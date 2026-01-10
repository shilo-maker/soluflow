import api from './api';
import offlineStorage from '../utils/offlineStorage';

const songService = {
  // Get all songs
  getAllSongs: async (workspaceId = null, page = 1, limit = 500) => {
    try {
      const params = { page, limit };
      if (workspaceId) params.workspace_id = workspaceId;
      const response = await api.get('/songs', { params });

      // Handle both paginated response (new) and array response (legacy/offline)
      const songs = response.data.songs || response.data;

      // Save songs to offline storage for future offline use
      if (songs && songs.length > 0) {
        await offlineStorage.saveSongs(songs).catch(err => {
          console.warn('Failed to save songs to offline storage:', err);
        });
      }

      return songs;
    } catch (error) {
      // If network request fails, try to get songs from offline storage
      console.warn('Network request failed, attempting to load from offline storage');
      const offlineSongs = await offlineStorage.getAllSongs();

      if (offlineSongs && offlineSongs.length > 0) {
        console.log('Loaded songs from offline storage');
        return offlineSongs;
      }

      // If no offline data, throw the original error
      throw error;
    }
  },

  // Get single song by ID
  getSongById: async (id) => {
    try {
      const response = await api.get(`/songs/${id}`);

      // Save song to offline storage for future offline use
      if (response.data) {
        await offlineStorage.saveSong(response.data).catch(err => {
          console.warn('Failed to save song to offline storage:', err);
        });
      }

      return response.data;
    } catch (error) {
      // If network request fails, try to get song from offline storage
      console.warn('Network request failed, attempting to load from offline storage');
      const offlineSong = await offlineStorage.getSong(parseInt(id));

      if (offlineSong) {
        console.log('Loaded song from offline storage');
        return offlineSong;
      }

      // If no offline data, throw the original error
      throw error;
    }
  },

  // Search songs
  searchSongs: async (query, workspaceId = null, page = 1, limit = 100) => {
    const params = { q: query, page, limit };
    if (workspaceId) params.workspace_id = workspaceId;
    const response = await api.get('/songs/search', { params });
    // Handle both paginated response (new) and array response (legacy)
    return response.data.songs || response.data;
  },

  // Create new song
  createSong: async (songData) => {
    const response = await api.post('/songs', songData);

    // Save new song to offline storage
    if (response.data) {
      await offlineStorage.saveSong(response.data).catch(err => {
        console.warn('Failed to save new song to offline storage:', err);
      });
    }

    return response.data;
  },

  // Update song
  updateSong: async (id, songData) => {
    const response = await api.put(`/songs/${id}`, songData);

    // Update song in offline storage
    if (response.data) {
      await offlineStorage.saveSong(response.data).catch(err => {
        console.warn('Failed to update song in offline storage:', err);
      });
    }

    return response.data;
  },

  // Delete song
  deleteSong: async (id) => {
    const response = await api.delete(`/songs/${id}`);

    // Delete song from offline storage
    await offlineStorage.deleteSong(parseInt(id)).catch(err => {
      console.warn('Failed to delete song from offline storage:', err);
    });

    return response.data;
  },

  // Get share link for song
  getShareLink: async (id) => {
    const response = await api.get(`/songs/${id}/share`);
    return response.data;
  },

  // Get song by code (for sharing)
  getSongByCode: async (code) => {
    const response = await api.get(`/songs/code/${code}`);
    return response.data;
  },

  // Accept shared song and add to library
  acceptSharedSong: async (code) => {
    const response = await api.post(`/songs/code/${code}/accept`);
    return response.data;
  }
};

export default songService;
