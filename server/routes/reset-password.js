const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');

// Temporary password reset endpoint (REMOVE AFTER USE!)
router.post('/admin-reset', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and newPassword are required' });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the password and role directly (bypass the beforeUpdate hook)
    await User.update(
      {
        password_hash: hashedPassword,
        role: 'admin' // Ensure admin role
      },
      {
        where: { email },
        individualHooks: false // Skip the hashing hook
      }
    );

    console.log(`Password reset and role updated to admin for ${email}`);

    res.json({
      success: true,
      message: `Password reset successfully and role set to admin for ${email}`
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
