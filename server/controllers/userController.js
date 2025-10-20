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

    await user.destroy();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
};
