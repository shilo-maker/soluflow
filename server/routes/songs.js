const express = require('express');
const router = express.Router();
const { authenticate, authenticateOptional } = require('../middleware/auth');
const { songValidation } = require('../middleware/validation');
const { createSongLimiter } = require('../middleware/rateLimiter');
const { songCache, cacheMiddleware } = require('../middleware/cache');
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

// Cache key generators
const allSongsKey = (req) => `songs:all:${req.user?.id || 'guest'}`;
const songByIdKey = (req) => `songs:id:${req.params.id}:${req.user?.id || 'guest'}`;
const searchKey = (req) => `songs:search:${req.query.q || ''}:${req.user?.id || 'guest'}`;
const songByCodeKey = (req) => `songs:code:${req.params.code}:${req.user?.id || 'guest'}`;

// GET /api/songs - Get all songs (with visibility filtering)
router.get('/',
  authenticateOptional,
  cacheMiddleware(songCache, allSongsKey),
  getAllSongs
);

// GET /api/songs/search?q=query - Search songs (with visibility filtering)
router.get('/search',
  authenticateOptional,
  cacheMiddleware(songCache, searchKey),
  searchSongs
);

// GET /api/songs/pending-approvals - Get pending approvals (admin only)
router.get('/pending-approvals', authenticate, getPendingApprovals);

// GET /api/songs/code/:code - Get song by code (for sharing) - MUST come before /:id
router.get('/code/:code',
  authenticateOptional,
  cacheMiddleware(songCache, songByCodeKey),
  getSongByCode
);

// POST /api/songs/code/:code/accept - Accept shared song and add to library (authenticated)
router.post('/code/:code/accept', authenticate, acceptSharedSong);

// GET /api/songs/:id - Get single song (with visibility check)
router.get('/:id',
  authenticateOptional,
  songValidation.getSongById,
  cacheMiddleware(songCache, songByIdKey),
  getSongById
);

// GET /api/songs/:id/share - Get share link for song (authenticated, owner or admin)
router.get('/:id/share', authenticate, songValidation.getSongById, getShareLink);

// POST /api/songs - Create new song (authenticated, rate limited)
router.post('/', authenticate, createSongLimiter, songValidation.createSong, createSong);

// POST /api/songs/:id/submit-approval - Submit song for approval (authenticated)
router.post('/:id/submit-approval', authenticate, songValidation.getSongById, submitForApproval);

// POST /api/songs/:id/approve - Approve song (admin only)
router.post('/:id/approve', authenticate, songValidation.getSongById, approveSong);

// POST /api/songs/:id/reject - Reject song (admin only)
router.post('/:id/reject', authenticate, songValidation.getSongById, rejectSong);

// PUT /api/songs/:id - Update song (authenticated)
router.put('/:id', authenticate, songValidation.updateSong, updateSong);

// DELETE /api/songs/:id - Delete song (authenticated)
router.delete('/:id', authenticate, songValidation.deleteSong, deleteSong);

module.exports = router;
