const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllWorkspaces,
  getWorkspaceById,
  createWorkspace,
  switchWorkspace,
  deleteWorkspace,
  generateInvite,
  acceptInvite,
  leaveWorkspace,
  updateMemberRole,
  getWorkspaceMembers,
  removeMember
} = require('../controllers/workspaceController');

// All routes require authentication
router.use(authenticate);

// Get all user's workspaces
router.get('/', getAllWorkspaces);

// Accept invite (must be before /:id routes to avoid conflicts)
router.post('/join/:token', acceptInvite);

// Get specific workspace details
router.get('/:id', getWorkspaceById);

// Create new organization workspace
router.post('/', createWorkspace);

// Switch active workspace
router.put('/:id/switch', switchWorkspace);

// Delete workspace (organization only, admin only)
router.delete('/:id', deleteWorkspace);

// Generate invite link (admin/planner only)
router.post('/:id/invite', generateInvite);

// Leave workspace (cannot leave personal workspace)
router.delete('/:id/leave', leaveWorkspace);

// Update member role (admin only)
router.put('/:id/members/:userId/role', updateMemberRole);

// Remove member from workspace (admin only)
router.delete('/:id/members/:userId', removeMember);

// Get workspace members
router.get('/:id/members', getWorkspaceMembers);

module.exports = router;
