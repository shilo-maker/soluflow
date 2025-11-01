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
  'http://localhost:3002'
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
