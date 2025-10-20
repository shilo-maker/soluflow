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
  rejectSong
} = require('../controllers/songController');

// GET /api/songs - Get all songs (with visibility filtering)
router.get('/', authenticateOptional, getAllSongs);

// GET /api/songs/search?q=query - Search songs (with visibility filtering)
router.get('/search', authenticateOptional, searchSongs);

// GET /api/songs/pending-approvals - Get pending approvals (admin only)
router.get('/pending-approvals', authenticate, getPendingApprovals);

// GET /api/songs/:id - Get single song (with visibility check)
router.get('/:id', authenticateOptional, getSongById);

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
