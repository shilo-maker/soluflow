const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getNoteForSongInService,
  createOrUpdateNote,
  toggleNoteVisibility
} = require('../controllers/noteController');

// GET /api/notes/:songId/:serviceId - Get note for a specific song in a service
router.get('/:songId/:serviceId', authenticate, getNoteForSongInService);

// POST /api/notes - Create or update a note
router.post('/', authenticate, createOrUpdateNote);

// PUT /api/notes/:songId/:serviceId/toggle - Toggle note visibility
router.put('/:songId/:serviceId/toggle', authenticate, toggleNoteVisibility);

module.exports = router;
