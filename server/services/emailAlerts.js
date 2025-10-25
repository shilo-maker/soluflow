const nodemailer = require('nodemailer');
const { monitor } = require('../middleware/monitoring');
const db = require('../config/database');

// Email configuration
const ALERT_EMAIL = 'shilo@soluisrael.org';
const ALERT_INTERVALS = {
  daily: 24 * 60 * 60 * 1000,      // 24 hours
  critical: 60 * 60 * 1000,         // 1 hour (for critical alerts)
};

// Alert thresholds
const THRESHOLDS = {
  memory: {
    warning: 75,      // 75% memory usage
    critical: 85      // 85% memory usage
  },
  connections: {
    warning: 60,      // 60 concurrent connections
    critical: 100     // 100 concurrent connections
  },
  database: {
    warning: 700,     // 700 MB (70% of 1GB)
    critical: 850     // 850 MB (85% of 1GB)
  },
  errors: {
    warning: 50,      // 50 errors per day
    critical: 100     // 100 errors per day
  }
};

// Track last alert times to avoid spam
const lastAlertTime = {
  daily: null,
  memory: null,
  connections: null,
  database: null,
  errors: null
};

// Track error count for daily reset
let dailyErrorCount = 0;
let lastErrorReset = Date.now();

class EmailAlerter {
  constructor() {
    this.transporter = null;
    this.setupTransporter();
  }

  setupTransporter() {
    // Use environment variables for email configuration
    if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
      console.log('[EMAIL ALERTS] Email transporter configured');
    } else {
      console.log('[EMAIL ALERTS] Email not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD in .env');
    }
  }

  async sendEmail(subject, htmlContent) {
    if (!this.transporter) {
      console.log('[EMAIL ALERTS] Skipping email - transporter not configured');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: `"Solu Flow Monitor" <${process.env.EMAIL_USER}>`,
        to: ALERT_EMAIL,
        subject: `[Solu Flow] ${subject}`,
        html: htmlContent
      });
      console.log(`[EMAIL ALERTS] Sent: ${subject}`);
      return true;
    } catch (error) {
      console.error('[EMAIL ALERTS] Failed to send email:', error.message);
      return false;
    }
  }

  // Generate daily report email
  async sendDailyReport() {
    const now = Date.now();

    // Check if we should send daily report (once per day)
    if (lastAlertTime.daily && (now - lastAlertTime.daily) < ALERT_INTERVALS.daily) {
      return;
    }

    const metrics = monitor.getMetrics();
    const dbMetrics = await monitor.getDatabaseMetrics(db);

    const status = this.getOverallStatus(metrics, dbMetrics);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #c9956e 0%, #b8844e 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .status { padding: 15px; border-radius: 8px; margin: 20px 0; }
          .status.healthy { background-color: #d4edda; border-left: 4px solid #28a745; }
          .status.warning { background-color: #fff3cd; border-left: 4px solid #ffc107; }
          .status.critical { background-color: #f8d7da; border-left: 4px solid #dc3545; }
          .metric { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 6px; }
          .metric-title { font-weight: bold; color: #c9956e; margin-bottom: 5px; }
          .metric-value { font-size: 24px; font-weight: bold; }
          .recommendation { background: #e7f3ff; padding: 15px; border-radius: 6px; border-left: 4px solid #0066cc; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Solu Flow - Daily Performance Report</h1>
            <p style="margin: 5px 0 0 0;">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div class="status ${status.level}">
            <h2 style="margin-top: 0;">${status.icon} System Status: ${status.label}</h2>
            <p>${status.message}</p>
          </div>

          <h3>Performance Metrics</h3>

          <div class="metric">
            <div class="metric-title">🔌 Active Connections</div>
            <div class="metric-value">${metrics.connections.active} / ${metrics.connections.peak} peak</div>
            <p><strong>What this means:</strong> Currently ${metrics.connections.active} users are connected via WebSocket. Your peak was ${metrics.connections.peak} users.</p>
            <p><strong>Your capacity:</strong> ~100-150 concurrent users maximum with current infrastructure.</p>
            ${metrics.connections.peak > 60 ? '<p style="color: #856404;"><strong>⚠️ Action needed:</strong> Peak usage is approaching limits. Consider monitoring closely or preparing to scale.</p>' : ''}
          </div>

          <div class="metric">
            <div class="metric-title">💾 Memory Usage</div>
            <div class="metric-value">${metrics.memory.current.heapUsed} MB / ${metrics.memory.current.heapTotal} MB (${metrics.memory.percentUsed}%)</div>
            <p><strong>What this means:</strong> Your Node.js server is using ${metrics.memory.percentUsed}% of allocated memory. Peak usage was ${metrics.memory.peak} MB.</p>
            <p><strong>Healthy range:</strong> Below 75% is good. 75-85% is concerning. Above 85% requires immediate attention.</p>
            ${metrics.memory.percentUsed > 75 ? '<p style="color: #856404;"><strong>⚠️ Action needed:</strong> Memory usage is high. Server may slow down or crash if this continues.</p>' : ''}
          </div>

          <div class="metric">
            <div class="metric-title">💿 Database Storage</div>
            <div class="metric-value">${dbMetrics ? dbMetrics.totalSizeMB : 'N/A'} MB / 1024 MB (${dbMetrics ? dbMetrics.percentUsed : 0}%)</div>
            <p><strong>What this means:</strong> Your database is using ${dbMetrics ? dbMetrics.percentUsed : 0}% of your 1 GB storage limit.</p>
            <p><strong>Storage estimate:</strong> ~10,000 songs = ~20 MB. You can store approximately ${dbMetrics ? Math.floor((1024 - dbMetrics.totalSizeMB) / 0.002) : 0} more songs at current average size.</p>
            ${dbMetrics && dbMetrics.totalSizeMB > 700 ? '<p style="color: #856404;"><strong>⚠️ Action needed:</strong> Database storage is over 70%. Start planning for database upgrade.</p>' : ''}
          </div>

          <div class="metric">
            <div class="metric-title">📊 Request Statistics</div>
            <div class="metric-value">${metrics.requests.total} requests</div>
            <p><strong>Total requests:</strong> ${metrics.requests.total} since server started (${metrics.server.uptime} ago)</p>
            <p><strong>Errors:</strong> ${metrics.requests.errors} errors (${((metrics.requests.errors / metrics.requests.total) * 100).toFixed(2)}% error rate)</p>
            ${metrics.requests.errors > 50 ? '<p style="color: #856404;"><strong>⚠️ Action needed:</strong> High error count. Check server logs for issues.</p>' : ''}
          </div>

          <div class="metric">
            <div class="metric-title">⏱️ Server Uptime</div>
            <div class="metric-value">${metrics.server.uptime}</div>
            <p><strong>What this means:</strong> Your server has been running for ${metrics.server.uptime} without restart.</p>
          </div>

          ${this.getRecommendations(metrics, dbMetrics)}

          <div class="footer">
            <p><strong>About this report:</strong> You receive this daily summary to keep track of your application's health and performance.</p>
            <p>View detailed metrics anytime at: <a href="https://soluflow.onrender.com/api/monitoring/metrics">https://soluflow.onrender.com/api/monitoring/metrics</a> (requires admin login)</p>
            <p>Questions? Reply to this email or check the MONITORING_README.md in your server folder.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail('Daily Performance Report', html);
    lastAlertTime.daily = now;
  }

  // Send critical alerts
  async sendCriticalAlert(type, metrics, dbMetrics) {
    const now = Date.now();

    // Don't send same alert type more than once per hour
    if (lastAlertTime[type] && (now - lastAlertTime[type]) < ALERT_INTERVALS.critical) {
      return;
    }

    let alertContent = '';
    let subject = '';

    switch (type) {
      case 'memory':
        subject = '🚨 CRITICAL: High Memory Usage';
        alertContent = `
          <h2 style="color: #dc3545;">Memory usage is at ${metrics.memory.percentUsed}%</h2>
          <p><strong>Current usage:</strong> ${metrics.memory.current.heapUsed} MB / ${metrics.memory.current.heapTotal} MB</p>
          <p><strong>What this means:</strong> Your server is running out of memory and may crash or slow down significantly.</p>
          <h3>Immediate Actions:</h3>
          <ul>
            <li>Check Render.com dashboard for current status</li>
            <li>Consider restarting the server if performance is degraded</li>
            <li>Review active connections: ${metrics.connections.active} users connected</li>
            <li><strong>Plan to upgrade:</strong> If this happens frequently, upgrade to 4 GB RAM on Render.com</li>
          </ul>
        `;
        break;

      case 'connections':
        subject = '⚠️ WARNING: High Connection Count';
        alertContent = `
          <h2 style="color: #ffc107;">Connection count is at ${metrics.connections.active}</h2>
          <p><strong>Peak connections:</strong> ${metrics.connections.peak}</p>
          <p><strong>What this means:</strong> You're approaching maximum capacity for concurrent users.</p>
          <h3>Recommended Actions:</h3>
          <ul>
            <li>Monitor for any performance degradation</li>
            <li>Your capacity limit is ~100-150 concurrent connections</li>
            <li>If consistently over 60 connections, plan to upgrade CPU/RAM</li>
            <li>Check for any stuck connections or unusual activity</li>
          </ul>
        `;
        break;

      case 'database':
        subject = '⚠️ WARNING: Database Storage High';
        alertContent = `
          <h2 style="color: #ffc107;">Database storage is at ${dbMetrics.totalSizeMB} MB (${dbMetrics.percentUsed}%)</h2>
          <p><strong>Storage limit:</strong> 1024 MB (1 GB)</p>
          <p><strong>What this means:</strong> You're approaching your database storage limit.</p>
          <h3>Recommended Actions:</h3>
          <ul>
            <li><strong>Immediate:</strong> Review largest tables and remove unnecessary data</li>
            <li><strong>Short-term:</strong> Plan database upgrade on Render.com</li>
            <li><strong>Long-term:</strong> Implement data archival strategy for old services/notes</li>
            <li>Current capacity: ~${Math.floor((1024 - dbMetrics.totalSizeMB) / 0.002)} more songs at average size</li>
          </ul>
        `;
        break;

      case 'errors':
        subject = '⚠️ WARNING: High Error Rate';
        alertContent = `
          <h2 style="color: #ffc107;">Error count is at ${metrics.requests.errors}</h2>
          <p><strong>Error rate:</strong> ${((metrics.requests.errors / metrics.requests.total) * 100).toFixed(2)}%</p>
          <p><strong>What this means:</strong> Your application is experiencing an unusually high number of errors.</p>
          <h3>Recommended Actions:</h3>
          <ul>
            <li><strong>Immediate:</strong> Check Render.com logs for error details</li>
            <li>Review recent deployments or changes</li>
            <li>Check if errors are from specific endpoints</li>
            <li>Monitor if errors are increasing or stable</li>
          </ul>
        `;
        break;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .alert-header { background: #dc3545; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 8px; }
          ul { background: white; padding: 20px 40px; border-radius: 6px; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="alert-header">
            <h1 style="margin: 0;">Solu Flow Alert</h1>
            <p style="margin: 5px 0 0 0;">${new Date().toLocaleString()}</p>
          </div>
          <div class="content">
            ${alertContent}
          </div>
          <div class="footer">
            <p>View detailed metrics: <a href="https://soluflow.onrender.com/api/monitoring/metrics">Monitoring Dashboard</a> (requires admin login)</p>
            <p>This is an automated alert from your Solu Flow monitoring system.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail(subject, html);
    lastAlertTime[type] = now;
  }

  // Check all thresholds and send alerts if needed
  async checkAndAlert() {
    const metrics = monitor.getMetrics();
    const dbMetrics = await monitor.getDatabaseMetrics(db);

    // Check memory
    if (metrics.memory.percentUsed >= THRESHOLDS.memory.critical) {
      await this.sendCriticalAlert('memory', metrics, dbMetrics);
    }

    // Check connections
    if (metrics.connections.active >= THRESHOLDS.connections.critical) {
      await this.sendCriticalAlert('connections', metrics, dbMetrics);
    }

    // Check database storage
    if (dbMetrics && dbMetrics.totalSizeMB >= THRESHOLDS.database.critical) {
      await this.sendCriticalAlert('database', metrics, dbMetrics);
    }

    // Check errors
    if (metrics.requests.errors >= THRESHOLDS.errors.critical) {
      await this.sendCriticalAlert('errors', metrics, dbMetrics);
    }
  }

  getOverallStatus(metrics, dbMetrics) {
    const memoryStatus = metrics.memory.percentUsed;
    const connectionStatus = metrics.connections.peak;
    const dbStatus = dbMetrics ? dbMetrics.totalSizeMB : 0;
    const errorRate = (metrics.requests.errors / Math.max(metrics.requests.total, 1)) * 100;

    if (memoryStatus >= THRESHOLDS.memory.critical ||
        connectionStatus >= THRESHOLDS.connections.critical ||
        dbStatus >= THRESHOLDS.database.critical ||
        errorRate > 5) {
      return {
        level: 'critical',
        label: 'CRITICAL',
        icon: '🚨',
        message: 'Your application requires immediate attention. One or more metrics have exceeded critical thresholds.'
      };
    }

    if (memoryStatus >= THRESHOLDS.memory.warning ||
        connectionStatus >= THRESHOLDS.connections.warning ||
        dbStatus >= THRESHOLDS.database.warning ||
        errorRate > 2) {
      return {
        level: 'warning',
        label: 'WARNING',
        icon: '⚠️',
        message: 'Your application is approaching resource limits. Consider reviewing the recommendations below.'
      };
    }

    return {
      level: 'healthy',
      label: 'HEALTHY',
      icon: '✅',
      message: 'All systems are operating normally. No action required at this time.'
    };
  }

  getRecommendations(metrics, dbMetrics) {
    const recommendations = [];

    if (metrics.memory.percentUsed > 75) {
      recommendations.push('Consider upgrading to 4 GB RAM on Render.com for better performance.');
    }

    if (metrics.connections.peak > 60) {
      recommendations.push('Peak connections are high. Monitor for performance issues and plan for scaling.');
    }

    if (dbMetrics && dbMetrics.totalSizeMB > 700) {
      recommendations.push('Database storage is over 70%. Plan to upgrade to 10 GB or implement data archival.');
    }

    if (metrics.requests.errors > 50) {
      recommendations.push('High error count detected. Review application logs for recurring issues.');
    }

    if (recommendations.length === 0) {
      return `
        <div class="recommendation">
          <h3 style="margin-top: 0;">✅ No Action Needed</h3>
          <p>Your application is running smoothly. Continue monitoring daily reports to catch issues early.</p>
        </div>
      `;
    }

    return `
      <div class="recommendation">
        <h3 style="margin-top: 0;">💡 Recommendations</h3>
        <ul>
          ${recommendations.map(rec => `<li>${rec}</li>`).join('\n')}
        </ul>
      </div>
    `;
  }
}

// Create singleton instance
const emailAlerter = new EmailAlerter();

// Start monitoring checks
function startMonitoring() {
  // Check critical alerts every 15 minutes
  setInterval(() => {
    emailAlerter.checkAndAlert();
  }, 15 * 60 * 1000);

  // Send daily report at 9 AM UTC (adjust timezone as needed)
  setInterval(() => {
    const now = new Date();
    const hour = now.getUTCHours();

    // Send at 9 AM UTC (12 PM Israel time)
    if (hour === 9) {
      emailAlerter.sendDailyReport();
    }
  }, 60 * 60 * 1000); // Check every hour

  console.log('[EMAIL ALERTS] Monitoring started - checking every 15 minutes, daily report at 9 AM UTC');
}

module.exports = { emailAlerter, startMonitoring };
