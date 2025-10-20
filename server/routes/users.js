const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/userController');

// All routes require authentication
router.use(authenticate);

// Get all users (admin only)
router.get('/', getAllUsers);

// Get single user (admin only)
router.get('/:id', getUserById);

// Update user (admin only)
router.put('/:id', updateUser);

// Delete user (admin only)
router.delete('/:id', deleteUser);

module.exports = router;
