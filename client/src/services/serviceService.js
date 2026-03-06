import api from './api';
import offlineStorage from '../utils/offlineStorage';
import dataCache from '../utils/dataCache';
import offlineQueue from '../utils/offlineQueue';

// Check if an error is a network/connectivity failure (not a server rejection)
function isNetworkError(error) {
  if (!navigator.onLine) return true;
  // api.js interceptor rejects with { error: 'No response from server' } for network failures
  if (error?.error === 'No response from server') return true;
  if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') return true;
  return false;
}

// Normalize service_songs (snake_case nested objects from API) into flat song objects
// that the frontend expects (title, content, key, etc. at top level)
function normalizeServiceSongs(service) {
  const rawSongs = service.service_songs || service.serviceSongs || service.songs || [];
  service.songs = rawSongs.map(item => {
    const song = item.song || {};
    return {
      id: item.serviceSongId || item.id,
      serviceSongId: item.serviceSongId || item.id,
      song_id: song.id || item.song_id || item.songId || null,
      position: item.position,
      transposition: item.transposition || 0,
      segment_type: item.segment_type || item.segmentType || 'song',
      segment_title: item.segment_title || item.segmentTitle,
      segment_content: item.segment_content || item.segmentContent,
      notes: item.notes,
      title: song.title || item.title || item.segment_title || '',
      content: song.chord_pro_content || song.chordProContent || song.content || '',
      key: song.musical_key || song.musicalKey || song.key || '',
      bpm: song.bpm,
      time_signature: song.time_signature || song.timeSignature,
      authors: song.authors || '',
      listen_url: song.listen_url || song.listenUrl,
    };
  });
  delete service.service_songs;
  delete service.serviceSongs;
  return service;
}

const serviceService = {
  // Get all services for authenticated user's workspace
  getAllServices: async (workspaceId) => {
    try {
      // Use provided workspaceId, or fall back to cached active workspace
      if (!workspaceId) {
        try {
          const cached = localStorage.getItem('soluflow_active_workspace');
          if (cached) workspaceId = JSON.parse(cached).id;
        } catch { /* ignore */ }
      }

      const cacheKey = `services:all:${workspaceId || 'default'}`;
      const cachedData = dataCache.get(cacheKey);
      if (cachedData) return cachedData;

      const params = workspaceId ? { workspaceId } : {};
      const response = await api.get('/services', { params });
      const services = Array.isArray(response.data) ? response.data : response.data.services || [];

      dataCache.set(cacheKey, services);

      // Save to IndexedDB for offline use (non-blocking)
      if (services && services.length > 0) {
        Promise.all(services.map(service =>
          offlineStorage.saveService(service).catch(() => {})
        )).catch(() => {});
      }

      return services;
    } catch (error) {
      // Fallback to IndexedDB on network failure
      console.warn('Network error, trying offline storage:', error.message || error.error);
      const offlineServices = await offlineStorage.getAllServices();
      if (offlineServices && offlineServices.length > 0) {
        console.debug('Returning services from offline storage');
        return offlineServices;
      }
      throw error;
    }
  },

  // Get single service by ID (with full set list)
  getServiceById: async (id) => {
    try {
      const cacheKey = `services:${id}`;
      const cachedData = dataCache.get(cacheKey);
      if (cachedData) return cachedData;

      const response = await api.get(`/services/${id}`);
      const service = normalizeServiceSongs(response.data.service || response.data);

      dataCache.set(cacheKey, service, 15000); // 15s TTL for individual services

      // Save to IndexedDB for offline use (non-blocking)
      if (service) {
        offlineStorage.saveService(service).catch(() => {});
      }

      return service;
    } catch (error) {
      // Fallback to IndexedDB on network failure
      console.warn('Network error, trying offline storage:', error.message || error.error);
      const offlineService = await offlineStorage.getService(id);
      if (offlineService) {
        console.debug('Returning service from offline storage');
        return offlineService;
      }
      throw error;
    }
  },

  // Get service by code (for guest access)
  getServiceByCode: async (code) => {
    const response = await api.get(`/services/code/${code}`);
    return normalizeServiceSongs(response.data.service || response.data);
  },

  // Get service by edit token (for guest edit access)
  getServiceByEditToken: async (editToken) => {
    const response = await api.get(`/services/edit/${editToken}`);
    const service = normalizeServiceSongs(response.data.service || response.data);
    // Preserve guestEditorToken from top-level response (may be snake_case from flowCaseTransform)
    const token = response.data.guestEditorToken || response.data.guest_editor_token;
    if (token) {
      service.guestEditorToken = token;
    }
    return service;
  },

  // Create new service
  createService: async (serviceData) => {
    try {
      const response = await api.post('/services', serviceData);
      dataCache.invalidate('services:');
      const service = response.data.service || response.data;
      offlineStorage.saveService(service).catch(() => {});
      return service;
    } catch (error) {
      if (isNetworkError(error)) {
        // Create optimistic local service
        const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const localService = {
          ...serviceData,
          id: tempId,
          _offline: true,
          _pendingSync: true,
          created_at: new Date().toISOString()
        };
        await offlineStorage.saveService(localService);
        await offlineQueue.enqueue({
          method: 'POST',
          url: '/services',
          data: serviceData,
          tempId
        });
        dataCache.invalidate('services:');
        return localService;
      }
      throw error;
    }
  },

  // Update service
  updateService: async (id, serviceData) => {
    try {
      const response = await api.put(`/services/${id}`, serviceData);
      dataCache.invalidate('services:');
      const service = response.data.service || response.data;
      offlineStorage.saveService(service).catch(() => {});
      return service;
    } catch (error) {
      if (isNetworkError(error)) {
        // Apply optimistic update to IndexedDB
        const existing = await offlineStorage.getService(id).catch(() => null);
        const updated = { ...existing, ...serviceData, id, _pendingSync: true };
        await offlineStorage.saveService(updated);
        await offlineQueue.enqueue({
          method: 'PUT',
          url: `/services/${id}`,
          data: serviceData
        });
        dataCache.invalidate('services:');
        return updated;
      }
      throw error;
    }
  },

  // Delete service
  deleteService: async (id) => {
    try {
      const response = await api.delete(`/services/${id}`);
      dataCache.invalidate('services:');
      offlineStorage.deleteService(id).catch(() => {});
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        await offlineStorage.deleteService(id).catch(() => {});
        await offlineQueue.enqueue({
          method: 'DELETE',
          url: `/services/${id}`
        });
        dataCache.invalidate('services:');
        return { success: true };
      }
      throw error;
    }
  },

  // Add song to service (set list)
  addSongToService: async (serviceId, songData) => {
    try {
      const response = await api.post(`/services/${serviceId}/songs`, songData);
      dataCache.invalidate(`services:${serviceId}`);
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        await offlineQueue.enqueue({
          method: 'POST',
          url: `/services/${serviceId}/songs`,
          data: songData
        });
        dataCache.invalidate(`services:${serviceId}`);
        return { success: true, _offline: true };
      }
      throw error;
    }
  },

  // Update song in service (position, notes, etc.)
  updateServiceSong: async (serviceId, songId, updates) => {
    try {
      const response = await api.put(`/services/${serviceId}/songs/${songId}`, updates);
      dataCache.invalidate(`services:${serviceId}`);
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        await offlineQueue.enqueue({
          method: 'PUT',
          url: `/services/${serviceId}/songs/${songId}`,
          data: updates
        });
        dataCache.invalidate(`services:${serviceId}`);
        return { success: true, _offline: true };
      }
      throw error;
    }
  },

  // Remove song from service
  removeSongFromService: async (serviceId, songId) => {
    try {
      const response = await api.delete(`/services/${serviceId}/songs/${songId}`);
      dataCache.invalidate(`services:${serviceId}`);
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        await offlineQueue.enqueue({
          method: 'DELETE',
          url: `/services/${serviceId}/songs/${songId}`
        });
        dataCache.invalidate(`services:${serviceId}`);
        return { success: true, _offline: true };
      }
      throw error;
    }
  },

  // Update song transposition in service (uses general update endpoint)
  updateSongTransposition: async (serviceId, songId, transposition) => {
    try {
      const response = await api.put(`/services/${serviceId}/songs/${songId}`, {
        transposition
      });
      dataCache.invalidate(`services:${serviceId}`);
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        await offlineQueue.enqueue({
          method: 'PUT',
          url: `/services/${serviceId}/songs/${songId}`,
          data: { transposition }
        });
        dataCache.invalidate(`services:${serviceId}`);
        return { success: true, _offline: true };
      }
      throw error;
    }
  },

  // Get share link for service
  getShareLink: async (serviceId) => {
    const response = await api.get(`/services/${serviceId}/share`);
    return response.data;
  },

  // Accept shared service by code
  acceptSharedService: async (code) => {
    const response = await api.post(`/services/accept/${code}`);
    return response.data;
  },

  // Move service to another workspace
  moveToWorkspace: async (serviceId, targetWorkspaceId) => {
    const response = await api.put(`/services/${serviceId}/move`, {
      target_workspace_id: targetWorkspaceId
    });
    return response.data;
  },

  // Change service leader (admin only)
  changeLeader: async (serviceId, newLeaderId) => {
    const response = await api.put(`/services/${serviceId}/leader`, {
      new_leader_id: newLeaderId
    });
    return response.data;
  },

  // Remove shared service from user's view
  unshareService: async (serviceId) => {
    const response = await api.delete(`/services/${serviceId}/unshare`);
    return response.data;
  }
};

export default serviceService;
