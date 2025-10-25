const os = require('os');

class SystemMonitor {
  constructor() {
    this.metrics = {
      activeConnections: 0,
      totalRequests: 0,
      requestsByEndpoint: {},
      errors: 0,
      startTime: Date.now(),
      peakConnections: 0,
      peakMemoryUsage: 0
    };

    // Track metrics every minute
    setInterval(() => this.logMetrics(), 60000);
  }

  // Increment active WebSocket connections
  connectionOpened() {
    this.metrics.activeConnections++;
    if (this.metrics.activeConnections > this.metrics.peakConnections) {
      this.metrics.peakConnections = this.metrics.activeConnections;
    }
    console.log(`[MONITOR] Active connections: ${this.metrics.activeConnections} (Peak: ${this.metrics.peakConnections})`);
  }

  // Decrement active WebSocket connections
  connectionClosed() {
    this.metrics.activeConnections--;
    console.log(`[MONITOR] Active connections: ${this.metrics.activeConnections} (Peak: ${this.metrics.peakConnections})`);
  }

  // Track HTTP requests
  requestReceived(endpoint) {
    this.metrics.totalRequests++;
    if (!this.metrics.requestsByEndpoint[endpoint]) {
      this.metrics.requestsByEndpoint[endpoint] = 0;
    }
    this.metrics.requestsByEndpoint[endpoint]++;
  }

  // Track errors
  errorOccurred(error) {
    this.metrics.errors++;
    console.error(`[MONITOR] Error occurred:`, error.message);
  }

  // Get current system metrics
  getMetrics() {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    };

    // Track peak memory
    if (memoryUsageMB.heapUsed > this.metrics.peakMemoryUsage) {
      this.metrics.peakMemoryUsage = memoryUsageMB.heapUsed;
    }

    const uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000);
    const uptimeFormatted = this.formatUptime(uptime);

    return {
      server: {
        uptime: uptimeFormatted,
        uptimeSeconds: uptime
      },
      connections: {
        active: this.metrics.activeConnections,
        peak: this.metrics.peakConnections
      },
      requests: {
        total: this.metrics.totalRequests,
        byEndpoint: this.metrics.requestsByEndpoint,
        errors: this.metrics.errors
      },
      memory: {
        current: memoryUsageMB,
        peak: this.metrics.peakMemoryUsage,
        percentUsed: Math.round((memoryUsageMB.heapUsed / memoryUsageMB.heapTotal) * 100)
      },
      system: {
        platform: os.platform(),
        cpus: os.cpus().length,
        totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
        freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
        loadAverage: os.loadavg()
      }
    };
  }

  // Log metrics periodically
  logMetrics() {
    const metrics = this.getMetrics();
    console.log('\n========== SYSTEM METRICS ==========');
    console.log(`Uptime: ${metrics.server.uptime}`);
    console.log(`Active Connections: ${metrics.connections.active} (Peak: ${metrics.connections.peak})`);
    console.log(`Total Requests: ${metrics.requests.total} (Errors: ${metrics.requests.errors})`);
    console.log(`Memory Used: ${metrics.memory.current.heapUsed} MB / ${metrics.memory.current.heapTotal} MB (${metrics.memory.percentUsed}%)`);
    console.log(`Peak Memory: ${metrics.memory.peak} MB`);
    console.log(`Free System Memory: ${metrics.system.freeMemoryMB} MB / ${metrics.system.totalMemoryMB} MB`);
    console.log('====================================\n');
  }

  // Format uptime in human-readable format
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  }

  // Get database size estimate
  async getDatabaseMetrics(sequelize) {
    try {
      const [results] = await sequelize.query(`
        SELECT
          pg_size_pretty(pg_database_size(current_database())) as size,
          pg_database_size(current_database()) as size_bytes
      `);

      const [tableStats] = await sequelize.query(`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY size_bytes DESC
        LIMIT 10
      `);

      return {
        totalSize: results[0].size,
        totalSizeBytes: parseInt(results[0].size_bytes),
        totalSizeMB: Math.round(parseInt(results[0].size_bytes) / 1024 / 1024),
        storageLimit: 1024, // 1 GB in MB
        percentUsed: Math.round((parseInt(results[0].size_bytes) / 1024 / 1024 / 1024) * 100),
        tables: tableStats
      };
    } catch (error) {
      console.error('[MONITOR] Error getting database metrics:', error);
      return null;
    }
  }
}

// Export singleton instance
const monitor = new SystemMonitor();

// Middleware to track HTTP requests
const requestTracker = (req, res, next) => {
  monitor.requestReceived(req.path);

  // Track response time
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn(`[MONITOR] Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });

  next();
};

module.exports = { monitor, requestTracker };
