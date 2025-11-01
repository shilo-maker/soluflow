const crypto = require('crypto');
const { sequelize, User, Service, Workspace, WorkspaceMember } = require('../models');
const { generateAccessToken, generateGuestToken } = require('../utils/jwt');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

// POST /api/auth/register
const register = async (req, res) => {
  // Use transaction to ensure all operations succeed or fail together
  const transaction = await sequelize.transaction();

  try {
    const { email, password, username, workspaceId, role } = req.body;

    // Validate required fields
    if (!email || !password || !username) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email }, transaction });
    if (existingUser) {
      await transaction.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    let finalWorkspaceId = workspaceId;
    let createdWorkspace = null;

    // If workspaceId is provided, verify it exists
    if (finalWorkspaceId) {
      const workspace = await Workspace.findByPk(finalWorkspaceId, { transaction });
      if (!workspace) {
        await transaction.rollback();
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
      }, { transaction });

      finalWorkspaceId = createdWorkspace.id;
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with active_workspace_id set to the workspace
    const user = await User.create({
      email,
      password_hash: password, // Will be hashed by model hook
      username,
      workspace_id: finalWorkspaceId,
      active_workspace_id: finalWorkspaceId,
      role: role || 'member',
      email_verified: false,
      verification_token: verificationToken,
      verification_token_expires: verificationTokenExpires
    }, { transaction });

    // Update workspace created_by if we created it
    if (createdWorkspace) {
      await createdWorkspace.update({ created_by: user.id }, { transaction });
    }

    // Create workspace membership - creator is always admin of their workspace
    await WorkspaceMember.create({
      workspace_id: finalWorkspaceId,
      user_id: user.id,
      role: 'admin'
    }, { transaction });

    // Commit transaction - all operations succeeded
    await transaction.commit();

    // Send verification email (don't await - let it happen in background)
    // This happens AFTER transaction commit, so email failure won't affect registration
    sendVerificationEmail(email, verificationToken, username).catch(error => {
      console.error('Failed to send verification email:', error);
    });

    res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      user: user.toJSON(),
      emailSent: true
    });
  } catch (error) {
    // Rollback transaction on any error
    await transaction.rollback();
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

    // Check if email is verified
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email not verified',
        message: 'Please verify your email address before logging in. Check your inbox for the verification link.'
      });
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

// PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    if (req.user.type === 'guest') {
      return res.status(403).json({ error: 'Guests cannot update profile' });
    }

    const { language } = req.body;

    // Get current user
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate and update language
    if (language !== undefined) {
      if (!['en', 'he'].includes(language)) {
        return res.status(400).json({ error: 'Invalid language. Must be "en" or "he"' });
      }
      await user.update({ language });
    }

    res.json({
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// GET /api/auth/verify-email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token required' });
    }

    // Find user by verification token
    const user = await User.findOne({
      where: { verification_token: token }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token has expired
    if (user.verification_token_expires && new Date() > user.verification_token_expires) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    // Mark email as verified and clear verification token
    await user.update({
      email_verified: true,
      verification_token: null,
      verification_token_expires: null
    });

    res.json({
      message: 'Email verified successfully! You can now log in.',
      success: true
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
};

// POST /api/auth/resend-verification
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a verification link has been sent.' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await user.update({
      verification_token: verificationToken,
      verification_token_expires: verificationTokenExpires
    });

    // Send verification email
    await sendVerificationEmail(email, verificationToken, user.username);

    res.json({ message: 'Verification email sent. Please check your inbox.' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save hashed token and expiration to database
    await user.update({
      reset_password_token: hashedToken,
      reset_password_expires: resetExpires
    });

    // Send password reset email
    await sendPasswordResetEmail(email, resetToken, user.username);

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Hash the token from URL to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      where: {
        reset_password_token: hashedToken,
        reset_password_expires: {
          [require('sequelize').Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Update password and clear reset token
    await user.update({
      password_hash: password, // Will be hashed by the beforeUpdate hook
      reset_password_token: null,
      reset_password_expires: null
    });

    res.json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

module.exports = {
  register,
  login,
  guestAuth,
  getMe,
  updateProfile,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword
};
