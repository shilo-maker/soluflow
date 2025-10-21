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

    // Update the password directly (bypass the beforeUpdate hook)
    await User.update(
      { password_hash: hashedPassword },
      {
        where: { email },
        individualHooks: false // Skip the hashing hook
      }
    );

    console.log(`Password reset for ${email}`);

    res.json({
      success: true,
      message: `Password reset successfully for ${email}`
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
