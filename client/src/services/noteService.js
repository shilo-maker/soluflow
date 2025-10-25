import api from './api';

const noteService = {
  // Get notes for a specific song in a service
  getNotes: async (songId, serviceId) => {
    const response = await api.get(`/notes/${songId}/${serviceId}`);
    return response.data;
  },

  // Add a new inline note
  addNote: async (songId, serviceId, lineNumber, text) => {
    const response = await api.post('/notes', {
      songId,
      serviceId,
      action: 'add',
      noteData: { lineNumber, text }
    });
    return response.data;
  },

  // Update an existing inline note
  updateNote: async (songId, serviceId, noteId, text, lineNumber) => {
    const response = await api.post('/notes', {
      songId,
      serviceId,
      action: 'update',
      noteData: { id: noteId, text, lineNumber }
    });
    return response.data;
  },

  // Delete an inline note
  deleteNote: async (songId, serviceId, noteId) => {
    const response = await api.post('/notes', {
      songId,
      serviceId,
      action: 'delete',
      noteData: { id: noteId }
    });
    return response.data;
  },

  // Toggle note visibility
  toggleVisibility: async (songId, serviceId) => {
    const response = await api.put(`/notes/${songId}/${serviceId}/toggle`);
    return response.data;
  },

  // Save plain text notes
  saveNotes: async (songId, serviceId, text) => {
    const response = await api.post('/notes', {
      songId,
      serviceId,
      action: 'save',
      noteData: { text }
    });
    return response.data;
  },

  // Legacy method for backward compatibility
  getNote: async (songId, serviceId) => {
    return noteService.getNotes(songId, serviceId);
  }
};

export default noteService;
