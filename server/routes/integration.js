const express = require('express');
const router = express.Router();
const { authenticate, authenticateOptional } = require('../middleware/auth');
const {
  searchSongsForIntegration,
  getSongForIntegration,
  createServiceFromIntegration,
  getWorkspacesForIntegration,
  integrationHealthCheck
} = require('../controllers/integrationController');

/**
 * Integration API Routes
 * For use by external apps like SoluEvents
 */

// Health check - no auth required
router.get('/health', integrationHealthCheck);

// Search songs - optional auth (returns public songs for non-authenticated, all accessible songs for authenticated)
router.get('/songs/search', authenticateOptional, searchSongsForIntegration);

// Get specific song - optional auth (public songs accessible without auth)
router.get('/songs/:id', authenticateOptional, getSongForIntegration);

// Get user's workspaces - requires auth
router.get('/workspaces', authenticate, getWorkspacesForIntegration);

// Create service from external app - requires auth
router.post('/services', authenticate, createServiceFromIntegration);

module.exports = router;
