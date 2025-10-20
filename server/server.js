const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { testConnection, syncDatabase } = require('./models');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
const allowedOrigins = [
  process.env.CLIENT_URL,
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use('/api/auth', authRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/workspaces', workspacesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

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

    // Sync database (create tables if they don't exist)
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
