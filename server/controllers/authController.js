const { User, Service, Workspace } = require('../models');
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

    // If workspaceId is not provided or doesn't exist, create a new workspace
    if (!finalWorkspaceId) {
      // Generate workspace name and slug from email
      const emailPrefix = email.split('@')[0];
      const workspaceName = `${emailPrefix}'s Workspace`;
      const workspaceSlug = `${emailPrefix}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      const workspace = await Workspace.create({
        name: workspaceName,
        slug: workspaceSlug
      });

      finalWorkspaceId = workspace.id;
    } else {
      // Verify the workspace exists
      const workspace = await Workspace.findByPk(finalWorkspaceId);
      if (!workspace) {
        return res.status(400).json({ error: 'Invalid workspace ID' });
      }
    }

    // Create user
    const user = await User.create({
      email,
      password_hash: password, // Will be hashed by model hook
      username,
      workspace_id: finalWorkspaceId,
      role: role || 'member'
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

    // Find user
    const user = await User.findOne({ where: { email } });

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

    // Generate token
    const token = generateAccessToken(user);

    res.json({
      user: user.toJSON(),
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

    res.json(req.user.toJSON());
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
