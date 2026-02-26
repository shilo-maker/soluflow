const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');
const crypto = require('crypto');

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

// Middleware to authenticate API keys for integration
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required. Provide X-API-Key header.'
      });
    }

    // Check if API key matches the configured integration key
    const validApiKey = process.env.INTEGRATION_API_KEY;

    if (!validApiKey) {
      console.error('INTEGRATION_API_KEY not configured in environment');
      return res.status(500).json({
        success: false,
        error: 'Integration API not properly configured'
      });
    }

    // Use constant-time comparison to prevent timing attacks
    const apiKeyBuffer = Buffer.from(apiKey);
    const validKeyBuffer = Buffer.from(validApiKey);

    if (apiKeyBuffer.length !== validKeyBuffer.length ||
        !crypto.timingSafeEqual(apiKeyBuffer, validKeyBuffer)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // API key is valid
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(401).json({
      success: false,
      error: 'API key authentication failed'
    });
  }
};

// Combined authentication: JWT token OR API key
const authenticateIntegration = async (req, res, next) => {
  try {
    // Check for API key first
    const apiKey = req.headers['x-api-key'];

    if (apiKey) {
      // Use API key authentication
      return authenticateApiKey(req, res, next);
    }

    // Fall back to JWT authentication
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Provide either X-API-Key header or Bearer token.'
      });
    }

    // Use standard JWT authentication
    return authenticate(req, res, next);
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

module.exports = {
  authenticate,
  authenticateOptional,
  authenticateApiKey,
  authenticateIntegration
};
