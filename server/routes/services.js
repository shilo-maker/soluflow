const express = require('express');
const router = express.Router();
const { authenticate, authenticateOptional } = require('../middleware/auth');
const {
  getAllServices,
  getServiceById,
  getServiceByCode,
  createService,
  updateService,
  deleteService,
  addSongToService,
  updateServiceSong,
  removeSongFromService,
  updateSongTransposition,
  acceptSharedService,
  getShareLink,
  moveToWorkspace
} = require('../controllers/serviceController');

// GET /api/services - Get all services (authenticated)
router.get('/', authenticate, getAllServices);

// GET /api/services/code/:code - Get service by code (optional auth for already-added detection)
router.get('/code/:code', authenticateOptional, getServiceByCode);

// GET /api/services/:id - Get single service (authenticated)
router.get('/:id', authenticate, getServiceById);

// POST /api/services - Create new service (authenticated)
router.post('/', authenticate, createService);

// PUT /api/services/:id - Update service (authenticated)
router.put('/:id', authenticate, updateService);

// DELETE /api/services/:id - Delete service (authenticated)
router.delete('/:id', authenticate, deleteService);

// POST /api/services/:id/songs - Add song to service (authenticated)
router.post('/:id/songs', authenticate, addSongToService);

// PUT /api/services/:id/songs/:songId - Update service song (authenticated)
router.put('/:id/songs/:songId', authenticate, updateServiceSong);

// PUT /api/services/:id/songs/:songId/transpose - Update song transposition (authenticated)
router.put('/:id/songs/:songId/transpose', authenticate, updateSongTransposition);

// DELETE /api/services/:id/songs/:songId - Remove song from service (authenticated)
router.delete('/:id/songs/:songId', authenticate, removeSongFromService);

// GET /api/services/:id/share - Get share link for service (authenticated)
router.get('/:id/share', authenticate, getShareLink);

// POST /api/services/accept/:code - Accept shared service (authenticated)
router.post('/accept/:code', authenticate, acceptSharedService);

// PUT /api/services/:id/move - Move service to another workspace (authenticated)
router.put('/:id/move', authenticate, moveToWorkspace);

module.exports = router;
