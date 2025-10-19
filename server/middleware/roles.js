// Middleware to check if user has required role
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Guests cannot access role-protected routes
    if (req.user.type === 'guest') {
      return res.status(403).json({ error: 'Access denied for guest users' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = requireRole('admin');

// Middleware to check if user is planner or admin
const requirePlanner = requireRole('admin', 'planner');

// Middleware to check if user is leader, planner, or admin
const requireLeader = requireRole('admin', 'planner', 'leader');

// Middleware to check if user is any authenticated member
const requireMember = requireRole('admin', 'planner', 'leader', 'member');

module.exports = {
  requireRole,
  requireAdmin,
  requirePlanner,
  requireLeader,
  requireMember
};
