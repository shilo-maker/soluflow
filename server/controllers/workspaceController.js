const { User, Workspace, WorkspaceMember, WorkspaceInvitation, Service, ServiceSong, SongWorkspace } = require('../models');
const { sequelize } = require('../config/database');
const crypto = require('crypto');
const { Op } = require('sequelize');

// GET /api/workspaces - Get all user's workspaces
const getAllWorkspaces = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[GetWorkspaces] User ${userId} requesting workspaces, active_workspace_id: ${req.user.active_workspace_id}`);

    // Get all workspaces the user is a member of
    const workspaces = await Workspace.findAll({
      include: [{
        model: WorkspaceMember,
        as: 'members',
        where: { user_id: userId },
        required: true,
        attributes: ['role', 'joined_at']
      }],
      order: [['created_at', 'ASC']]
    });

    console.log(`[GetWorkspaces] Found ${workspaces.length} workspaces for user ${userId}`);

    // Transform the response to include user's role and flatten structure
    const workspacesWithRole = workspaces.map(ws => {
      const wsData = ws.toJSON();
      const isActive = req.user.active_workspace_id === wsData.id;
      console.log(`[GetWorkspaces] Workspace ${wsData.id} (${wsData.name}): is_active=${isActive}`);
      return {
        id: wsData.id,
        name: wsData.name,
        slug: wsData.slug,
        workspace_type: wsData.workspace_type,
        created_at: wsData.created_at,
        role: wsData.members[0].role,
        joined_at: wsData.members[0].joined_at,
        is_active: isActive
      };
    });

    res.json(workspacesWithRole);
  } catch (error) {
    console.error('Get all workspaces error:', error);
    res.status(500).json({ error: 'Failed to retrieve workspaces' });
  }
};

// GET /api/workspaces/:id - Get specific workspace details
const getWorkspaceById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get workspace with members
    const workspace = await Workspace.findByPk(id, {
      include: [{
        model: WorkspaceMember,
        as: 'members',
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }]
      }]
    });

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is a member of this workspace
    const userMembership = workspace.members.find(m => m.user_id === userId);
    if (!userMembership) {
      return res.status(403).json({ error: 'You are not a member of this workspace' });
    }

    // Transform response
    const wsData = workspace.toJSON();
    const response = {
      id: wsData.id,
      name: wsData.name,
      slug: wsData.slug,
      workspace_type: wsData.workspace_type,
      created_at: wsData.created_at,
      role: userMembership.role,  // Current user's workspace role
      is_active: req.user.active_workspace_id === wsData.id,
      members: wsData.members.map(m => ({
        id: m.user.id,
        username: m.user.username,
        email: m.user.email,
        role: m.role,
        joined_at: m.joined_at
      }))
    };

    res.json(response);
  } catch (error) {
    console.error('Get workspace by ID error:', error);
    res.status(500).json({ error: 'Failed to retrieve workspace' });
  }
};

// POST /api/workspaces - Create new organization workspace
const createWorkspace = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    // Check how many workspaces the user is already in
    const memberCount = await WorkspaceMember.count({
      where: { user_id: userId }
    });

    if (memberCount >= 4) {
      return res.status(403).json({
        error: 'Maximum workspace limit reached',
        message: 'You can be a member of maximum 4 workspaces (1 personal + 3 organization)'
      });
    }

    // Check how many organization workspaces the user has
    const orgWorkspaces = await Workspace.findAll({
      where: { workspace_type: 'organization' },
      include: [{
        model: WorkspaceMember,
        as: 'members',
        where: { user_id: userId },
        required: true
      }]
    });

    if (orgWorkspaces.length >= 3) {
      return res.status(403).json({
        error: 'Maximum organization workspace limit reached',
        message: 'You can create/join maximum 3 organization workspaces'
      });
    }

    // Generate unique slug
    const baseSlug = name.toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);

    const slug = `${baseSlug}-${Date.now()}`;

    // Create workspace
    const workspace = await Workspace.create({
      name: name.trim(),
      slug,
      workspace_type: 'organization'
    });

    // Add creator as admin member
    await WorkspaceMember.create({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'admin'
    });

    res.status(201).json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      workspace_type: workspace.workspace_type,
      created_at: workspace.created_at,
      role: 'admin',
      is_active: false
    });
  } catch (error) {
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
};

// PUT /api/workspaces/:id/switch - Switch active workspace
const switchWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if workspace exists
    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if user is a member of this workspace
    const membership = await WorkspaceMember.findOne({
      where: {
        workspace_id: id,
        user_id: userId
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this workspace' });
    }

    // Update user's active workspace
    await User.update(
      { active_workspace_id: id },
      { where: { id: userId } }
    );

    res.json({
      message: 'Active workspace switched successfully',
      active_workspace_id: id,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        workspace_type: workspace.workspace_type
      }
    });
  } catch (error) {
    console.error('Switch workspace error:', error);
    res.status(500).json({ error: 'Failed to switch workspace' });
  }
};

// DELETE /api/workspaces/:id - Delete workspace (organization only)
const deleteWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get workspace using raw SQL to avoid loading associations
    const workspaces = await sequelize.query(
      `SELECT id, name, workspace_type FROM workspaces WHERE id = $1`,
      {
        bind: [id],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!workspaces || workspaces.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const workspace = workspaces[0];

    // Cannot delete personal workspaces
    if (workspace.workspace_type === 'personal') {
      return res.status(403).json({
        error: 'Cannot delete personal workspace',
        message: 'Personal workspaces cannot be deleted'
      });
    }

    // Check if user is admin of this workspace using raw SQL
    const memberships = await sequelize.query(
      `SELECT id FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2 AND role = 'admin'`,
      {
        bind: [id, userId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!memberships || memberships.length === 0) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Only workspace admins can delete workspaces'
      });
    }

    // Start transaction for all deletions and updates
    const transaction = await sequelize.transaction();

    try {
      // 1. Get all members who had this as active workspace (before we delete anything)
      const affectedUserIds = await sequelize.query(
        `SELECT id FROM users WHERE active_workspace_id = $1`,
        {
          bind: [id],
          transaction,
          type: sequelize.QueryTypes.SELECT
        }
      );

      // 2. Delete all related data using raw SQL to completely avoid Sequelize ORM

      // Delete service songs (via services in this workspace)
      await sequelize.query(
        `DELETE FROM service_songs
         WHERE service_id IN (SELECT id FROM services WHERE workspace_id = $1)`,
        { bind: [id], transaction, type: sequelize.QueryTypes.DELETE }
      );

      // Delete services
      await sequelize.query(
        `DELETE FROM services WHERE workspace_id = $1`,
        { bind: [id], transaction, type: sequelize.QueryTypes.DELETE }
      );

      // Delete song-workspace associations
      await sequelize.query(
        `DELETE FROM song_workspaces WHERE workspace_id = $1`,
        { bind: [id], transaction, type: sequelize.QueryTypes.DELETE }
      );

      // Delete workspace invitations
      await sequelize.query(
        `DELETE FROM workspace_invitations WHERE workspace_id = $1`,
        { bind: [id], transaction, type: sequelize.QueryTypes.DELETE }
      );

      // Delete workspace members
      await sequelize.query(
        `DELETE FROM workspace_members WHERE workspace_id = $1`,
        { bind: [id], transaction, type: sequelize.QueryTypes.DELETE }
      );

      // 8. Now update affected users to point to their personal workspace
      for (const userRow of affectedUserIds) {
        const personalWorkspaces = await sequelize.query(
          `SELECT w.id FROM workspaces w
           INNER JOIN workspace_members wm ON w.id = wm.workspace_id
           WHERE w.workspace_type = 'personal' AND wm.user_id = $1
           LIMIT 1`,
          {
            bind: [userRow.id],
            transaction,
            type: sequelize.QueryTypes.SELECT
          }
        );

        if (personalWorkspaces && personalWorkspaces.length > 0) {
          await sequelize.query(
            `UPDATE users SET active_workspace_id = $1 WHERE id = $2`,
            {
              bind: [personalWorkspaces[0].id, userRow.id],
              transaction,
              type: sequelize.QueryTypes.UPDATE
            }
          );
        }
      }

      // 9. Finally delete the workspace using raw SQL to avoid Sequelize cascades
      await sequelize.query(
        `DELETE FROM workspaces WHERE id = $1`,
        {
          bind: [id],
          transaction,
          type: sequelize.QueryTypes.DELETE
        }
      );

      await transaction.commit();

      res.json({
        message: 'Workspace deleted successfully',
        affected_users: affectedUserIds.length
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Delete workspace error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to delete workspace',
      details: error.message,
      type: error.name
    });
  }
};

// POST /api/workspaces/:id/invite - Generate invite link
const generateInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { expiresInDays = 7, maxUses = 10 } = req.body;

    // Get workspace
    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Cannot invite to personal workspaces
    if (workspace.workspace_type === 'personal') {
      return res.status(403).json({
        error: 'Cannot invite to personal workspace',
        message: 'Personal workspaces cannot have invited members'
      });
    }

    // Check if user is admin or planner of this workspace
    const membership = await WorkspaceMember.findOne({
      where: {
        workspace_id: id,
        user_id: userId,
        role: { [Op.in]: ['admin', 'planner'] }
      }
    });

    if (!membership) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Only admins and planners can generate invite links'
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create invitation
    const invitation = await WorkspaceInvitation.create({
      workspace_id: id,
      token,
      created_by: userId,
      expires_at: expiresAt,
      max_uses: maxUses,
      usage_count: 0
    });

    // Construct the full invite link
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3001';
    const inviteLink = `${baseUrl}/workspace/invite/${invitation.token}`;

    res.status(201).json({
      token: invitation.token,
      inviteLink: inviteLink,
      workspace: {
        id: workspace.id,
        name: workspace.name
      },
      expires_at: invitation.expires_at,
      created_by: userId
    });
  } catch (error) {
    console.error('Generate invite error:', error);
    res.status(500).json({ error: 'Failed to generate invite link' });
  }
};

// POST /api/workspaces/join/:token - Accept invite
const acceptInvite = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.id;

    // Find invitation
    const invitation = await WorkspaceInvitation.findOne({
      where: { token },
      include: [{
        model: Workspace,
        as: 'workspace'
      }]
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    // Check if invitation is expired
    if (new Date() > invitation.expires_at) {
      return res.status(410).json({
        error: 'Invite expired',
        message: 'This invite link has expired'
      });
    }

    // Check if invitation has reached max uses
    if (invitation.usage_count >= invitation.max_uses) {
      return res.status(410).json({
        error: 'Invite limit reached',
        message: 'This invite link has reached its maximum number of uses'
      });
    }

    const workspace = invitation.workspace;

    // Check if user is already a member
    const existingMembership = await WorkspaceMember.findOne({
      where: {
        workspace_id: workspace.id,
        user_id: userId
      }
    });

    if (existingMembership) {
      return res.status(409).json({
        error: 'Already a member',
        message: 'You are already a member of this workspace'
      });
    }

    // Check workspace limit
    const memberCount = await WorkspaceMember.count({
      where: { user_id: userId }
    });

    if (memberCount >= 4) {
      return res.status(403).json({
        error: 'Maximum workspace limit reached',
        message: 'You can be a member of maximum 4 workspaces. Leave a workspace to join this one.'
      });
    }

    // Add user as member
    const membership = await WorkspaceMember.create({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'member'
    });

    // Increment usage count
    invitation.usage_count += 1;
    await invitation.save();

    // Delete the invitation if it has reached max uses
    if (invitation.usage_count >= invitation.max_uses) {
      await invitation.destroy();
    }

    res.status(201).json({
      message: 'Successfully joined workspace',
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        workspace_type: workspace.workspace_type,
        role: membership.role,
        joined_at: membership.joined_at
      }
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
};

// DELETE /api/workspaces/:id/leave - Leave workspace
const leaveWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get workspace
    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Cannot leave personal workspace
    if (workspace.workspace_type === 'personal') {
      return res.status(403).json({
        error: 'Cannot leave personal workspace',
        message: 'You cannot leave your personal workspace'
      });
    }

    // Check if user is a member
    const membership = await WorkspaceMember.findOne({
      where: {
        workspace_id: id,
        user_id: userId
      }
    });

    if (!membership) {
      return res.status(404).json({ error: 'You are not a member of this workspace' });
    }

    // If this is the active workspace, switch to personal workspace first
    if (req.user.active_workspace_id === parseInt(id)) {
      const personalWorkspace = await Workspace.findOne({
        where: { workspace_type: 'personal' },
        include: [{
          model: WorkspaceMember,
          as: 'members',
          where: { user_id: userId },
          required: true
        }]
      });

      if (personalWorkspace) {
        await User.update(
          { active_workspace_id: personalWorkspace.id },
          { where: { id: userId } }
        );
      }
    }

    // Remove membership
    await membership.destroy();

    res.json({
      message: 'Successfully left workspace',
      workspace_id: id
    });
  } catch (error) {
    console.error('Leave workspace error:', error);
    res.status(500).json({ error: 'Failed to leave workspace' });
  }
};

// PUT /api/workspaces/:id/members/:userId/role - Update member role (admin only)
const updateMemberRole = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    const requestingUserId = req.user.id;

    // Validate role
    const validRoles = ['admin', 'planner', 'leader', 'member'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: `Role must be one of: ${validRoles.join(', ')}`
      });
    }

    // Get workspace
    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Cannot change roles in personal workspaces
    if (workspace.workspace_type === 'personal') {
      return res.status(403).json({
        error: 'Cannot change roles in personal workspace'
      });
    }

    // Check if requesting user is admin of this workspace
    const requestingMembership = await WorkspaceMember.findOne({
      where: {
        workspace_id: id,
        user_id: requestingUserId,
        role: 'admin'
      }
    });

    if (!requestingMembership) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Only workspace admins can change member roles'
      });
    }

    // Get the target member
    const targetMembership = await WorkspaceMember.findOne({
      where: {
        workspace_id: id,
        user_id: userId
      }
    });

    if (!targetMembership) {
      return res.status(404).json({
        error: 'Member not found',
        message: 'User is not a member of this workspace'
      });
    }

    // Prevent changing your own role
    if (requestingUserId === parseInt(userId)) {
      return res.status(403).json({
        error: 'Cannot change your own role'
      });
    }

    // Update the role
    await targetMembership.update({ role });

    res.json({
      message: 'Member role updated successfully',
      user_id: userId,
      workspace_id: id,
      new_role: role
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
};

// GET /api/workspaces/:id/members - Get all workspace members
const getWorkspaceMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user.id;

    // Get workspace
    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if requesting user is a member of this workspace
    const requestingMembership = await WorkspaceMember.findOne({
      where: {
        workspace_id: id,
        user_id: requestingUserId
      }
    });

    if (!requestingMembership) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not a member of this workspace'
      });
    }

    // Get all members with user info
    const members = await WorkspaceMember.findAll({
      where: { workspace_id: id },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'username']
      }],
      order: [['joined_at', 'ASC']]
    });

    res.json(members);
  } catch (error) {
    console.error('Get workspace members error:', error);
    res.status(500).json({ error: 'Failed to retrieve workspace members' });
  }
};

// Remove member from workspace (admin only)
const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const requestingUserId = req.user.id;

    // Get workspace
    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Cannot remove members from personal workspace
    if (workspace.workspace_type === 'personal') {
      return res.status(403).json({
        error: 'Cannot remove members from personal workspace',
        message: 'Personal workspaces cannot have members removed'
      });
    }

    // Check if requesting user is admin
    const requestingMembership = await WorkspaceMember.findOne({
      where: { workspace_id: id, user_id: requestingUserId }
    });

    if (!requestingMembership || requestingMembership.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only admins can remove members'
      });
    }

    // Cannot remove yourself
    if (parseInt(userId) === requestingUserId) {
      return res.status(400).json({
        error: 'Cannot remove yourself',
        message: 'Use leave workspace instead'
      });
    }

    // Check if user is a member
    const memberToRemove = await WorkspaceMember.findOne({
      where: { workspace_id: id, user_id: userId }
    });

    if (!memberToRemove) {
      return res.status(404).json({
        error: 'Member not found',
        message: 'User is not a member of this workspace'
      });
    }

    // Get the user being removed
    const userBeingRemoved = await User.findByPk(userId);

    console.log(`[RemoveMember] Removing user ${userId} from workspace ${id}`);
    console.log(`[RemoveMember] User's current active_workspace_id: ${userBeingRemoved?.active_workspace_id}`);

    // If they were using this workspace as active, switch them to their personal workspace
    if (userBeingRemoved && userBeingRemoved.active_workspace_id === parseInt(id)) {
      console.log(`[RemoveMember] User was using workspace ${id} as active, switching to personal workspace...`);

      // Find their personal workspace
      const personalWorkspaceMembership = await WorkspaceMember.findOne({
        where: { user_id: userId },
        include: [{
          model: Workspace,
          as: 'workspace',
          where: { workspace_type: 'personal' }
        }]
      });

      console.log(`[RemoveMember] Found personal workspace:`, personalWorkspaceMembership?.workspace?.id);

      if (personalWorkspaceMembership && personalWorkspaceMembership.workspace) {
        await userBeingRemoved.update({
          active_workspace_id: personalWorkspaceMembership.workspace.id
        });
        console.log(`[RemoveMember] ✓ Switched user ${userId} to their personal workspace (${personalWorkspaceMembership.workspace.id})`);
      } else {
        console.log(`[RemoveMember] ❌ Could not find personal workspace for user ${userId}`);
      }
    } else {
      console.log(`[RemoveMember] User was not using workspace ${id} as active, no switch needed`);
    }

    // Remove the member
    await memberToRemove.destroy();

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

module.exports = {
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
};
