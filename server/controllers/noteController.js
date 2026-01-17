const Note = require('../models/Note');
const { Service, WorkspaceMember, SharedService } = require('../models');
const { v4: uuidv4 } = require('uuid');

// Helper: Check if user has access to a service
const verifyServiceAccess = async (userId, serviceId) => {
  const service = await Service.findByPk(serviceId);
  if (!service) {
    return { hasAccess: false, error: 'Service not found' };
  }

  // Check if user is a member of the service's workspace
  const workspaceMembership = await WorkspaceMember.findOne({
    where: {
      workspace_id: service.workspace_id,
      user_id: userId
    }
  });

  if (workspaceMembership) {
    return { hasAccess: true };
  }

  // Check if service has been shared with user
  const sharedService = await SharedService.findOne({
    where: {
      service_id: serviceId,
      user_id: userId
    }
  });

  if (sharedService) {
    return { hasAccess: true };
  }

  return { hasAccess: false, error: 'You do not have access to this service' };
};

// GET note for a specific song in a service
const getNoteForSongInService = async (req, res) => {
  try {
    const { songId, serviceId } = req.params;

    // Check if user is a guest
    if (req.user.type === 'guest') {
      console.log('Guest user attempted to access notes');
      return res.status(403).json({ error: 'Notes are not available for guest users' });
    }

    const userId = req.user.id;

    // Verify user has access to this service
    const accessCheck = await verifyServiceAccess(userId, serviceId);
    if (!accessCheck.hasAccess) {
      return res.status(403).json({ error: accessCheck.error });
    }

    console.log('Fetching note - userId:', userId, 'songId:', songId, 'serviceId:', serviceId);

    const note = await Note.findOne({
      where: {
        user_id: userId,
        song_id: songId,
        service_id: serviceId
      }
    });

    console.log('Note found:', note ? 'yes' : 'no');

    if (!note) {
      console.log('No note found, returning empty notes array');
      return res.json({ content: { notes: [] }, is_visible: true });
    }

    console.log('Returning note with id:', note.id);

    // Handle migration from old format (string) to new format (JSON)
    let content = note.content;
    if (typeof content === 'string') {
      console.log('Migrating old note format to new format on read');
      content = { notes: [] };
    }

    // Ensure content is properly structured
    if (!content || typeof content !== 'object') {
      content = { notes: [] };
    }

    // If content has plain text, keep it as is
    // If content has notes array, keep it as is
    // Otherwise, default to empty notes array
    if (!content.text && !Array.isArray(content.notes)) {
      content = { notes: [] };
    }

    res.json({
      ...note.toJSON(),
      content: content
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
};

// Create or update inline notes
const createOrUpdateNote = async (req, res) => {
  try {
    // Check if user is a guest
    if (req.user.type === 'guest') {
      console.log('Guest user attempted to save notes');
      return res.status(403).json({ error: 'Notes are not available for guest users' });
    }

    const { songId, serviceId, action, noteData } = req.body;
    const userId = req.user.id;

    if (!songId || !serviceId) {
      return res.status(400).json({ error: 'Song ID and Service ID are required' });
    }

    // Verify user has access to this service
    const accessCheck = await verifyServiceAccess(userId, serviceId);
    if (!accessCheck.hasAccess) {
      return res.status(403).json({ error: accessCheck.error });
    }

    // Find existing note record
    let noteRecord = await Note.findOne({
      where: {
        user_id: userId,
        song_id: songId,
        service_id: serviceId
      }
    });

    // Initialize content structure if no record exists
    if (!noteRecord) {
      noteRecord = await Note.create({
        user_id: userId,
        song_id: songId,
        service_id: serviceId,
        content: { notes: [] },
        is_visible: true
      });
    }

    let content = noteRecord.content;

    // Handle migration from old format (string) to new format (JSON)
    if (typeof content === 'string') {
      console.log('Migrating old note format to new format');
      content = { notes: [] };
    }

    // Ensure content is an object
    if (!content || typeof content !== 'object') {
      content = { notes: [] };
    }

    // Ensure content.notes is an array
    if (!Array.isArray(content.notes)) {
      content.notes = [];
    }

    // Handle different actions
    switch (action) {
      case 'add':
        // Add new inline note
        if (!noteData || noteData.lineNumber === undefined || !noteData.text) {
          return res.status(400).json({ error: 'Line number and text are required' });
        }
        const newNote = {
          id: uuidv4(),
          lineNumber: noteData.lineNumber,
          text: noteData.text,
          timestamp: new Date().toISOString()
        };
        content.notes.push(newNote);
        break;

      case 'update':
        // Update existing inline note
        if (!noteData || !noteData.id) {
          return res.status(400).json({ error: 'Note ID is required' });
        }
        const noteIndex = content.notes.findIndex(n => n.id === noteData.id);
        if (noteIndex === -1) {
          return res.status(404).json({ error: 'Note not found' });
        }
        content.notes[noteIndex] = {
          ...content.notes[noteIndex],
          text: noteData.text,
          lineNumber: noteData.lineNumber !== undefined ? noteData.lineNumber : content.notes[noteIndex].lineNumber,
          timestamp: new Date().toISOString()
        };
        break;

      case 'delete':
        // Delete inline note
        if (!noteData || !noteData.id) {
          return res.status(400).json({ error: 'Note ID is required' });
        }
        content.notes = content.notes.filter(n => n.id !== noteData.id);
        break;

      case 'save':
        // Save plain text notes
        if (noteData && noteData.text !== undefined) {
          content = { text: noteData.text };
        } else {
          return res.status(400).json({ error: 'Text is required' });
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid action. Use: add, update, delete, or save' });
    }

    // Save updated content
    noteRecord.content = content;
    await noteRecord.save();

    return res.json(noteRecord);
  } catch (error) {
    console.error('Error creating/updating note:', error);
    res.status(500).json({ error: 'Failed to save note' });
  }
};

// Toggle note visibility
const toggleNoteVisibility = async (req, res) => {
  try {
    const { songId, serviceId } = req.params;
    const userId = req.user.id;

    // Verify user has access to this service
    const accessCheck = await verifyServiceAccess(userId, serviceId);
    if (!accessCheck.hasAccess) {
      return res.status(403).json({ error: accessCheck.error });
    }

    const note = await Note.findOne({
      where: {
        user_id: userId,
        song_id: songId,
        service_id: serviceId
      }
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    note.is_visible = !note.is_visible;
    await note.save();

    res.json(note);
  } catch (error) {
    console.error('Error toggling visibility:', error);
    res.status(500).json({ error: 'Failed to toggle visibility' });
  }
};

module.exports = {
  getNoteForSongInService,
  createOrUpdateNote,
  toggleNoteVisibility
};
