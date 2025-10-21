const { User, Service, Workspace, WorkspaceMember } = require('../models');
const { generateAccessToken, generateGuestToken } = require('../utils/jwt');

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { email, password, username, workspaceId, role } = req.body;

    // Validate required fields
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    let finalWorkspaceId = workspaceId;
    let createdWorkspace = null;

    // If workspaceId is provided, verify it exists
    if (finalWorkspaceId) {
      const workspace = await Workspace.findByPk(finalWorkspaceId);
      if (!workspace) {
        return res.status(400).json({ error: 'Invalid workspace ID' });
      }
    } else {
      // Create workspace first without created_by (will update after user creation)
      const emailPrefix = email.split('@')[0];
      const workspaceName = `${emailPrefix}'s Workspace`;
      const workspaceSlug = `${emailPrefix}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      createdWorkspace = await Workspace.create({
        name: workspaceName,
        slug: workspaceSlug,
        workspace_type: 'personal',
        created_by: null // Will update after user is created
      });

      finalWorkspaceId = createdWorkspace.id;
    }

    // Create user with active_workspace_id set to the workspace
    const user = await User.create({
      email,
      password_hash: password, // Will be hashed by model hook
      username,
      workspace_id: finalWorkspaceId,
      active_workspace_id: finalWorkspaceId,
      role: role || 'member'
    });

    // Update workspace created_by if we created it
    if (createdWorkspace) {
      await createdWorkspace.update({ created_by: user.id });
    }

    // Create workspace membership - creator is always admin of their workspace
    await WorkspaceMember.create({
      workspace_id: finalWorkspaceId,
      user_id: user.id,
      role: 'admin'
    });

    // Generate token
    const token = generateAccessToken(user);

    res.status(201).json({
      user: user.toJSON(),
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user with workspaces
    const user = await User.findOne({
      where: { email },
      include: [{
        model: Workspace,
        as: 'workspaces',
        through: {
          attributes: ['role', 'joined_at']
        }
      }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Validate password
    const isValidPassword = await user.validPassword(password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user has workspaces - if not, create personal workspace
    if (!user.workspaces || user.workspaces.length === 0) {
      console.log('User has no workspaces, creating personal workspace...');

      // Create personal workspace
      const workspaceName = `${user.username}'s Workspace`;
      const workspaceSlug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const personalWorkspace = await Workspace.create({
        name: workspaceName,
        slug: workspaceSlug,
        workspace_type: 'personal',
        created_by: user.id
      });

      // Create workspace membership - creator is always admin of their workspace
      await WorkspaceMember.create({
        workspace_id: personalWorkspace.id,
        user_id: user.id,
        role: 'admin'
      });

      // Set as active workspace
      await user.update({ active_workspace_id: personalWorkspace.id });

      // Reload user with workspaces
      await user.reload({
        include: [{
          model: Workspace,
          as: 'workspaces',
          through: {
            attributes: ['role', 'joined_at']
          }
        }]
      });
    }

    // Get active workspace details
    let activeWorkspace = null;
    if (user.active_workspace_id) {
      activeWorkspace = await Workspace.findByPk(user.active_workspace_id);
    } else if (user.workspaces && user.workspaces.length > 0) {
      // If no active workspace but user has workspaces, set first one as active
      activeWorkspace = user.workspaces[0];
      await user.update({ active_workspace_id: activeWorkspace.id });
    }

    // Generate token
    const token = generateAccessToken(user);

    // Transform user data
    const userData = user.toJSON();

    res.json({
      user: userData,
      workspaces: userData.workspaces || [],
      activeWorkspace: activeWorkspace ? {
        id: activeWorkspace.id,
        name: activeWorkspace.name,
        workspace_type: activeWorkspace.workspace_type
      } : null,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// POST /api/auth/guest
const guestAuth = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Service code required' });
    }

    // Find service by code
    const service = await Service.findOne({
      where: { code: code.toUpperCase(), is_public: true },
      attributes: ['id', 'title', 'date', 'time']
    });

    if (!service) {
      return res.status(404).json({ error: 'Invalid code or service not public' });
    }

    // Generate guest token
    const token = generateGuestToken(service.id);

    res.json({
      token,
      service
    });
  } catch (error) {
    console.error('Guest auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate as guest' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    if (req.user.type === 'guest') {
      return res.json({
        type: 'guest',
        serviceId: req.user.serviceId
      });
    }

    // Get user with workspaces and active workspace
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: Workspace,
        as: 'workspaces',
        through: {
          attributes: ['role', 'joined_at']
        }
      }, {
        model: Workspace,
        as: 'activeWorkspace',
        attributes: ['id', 'name', 'slug', 'workspace_type']
      }]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = user.toJSON();

    res.json({
      user: userData,
      workspaces: userData.workspaces || [],
      activeWorkspace: userData.activeWorkspace || null
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};

module.exports = {
  register,
  login,
  guestAuth,
  getMe
};
