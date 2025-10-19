const jwt = require('jsonwebtoken');

const generateToken = (payload, expiresIn = null) => {
  const options = {};
  if (expiresIn) {
    options.expiresIn = expiresIn;
  } else {
    options.expiresIn = process.env.JWT_EXPIRES_IN || '1h';
  }

  return jwt.sign(payload, process.env.JWT_SECRET, options);
};

const generateAccessToken = (user) => {
  return generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    workspaceId: user.workspace_id
  });
};

const generateGuestToken = (serviceId) => {
  return generateToken({
    type: 'guest',
    serviceId
  }, '24h');
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = {
  generateToken,
  generateAccessToken,
  generateGuestToken,
  verifyToken
};
