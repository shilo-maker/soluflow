const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllWorkspaces,
  getWorkspaceById,
  createWorkspace,
  renameWorkspace,
  switchWorkspace,
  deleteWorkspace,
  generateInvite,
  acceptInvite,
  leaveWorkspace,
  updateMemberRole,
  getWorkspaceMembers,
  removeMember,
  searchUserByEmail,
  sendMemberInvite,
  listMemberInvites,
  revokeMemberInvite,
  getMemberInviteByToken,
  respondToMemberInvite,
  getMyInvites
} = require('../controllers/workspaceController');

// All routes require authentication
router.use(authenticate);

// Get all user's workspaces
router.get('/', getAllWorkspaces);

// Accept invite (must be before /:id routes to avoid conflicts)
router.post('/join/:token', acceptInvite);

// Get pending invites for the logged-in user (must be before /:id routes)
router.get('/my-invites', getMyInvites);

// Member invite by token routes (must be before /:id routes)
router.get('/member-invite/:token', getMemberInviteByToken);
router.post('/member-invite/:token/respond', respondToMemberInvite);

// Get specific workspace details
router.get('/:id', getWorkspaceById);

// Create new organization workspace
router.post('/', createWorkspace);

// Rename workspace (admin only)
router.put('/:id', renameWorkspace);

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

// Member invite routes (email-based)
router.get('/:id/search-user', searchUserByEmail);
router.post('/:id/member-invites', sendMemberInvite);
router.get('/:id/member-invites', listMemberInvites);
router.delete('/:id/member-invites/:inviteId', revokeMemberInvite);

module.exports = router;
