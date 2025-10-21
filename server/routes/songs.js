const express = require('express');
const router = express.Router();
const { authenticate, authenticateOptional } = require('../middleware/auth');
const {
  getAllSongs,
  getSongById,
  searchSongs,
  createSong,
  updateSong,
  deleteSong,
  submitForApproval,
  getPendingApprovals,
  approveSong,
  rejectSong,
  getShareLink,
  getSongByCode,
  acceptSharedSong
} = require('../controllers/songController');

// GET /api/songs - Get all songs (with visibility filtering)
router.get('/', authenticateOptional, getAllSongs);

// GET /api/songs/search?q=query - Search songs (with visibility filtering)
router.get('/search', authenticateOptional, searchSongs);

// GET /api/songs/pending-approvals - Get pending approvals (admin only)
router.get('/pending-approvals', authenticate, getPendingApprovals);

// GET /api/songs/code/:code - Get song by code (for sharing) - MUST come before /:id
router.get('/code/:code', authenticateOptional, getSongByCode);

// POST /api/songs/code/:code/accept - Accept shared song and add to library (authenticated)
router.post('/code/:code/accept', authenticate, acceptSharedSong);

// GET /api/songs/:id - Get single song (with visibility check)
router.get('/:id', authenticateOptional, getSongById);

// GET /api/songs/:id/share - Get share link for song (authenticated, owner or admin)
router.get('/:id/share', authenticate, getShareLink);

// POST /api/songs - Create new song (authenticated)
router.post('/', authenticate, createSong);

// POST /api/songs/:id/submit-approval - Submit song for approval (authenticated)
router.post('/:id/submit-approval', authenticate, submitForApproval);

// POST /api/songs/:id/approve - Approve song (admin only)
router.post('/:id/approve', authenticate, approveSong);

// POST /api/songs/:id/reject - Reject song (admin only)
router.post('/:id/reject', authenticate, rejectSong);

// PUT /api/songs/:id - Update song (authenticated)
router.put('/:id', authenticate, updateSong);

// DELETE /api/songs/:id - Delete song (authenticated)
router.delete('/:id', authenticate, deleteSong);

module.exports = router;
