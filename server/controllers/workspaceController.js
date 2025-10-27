const { User, Workspace, WorkspaceMember, WorkspaceInvitation } = require('../models');
const crypto = require('crypto');
const { Op } = require('sequelize');

// GET /api/workspaces - Get all user's workspaces
const getAllWorkspaces = async (req, res) => {
  try {
    const userId = req.user.id;

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

    // Transform the response to include user's role and flatten structure
    const workspacesWithRole = workspaces.map(ws => {
      const wsData = ws.toJSON();
      return {
        id: wsData.id,
        name: wsData.name,
        slug: wsData.slug,
        workspace_type: wsData.workspace_type,
        created_at: wsData.created_at,
        role: wsData.members[0].role,
        joined_at: wsData.members[0].joined_at,
        is_active: req.user.active_workspace_id === wsData.id
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

    // Get workspace
    const workspace = await Workspace.findByPk(id);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Cannot delete personal workspaces
    if (workspace.workspace_type === 'personal') {
      return res.status(403).json({
        error: 'Cannot delete personal workspace',
        message: 'Personal workspaces cannot be deleted'
      });
    }

    // Check if user is admin of this workspace
    const membership = await WorkspaceMember.findOne({
      where: {
        workspace_id: id,
        user_id: userId,
        role: 'admin'
      }
    });

    if (!membership) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Only workspace admins can delete workspaces'
      });
    }

    // Get all members who had this as active workspace
    const affectedUsers = await User.findAll({
      where: { active_workspace_id: id }
    });

    // Delete workspace (will cascade delete members and invitations)
    await workspace.destroy();

    // Update affected users to have their personal workspace as active
    for (const user of affectedUsers) {
      // Find user's personal workspace
      const personalWorkspace = await Workspace.findOne({
        where: { workspace_type: 'personal' },
        include: [{
          model: WorkspaceMember,
          as: 'members',
          where: { user_id: user.id },
          required: true
        }]
      });

      if (personalWorkspace) {
        await user.update({ active_workspace_id: personalWorkspace.id });
      }
    }

    res.json({
      message: 'Workspace deleted successfully',
      affected_users: affectedUsers.length
    });
  } catch (error) {
    console.error('Delete workspace error:', error);
    res.status(500).json({ error: 'Failed to delete workspace' });
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
  getWorkspaceMembers
};
