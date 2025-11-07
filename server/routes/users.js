const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getThemePreferences,
  updateThemePreferences
} = require('../controllers/userController');

// All routes require authentication
router.use(authenticate);

// Theme preferences routes (any authenticated user)
router.get('/theme/preferences', getThemePreferences);
router.put('/theme/preferences', updateThemePreferences);

// Get all users (admin only)
router.get('/', getAllUsers);

// Get single user (admin only)
router.get('/:id', getUserById);

// Update user (admin only)
router.put('/:id', updateUser);

// Delete user (admin only)
router.delete('/:id', deleteUser);

module.exports = router;
