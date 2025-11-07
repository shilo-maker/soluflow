const { User, Workspace } = require('../models');

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view all users' });
    }

    const users = await User.findAll({
      include: [
        {
          model: Workspace,
          as: 'activeWorkspace',
          attributes: ['id', 'name', 'workspace_type']
        },
        {
          model: Workspace,
          as: 'workspaces',
          attributes: ['id', 'name', 'workspace_type'],
          through: {
            attributes: ['role']
          }
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get a single user by ID (admin only)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view user details' });
    }

    const user = await User.findByPk(id, {
      include: [
        {
          model: Workspace,
          as: 'activeWorkspace',
          attributes: ['id', 'name', 'workspace_type']
        },
        {
          model: Workspace,
          as: 'workspaces',
          attributes: ['id', 'name', 'workspace_type'],
          through: {
            attributes: ['role']
          }
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, is_active } = req.body;
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update users' });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update object - only include provided fields
    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active;

    await user.update(updateData);

    // Reload to get fresh data
    await user.reload({
      include: [
        {
          model: Workspace,
          as: 'activeWorkspace',
          attributes: ['id', 'name', 'workspace_type']
        },
        {
          model: Workspace,
          as: 'workspaces',
          attributes: ['id', 'name', 'workspace_type'],
          through: {
            attributes: ['role']
          }
        }
      ]
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  const { sequelize } = require('../config/database');

  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const currentUserId = req.user?.id;

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete users' });
    }

    // Prevent admin from deleting themselves
    if (parseInt(id) === currentUserId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Use transaction to ensure all deletions succeed or none
    await sequelize.transaction(async (transaction) => {
      // Delete user's notes
      await sequelize.query('DELETE FROM notes WHERE user_id = ?', {
        replacements: [id],
        transaction
      });

      // Delete shared songs (where user is recipient or sharer)
      await sequelize.query('DELETE FROM shared_songs WHERE user_id = ? OR shared_by = ?', {
        replacements: [id, id],
        transaction
      });

      // Delete shared services (where user is recipient)
      await sequelize.query('DELETE FROM shared_services WHERE user_id = ?', {
        replacements: [id],
        transaction
      });

      // Delete workspace invitations created by this user
      await sequelize.query('DELETE FROM workspace_invitations WHERE created_by = ?', {
        replacements: [id],
        transaction
      });

      // Update services where user is leader (set leader_id to NULL)
      await sequelize.query('UPDATE services SET leader_id = NULL WHERE leader_id = ?', {
        replacements: [id],
        transaction
      });

      // Update songs created by user (set created_by to NULL)
      await sequelize.query('UPDATE songs SET created_by = NULL WHERE created_by = ?', {
        replacements: [id],
        transaction
      });

      // Update services created by user (set created_by to NULL)
      await sequelize.query('UPDATE services SET created_by = NULL WHERE created_by = ?', {
        replacements: [id],
        transaction
      });

      // Delete workspace memberships
      await sequelize.query('DELETE FROM workspace_members WHERE user_id = ?', {
        replacements: [id],
        transaction
      });

      // Update other users who have this workspace as active (set to NULL)
      await sequelize.query('UPDATE users SET active_workspace_id = NULL WHERE active_workspace_id IN (SELECT id FROM workspaces WHERE id IN (SELECT workspace_id FROM workspace_members WHERE user_id = ?))', {
        replacements: [id],
        transaction
      });

      // Delete workspaces owned by user (personal workspaces where they're the only member)
      // This will cascade delete services and songs in those workspaces
      await sequelize.query(`
        DELETE FROM workspaces
        WHERE id IN (
          SELECT w.id FROM workspaces w
          WHERE NOT EXISTS (
            SELECT 1 FROM workspace_members wm
            WHERE wm.workspace_id = w.id AND wm.user_id != ?
          )
        )
      `, {
        replacements: [id],
        transaction
      });

      // Finally, delete the user
      await user.destroy({ transaction });
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
};

// Get user theme preferences
const getThemePreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: [
        'theme_gradient_preset',
        'theme_text_color',
        'theme_chord_color',
        'theme_chord_size'
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return theme preferences with defaults if not set
    const themePreferences = {
      gradientPreset: user.theme_gradient_preset || 'professional',
      textColor: user.theme_text_color || '#000000',
      chordColor: user.theme_chord_color || '#667eea',
      chordSize: parseFloat(user.theme_chord_size) || 1.0
    };

    res.json(themePreferences);
  } catch (error) {
    console.error('Error fetching theme preferences:', error);
    res.status(500).json({ error: 'Failed to fetch theme preferences' });
  }
};

// Update user theme preferences
const updateThemePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gradientPreset, textColor, chordColor, chordSize } = req.body;

    // Validation
    const hexColorRegex = /^#[0-9A-F]{6}$/i;
    const validPresets = ['professional', 'warm', 'nature', 'elegant'];

    if (gradientPreset && !validPresets.includes(gradientPreset)) {
      return res.status(400).json({ error: 'Invalid gradient preset. Must be one of: ' + validPresets.join(', ') });
    }

    if (textColor && !hexColorRegex.test(textColor)) {
      return res.status(400).json({ error: 'Invalid text color format. Use hex format (#RRGGBB)' });
    }

    if (chordColor && !hexColorRegex.test(chordColor)) {
      return res.status(400).json({ error: 'Invalid chord color format. Use hex format (#RRGGBB)' });
    }

    if (chordSize && (chordSize < 0.5 || chordSize > 3.0)) {
      return res.status(400).json({ error: 'Chord size must be between 0.5 and 3.0' });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update theme preferences
    const updates = {};
    if (gradientPreset !== undefined) updates.theme_gradient_preset = gradientPreset;
    if (textColor !== undefined) updates.theme_text_color = textColor;
    if (chordColor !== undefined) updates.theme_chord_color = chordColor;
    if (chordSize !== undefined) updates.theme_chord_size = chordSize;

    await user.update(updates);

    res.json({
      message: 'Theme preferences updated successfully',
      themePreferences: {
        gradientPreset: user.theme_gradient_preset,
        textColor: user.theme_text_color,
        chordColor: user.theme_chord_color,
        chordSize: parseFloat(user.theme_chord_size)
      }
    });
  } catch (error) {
    console.error('Error updating theme preferences:', error);
    res.status(500).json({ error: 'Failed to update theme preferences' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getThemePreferences,
  updateThemePreferences
};
