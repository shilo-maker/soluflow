const express = require('express');
const router = express.Router();
const { authenticate, authenticateOptional } = require('../middleware/auth');
const {
  getAllSongs,
  getSongById,
  searchSongs,
  createSong,
  updateSong,
  deleteSong
} = require('../controllers/songController');

// GET /api/songs - Get all songs (public for guests)
router.get('/', authenticateOptional, getAllSongs);

// GET /api/songs/search?q=query - Search songs (public for guests)
router.get('/search', authenticateOptional, searchSongs);

// GET /api/songs/:id - Get single song (public for guests)
router.get('/:id', authenticateOptional, getSongById);

// POST /api/songs - Create new song (authenticated)
router.post('/', authenticate, createSong);

// PUT /api/songs/:id - Update song (authenticated)
router.put('/:id', authenticate, updateSong);

// DELETE /api/songs/:id - Delete song (authenticated)
router.delete('/:id', authenticate, deleteSong);

module.exports = router;
