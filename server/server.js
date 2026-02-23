const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const { testConnection, syncDatabase } = require('./models');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://soluflow.app',
  'https://soluflow.onrender.com',
  'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:3003', // SoluEvents local dev
  'http://10.100.102.27:3000',
  'http://10.100.102.27:3001',
  'http://10.100.102.27:3003', // SoluEvents network access
  process.env.SOLU_EVENTS_URL // For future production SoluEvents
].filter(Boolean);

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' })); // Increase limit for data import
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enable gzip compression for all responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      // Don't compress responses if this header is present
      return false;
    }
    // Use compression's default filter function
    return compression.filter(req, res);
  },
  level: 6 // Default compression level (0-9, where 6 is a good balance)
}));

// Global rate limiting to prevent abuse
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for trusted IPs (optional)
  skip: (req) => {
    // You can add trusted IPs here if needed
    return false;
  }
});

// Apply global rate limiter to all requests
app.use(globalLimiter);

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs for auth
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Security headers middleware
const { securityHeaders } = require('./middleware/security');
app.use(securityHeaders);

// Routes
const authRoutes = require('./routes/auth');
const songsRoutes = require('./routes/songs');
const servicesRoutes = require('./routes/services');
const notesRoutes = require('./routes/notes');
const usersRoutes = require('./routes/users');
const workspacesRoutes = require('./routes/workspaces');
const integrationRoutes = require('./routes/integration');
const adminRoutes = require('./routes/admin');
const reportsRoutes = require('./routes/reports');
const tagsRoutes = require('./routes/tags');

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Solu Flow API is running' });
});

// Apply stricter rate limiting to authentication routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/integration', integrationRoutes); // Integration API for external apps
app.use('/api/admin', adminRoutes); // Admin API for system management
app.use('/api/reports', reportsRoutes); // Song report system
app.use('/api/tags', tagsRoutes); // Tags system for songs

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/build');

  // Serve static files with proper cache headers
  app.use(express.static(clientBuildPath, {
    maxAge: '1y', // Cache static assets (JS, CSS, images with hashes) for 1 year
    setHeaders: (res, filePath) => {
      // Never cache index.html - always fetch fresh
      if (filePath.endsWith('index.html') || filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // Cache service worker for max 1 day (so updates are detected quickly)
      else if (filePath.endsWith('service-worker.js')) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
      }
    }
  }));

  // Dynamic Open Graph meta tags for SoluCast deep link pages (WhatsApp previews)
  app.get('/open/:code', async (req, res) => {
    const { code } = req.params;
    let title = 'Open in SoluCast';
    let description = 'Click to open this service in the SoluCast desktop app';

    try {
      const { Service, ServiceSong } = require('./models');
      const service = await Service.findOne({ where: { code } });
      if (service) {
        const songCount = await ServiceSong.count({ where: { service_id: service.id, segment_type: 'song' } });
        title = service.title || 'Service';
        const datePart = service.date ? new Date(service.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        description = `${songCount} song${songCount !== 1 ? 's' : ''}${datePart ? ` · ${datePart}` : ''} — tap to open in SoluCast`;
      }
    } catch (err) {
      console.error('[OG] Failed to fetch service for open page:', err.message);
    }

    const ogImage = `${req.protocol}://${req.get('host')}/solucast-logo.png`;
    const safeTitle = title.replace(/[<>"&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]));
    const safeDesc = description.replace(/[<>"&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;','&':'&amp;'}[c]));
    const safeCode = code.replace(/[^A-Za-z0-9]/g, '');

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safeTitle} — SoluCast</title>
<meta property="og:type" content="website" />
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDesc}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:width" content="512" />
<meta property="og:image:height" content="512" />
<meta property="og:site_name" content="SoluCast" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#0a0a0f 0%,#12121a 50%,#0d0d14 100%);color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;padding:24px;text-align:center}
.spinner{width:48px;height:48px;border:3px solid rgba(255,255,255,0.1);border-top-color:#06b6d4;border-radius:50%;animation:spin .8s linear infinite;margin-bottom:24px}
@keyframes spin{to{transform:rotate(360deg)}}
h2{font-size:20px;margin-bottom:8px}
.sub{color:rgba(255,255,255,0.5);font-size:14px}
.sub strong{color:#06b6d4}
.fallback{display:none}
.fallback h2{font-size:22px;margin-bottom:16px}
.fallback p{color:rgba(255,255,255,0.6);font-size:14px;max-width:400px;margin-bottom:24px}
.btn{background:linear-gradient(135deg,#06b6d4,#3b82f6);border:none;border-radius:10px;padding:14px 32px;color:#fff;font-size:16px;font-weight:600;cursor:pointer;margin-bottom:16px}
.code-box{background:rgba(255,255,255,0.08);border-radius:10px;padding:16px 24px;margin-top:8px}
.code-box .label{color:rgba(255,255,255,0.5);font-size:12px;margin-bottom:8px}
.code-box .code{font-size:24px;font-weight:700;letter-spacing:3px;color:#06b6d4;font-family:monospace}
</style>
</head><body>
<div id="loading">
  <div class="spinner"></div>
  <h2>Opening SoluCast...</h2>
  <p class="sub">Launching the desktop app with code <strong>${safeCode}</strong></p>
</div>
<div id="fallback" class="fallback">
  <h2>Open in SoluCast Desktop</h2>
  <p>The desktop app didn't open automatically. You can try again or copy the code to import manually.</p>
  <button class="btn" onclick="window.location.href='solucast://import/${safeCode}'">Open SoluCast</button>
  <div class="code-box">
    <p class="label">Or enter this code manually in SoluCast:</p>
    <span class="code">${safeCode}</span>
  </div>
</div>
<script>
window.location.href='solucast://import/${safeCode}';
setTimeout(function(){
  document.getElementById('loading').style.display='none';
  document.getElementById('fallback').style.display='block';
},1500);
</script>
</body></html>`);
  });

  // Handle React routing, return all requests to React app
  // Always set no-cache headers for HTML responses
  app.use((req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  // 404 handler for development (API only)
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Socket.IO connection handling
const setupServiceRooms = require('./sockets/serviceRooms');
setupServiceRooms(io);

// Initialize database and start server
const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Sync database (create tables if they don't exist, don't alter existing tables)
    await syncDatabase({ alter: false });

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✓ Server running on port ${PORT}`);
      console.log(`✓ API: http://localhost:${PORT}/api`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, io };
