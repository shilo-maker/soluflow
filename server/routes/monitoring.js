const express = require('express');
const router = express.Router();
const { monitor } = require('../middleware/monitoring');
const db = require('../config/database');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// GET /api/monitoring/metrics - Get current system metrics (admin only)
router.get('/metrics', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const metrics = monitor.getMetrics();
    const dbMetrics = await monitor.getDatabaseMetrics(db);

    res.json({
      timestamp: new Date().toISOString(),
      ...metrics,
      database: dbMetrics
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/monitoring/health - Simple health check endpoint (public)
router.get('/health', (req, res) => {
  const metrics = monitor.getMetrics();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: metrics.server.uptime,
    activeConnections: metrics.connections.active,
    memoryUsagePercent: metrics.memory.percentUsed
  };

  // Mark as degraded if memory usage > 85%
  if (metrics.memory.percentUsed > 85) {
    health.status = 'degraded';
    health.warning = 'High memory usage';
  }

  // Mark as degraded if too many active connections
  if (metrics.connections.active > 100) {
    health.status = 'degraded';
    health.warning = 'High number of active connections';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
