const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');

// Middleware to authenticate JWT tokens
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);

    // Check if it's a guest token
    if (decoded.type === 'guest') {
      req.user = { type: 'guest', serviceId: decoded.serviceId };
      return next();
    }

    // For regular users, fetch full user details
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to check if user is authenticated (but allow guests)
const authenticateOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (decoded.type === 'guest') {
      req.user = { type: 'guest', serviceId: decoded.serviceId };
    } else {
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password_hash'] }
      });
      req.user = user;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = { authenticate, authenticateOptional };
