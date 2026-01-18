import api from './api';
import offlineStorage from '../utils/offlineStorage';

const serviceService = {
  // Get all services for authenticated user
  getAllServices: async () => {
    try {
      const response = await api.get('/services');
      const services = response.data;

      // Save to IndexedDB for offline use
      if (services && services.length > 0) {
        for (const service of services) {
          await offlineStorage.saveService(service).catch(err =>
            console.warn('Failed to cache service:', err)
          );
        }
      }

      return services;
    } catch (error) {
      // Fallback to IndexedDB on network failure
      console.warn('Network error, trying offline storage:', error.message);
      const offlineServices = await offlineStorage.getAllServices();
      if (offlineServices && offlineServices.length > 0) {
        console.log('Returning services from offline storage');
        return offlineServices;
      }
      throw error;
    }
  },

  // Get single service by ID (with full set list)
  getServiceById: async (id) => {
    try {
      const response = await api.get(`/services/${id}`);
      const service = response.data;

      // Save to IndexedDB for offline use
      if (service) {
        await offlineStorage.saveService(service).catch(err =>
          console.warn('Failed to cache service:', err)
        );
      }

      return service;
    } catch (error) {
      // Fallback to IndexedDB on network failure
      console.warn('Network error, trying offline storage:', error.message);
      const offlineService = await offlineStorage.getService(parseInt(id, 10));
      if (offlineService) {
        console.log('Returning service from offline storage');
        return offlineService;
      }
      throw error;
    }
  },

  // Get service by code (for guest access)
  getServiceByCode: async (code) => {
    const response = await api.get(`/services/code/${code}`);
    return response.data;
  },

  // Create new service
  createService: async (serviceData) => {
    const response = await api.post('/services', serviceData);
    return response.data;
  },

  // Update service
  updateService: async (id, serviceData) => {
    const response = await api.put(`/services/${id}`, serviceData);
    return response.data;
  },

  // Delete service
  deleteService: async (id) => {
    const response = await api.delete(`/services/${id}`);
    return response.data;
  },

  // Add song to service (set list)
  addSongToService: async (serviceId, songData) => {
    const response = await api.post(`/services/${serviceId}/songs`, songData);
    return response.data;
  },

  // Update song in service (position, notes, etc.)
  updateServiceSong: async (serviceId, songId, updates) => {
    const response = await api.put(`/services/${serviceId}/songs/${songId}`, updates);
    return response.data;
  },

  // Remove song from service
  removeSongFromService: async (serviceId, songId) => {
    const response = await api.delete(`/services/${serviceId}/songs/${songId}`);
    return response.data;
  },

  // Update song transposition in service
  updateSongTransposition: async (serviceId, songId, transposition) => {
    const response = await api.put(`/services/${serviceId}/songs/${songId}/transpose`, {
      transposition
    });
    return response.data;
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
