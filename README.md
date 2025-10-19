# Solu Flow

**A real-time worship coordination platform for musicians, singers, leaders, and guests.**

Solu Flow keeps worship teams united during live services with synchronized chord sheets, real-time transposition, leader control, and mobile-first design.

---

## Features

- **Service Planning**: Create structured set lists with songs, prayers, readings, and breaks
- **Song Library**: Store songs with chords and lyrics in ChordPro format
- **Real-Time Sync**: Leader controls what everyone sees via Socket.IO
- **Transposition**: Instantly transpose songs or use Nashville Numbers
- **Lyrics-Only Mode**: One-tap toggle for singers who don't need chords
- **Personal Notes**: Add private notes to songs (per service context)
- **Guest Access**: Share services via public links (no account required)
- **Follow/Free Mode**: Follow the leader or navigate independently
- **Offline Support**: Cached content for viewing without internet
- **Mobile-First**: Optimized for phones with large tap targets and clean UI
- **Multi-Language**: Full Hebrew (RTL) and English (LTR) support

---

## Technology Stack

### Frontend
- React 18+ with React Router
- Bootstrap 5 (mobile-first responsive design)
- Socket.IO Client (real-time sync)
- Axios (HTTP client)
- Custom ChordPro parser

### Backend
- Node.js 18+ with Express.js
- PostgreSQL 14+ with Sequelize ORM
- Socket.IO (real-time communication)
- JWT authentication
- Multer (file uploads)

### Infrastructure
- Docker containers
- Cloud storage for PDFs/images
- PWA support with service workers

---

## Project Structure

```
soluflow/
├── client/              # React frontend
├── server/              # Node.js backend
├── docs/                # Documentation
├── ARCHITECTURE.md      # System architecture
├── DATABASE.md          # Database schema
├── API.md               # REST API documentation
├── SOCKET_EVENTS.md     # Socket.IO events
└── README.md            # This file
```

---

## Documentation

- [**Architecture**](ARCHITECTURE.md): System design, tech stack, and project structure
- [**Database Schema**](DATABASE.md): Complete database design with relationships
- [**API Endpoints**](API.md): REST API documentation with examples
- [**Socket Events**](SOCKET_EVENTS.md): Real-time event specifications

---

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full workspace control, manage users |
| **Planner** | Create services, manage songs, assign leaders |
| **Leader** | Control live service flow, transpose for all followers |
| **Member** | View services, transpose songs, add personal notes |
| **Guest** | View services via link, transpose songs (read-only) |

---

## Development Roadmap

### ✅ Stage 1: Planning & Architecture (CURRENT)
- Define data models and relationships
- Design API endpoints and socket events
- Create project structure documentation

### 🔄 Stage 2: Project Scaffolding
- Initialize React frontend with routing
- Setup Node.js backend with Express
- Configure PostgreSQL database
- Setup development environment

### 📋 Stage 3: Static UI Mockups
- Build Home, Service, Library, and Song View pages
- Implement bottom navigation
- Create reusable components
- Use mock data for testing

### 📋 Stage 4: Backend Foundation
- Implement authentication (JWT)
- Create database models with Sequelize
- Build REST API routes
- Setup middleware (auth, roles, validation)

### 📋 Stage 5: Core Functionality
- Service creation and management
- Song library CRUD operations
- Transposition logic and Nashville Numbers
- Personal notes system
- Guest access via shareable links

### 📋 Stage 6: Real-Time Sync & Leader Mode
- Implement Socket.IO server
- Leader control events
- Follow/Free mode toggle
- Live service updates
- Multi-user synchronization

### 📋 Stage 7: Mobile Optimization & Polish
- PWA configuration with service workers
- Offline caching strategy
- Performance optimization
- Cross-browser testing
- UI/UX refinements

### 📋 Stage 8: Launch & Beta Testing
- Deploy to staging environment
- Collect user feedback
- Bug fixes and improvements
- Production deployment

---

## Getting Started (Coming Soon)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation
```bash
# Clone repository
git clone https://github.com/yourusername/soluflow.git
cd soluflow

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Environment Variables
```bash
# server/.env
DATABASE_URL=postgresql://user:password@localhost:5432/soluflow
JWT_SECRET=your_secret_key
PORT=5000

# client/.env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

### Running Development Servers
```bash
# Start backend (from server/)
npm run dev

# Start frontend (from client/)
npm start
```

---

## Key Workflows

### 1. Service Creation (Planner)
1. Navigate to Home → Create Service
2. Add songs from library to set list
3. Assign a leader
4. Generate shareable link for guests
5. Share code with team

### 2. Live Service (Leader)
1. Join service and enable Leader Mode
2. Navigate through set list
3. Transpose songs in real-time (broadcasts to all followers)
4. Add spontaneous songs if needed
5. All followers stay synchronized

### 3. Following a Service (Member)
1. Join service via code or from upcoming services
2. Follow Leader (auto-sync) or switch to Free Mode
3. View chords/lyrics with personal notes
4. Toggle lyrics-only mode as needed
5. Transpose locally in Free Mode

### 4. Guest Access
1. Receive service code from planner
2. Enter code on guest page
3. View service and songs (read-only)
4. Transpose songs locally
5. No account required

---

## Design Principles

**Mobile-First**: Designed for phones with 44px minimum tap targets

**Real-Time**: Socket.IO keeps all devices synchronized instantly

**Offline-Ready**: PWA with service worker caching

**Accessible**: High-contrast typography for stage lighting

**Simple**: Minimal UI, maximum functionality

**Flexible**: Follow the leader or navigate independently

---

## Security

- JWT authentication with short expiration times
- Role-based access control
- Guest tokens for temporary access
- SQL injection protection via Sequelize
- XSS protection and input sanitization
- Rate limiting on API endpoints
- File upload validation (type, size)

---

## Performance

- Code splitting and lazy loading
- Debounced search inputs
- Virtual scrolling for large lists
- Database indexing on frequently queried fields
- Socket.IO room isolation per service
- Compressed payloads
- CDN for static assets

---

## Contributing (Coming Soon)

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is proprietary software. All rights reserved.

---

## Contact

**Solu Team**
Email: support@soluflow.com
Website: https://soluflow.com

---

## Acknowledgments

- Built for worship teams who need to stay united
- Inspired by the needs of house-of-prayer communities
- Designed for real-world stage environments

---

**Solu Flow** — Uniting worship teams through real-time coordination.
