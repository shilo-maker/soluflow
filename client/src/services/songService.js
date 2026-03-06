import api from './api';
import offlineStorage from '../utils/offlineStorage';
import dataCache from '../utils/dataCache';
import offlineQueue from '../utils/offlineQueue';

function isNetworkError(error) {
  if (!navigator.onLine) return true;
  if (error?.error === 'No response from server') return true;
  if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') return true;
  return false;
}

const songService = {
  // Get all songs (with in-memory cache for instant revisits)
  getAllSongs: async (workspaceId = null, page = 1, limit = 500) => {
    const cacheKey = `songs:${workspaceId || 'all'}:${page}:${limit}`;
    const cached = dataCache.get(cacheKey);
    if (cached) return cached;

    try {
      const params = { page, limit };
      if (workspaceId) params.workspace_id = workspaceId;
      const response = await api.get('/songs', { params });

      // Handle both paginated response (new) and array response (legacy/offline)
      const songs = response.data.songs || response.data;

      // Cache in memory for instant revisits
      dataCache.set(cacheKey, songs);

      // Save songs to offline storage for future offline use
      if (songs && songs.length > 0) {
        offlineStorage.saveSongs(songs).catch(err => {
          console.warn('Failed to save songs to offline storage:', err);
        });
      }

      return songs;
    } catch (error) {
      // If network request fails, try to get songs from offline storage
      console.warn('Network request failed, attempting to load from offline storage');
      const offlineSongs = await offlineStorage.getAllSongs();

      if (offlineSongs && offlineSongs.length > 0) {
        console.debug('Loaded songs from offline storage');
        return offlineSongs;
      }

      // If offline with no cached data, return empty array instead of error
      if (isNetworkError(error)) return [];

      throw error;
    }
  },

  // Get single song by ID
  getSongById: async (id) => {
    try {
      const response = await api.get(`/songs/${id}`);
      const song = response.data.song || response.data;

      // Save song to offline storage for future offline use
      if (song) {
        offlineStorage.saveSong(song).catch(err => {
          console.warn('Failed to save song to offline storage:', err);
        });
      }

      return song;
    } catch (error) {
      // If network request fails, try to get song from offline storage
      console.warn('Network request failed, attempting to load from offline storage');
      const offlineSong = await offlineStorage.getSong(id);

      if (offlineSong) {
        console.debug('Loaded song from offline storage');
        return offlineSong;
      }

      // If no offline data, throw the original error
      throw error;
    }
  },

  // Search songs
  searchSongs: async (query, workspaceId = null, page = 1, limit = 100) => {
    try {
      const params = { q: query, page, limit };
      if (workspaceId) params.workspace_id = workspaceId;
      const response = await api.get('/songs/search', { params });
      return response.data.songs || response.data;
    } catch (error) {
      // Offline fallback: filter from IndexedDB
      if (isNetworkError(error)) {
        const allSongs = await offlineStorage.getAllSongs();
        if (allSongs && allSongs.length > 0) {
          const q = query.toLowerCase();
          return allSongs.filter(s =>
            (s.title && s.title.toLowerCase().includes(q)) ||
            (s.authors && s.authors.toLowerCase().includes(q))
          );
        }
      }
      throw error;
    }
  },

  // Create new song
  createSong: async (songData) => {
    try {
      const response = await api.post('/songs', songData);
      const song = response.data.song || response.data;
      dataCache.invalidate('songs:');
      if (song) offlineStorage.saveSong(song).catch(() => {});
      return song;
    } catch (error) {
      if (isNetworkError(error)) {
        const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const localSong = {
          ...songData,
          id: tempId,
          _offline: true,
          _pendingSync: true,
          created_at: new Date().toISOString()
        };
        await offlineStorage.saveSong(localSong);
        await offlineQueue.enqueue({ method: 'POST', url: '/songs', data: songData, tempId });
        dataCache.invalidate('songs:');
        return localSong;
      }
      throw error;
    }
  },

  // Update song
  updateSong: async (id, songData) => {
    try {
      const response = await api.put(`/songs/${id}`, songData);
      const song = response.data.song || response.data;
      dataCache.invalidate('songs:');
      if (song) offlineStorage.saveSong(song).catch(() => {});
      return song;
    } catch (error) {
      if (isNetworkError(error)) {
        const existing = await offlineStorage.getSong(id).catch(() => null);
        const updated = { ...existing, ...songData, id, _pendingSync: true };
        await offlineStorage.saveSong(updated);
        await offlineQueue.enqueue({ method: 'PUT', url: `/songs/${id}`, data: songData });
        dataCache.invalidate('songs:');
        return updated;
      }
      throw error;
    }
  },

  // Delete song
  deleteSong: async (id) => {
    try {
      const response = await api.delete(`/songs/${id}`);
      dataCache.invalidate('songs:');
      offlineStorage.deleteSong(id).catch(() => {});
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        await offlineStorage.deleteSong(id).catch(() => {});
        await offlineQueue.enqueue({ method: 'DELETE', url: `/songs/${id}` });
        dataCache.invalidate('songs:');
        return { success: true };
      }
      throw error;
    }
  },

  // Get share link for song
  getShareLink: async (id) => {
    const response = await api.get(`/songs/${id}/share`);
    return response.data;
  },

  // Get song by code (for sharing)
  getSongByCode: async (code) => {
    const response = await api.get(`/songs/code/${code}`);
    return response.data.song || response.data;
  },

  // Accept shared song and add to library
  acceptSharedSong: async (code) => {
    const response = await api.post(`/songs/code/${code}/accept`);
    return response.data;
  }
};

export default songService;
