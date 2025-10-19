# Solu Flow - Architecture Documentation

## System Overview

Solu Flow is a real-time worship coordination platform with a mobile-first React frontend, Node.js backend, PostgreSQL database, and Socket.IO for real-time synchronization.

## Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer (React)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Home   │  │ Service  │  │ Library  │  │  Auth    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│         │              │             │             │         │
│         └──────────────┴─────────────┴─────────────┘         │
│                          │                                    │
│                  ┌───────▼────────┐                          │
│                  │  State Manager │                          │
│                  │   (Context)    │                          │
│                  └───────┬────────┘                          │
└──────────────────────────┼───────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼─────┐     ┌─────▼──────┐    ┌─────▼─────┐
   │   HTTP   │     │  Socket.IO │    │  Storage  │
   │   API    │     │  (realtime)│    │  (cache)  │
   └────┬─────┘     └─────┬──────┘    └───────────┘
        │                 │
┌───────┴─────────────────┴───────────────────────────────────┐
│              Server Layer (Node.js/Express)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │   Songs  │  │ Services │  │  Socket  │   │
│  │  Routes  │  │  Routes  │  │  Routes  │  │  Manager │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │              │             │          │
│       └─────────────┴──────────────┴─────────────┘          │
│                          │                                   │
│                  ┌───────▼────────┐                         │
│                  │   Controllers  │                         │
│                  └───────┬────────┘                         │
│                          │                                   │
│                  ┌───────▼────────┐                         │
│                  │     Models     │                         │
│                  └───────┬────────┘                         │
└──────────────────────────┼──────────────────────────────────┘
                           │
                  ┌────────▼─────────┐
                  │   PostgreSQL     │
                  │    Database      │
                  └──────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 18+
- **UI Library**: Bootstrap 5 (mobile-first)
- **Routing**: React Router v6
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Real-time**: Socket.IO Client
- **Chord Parsing**: Custom ChordPro parser
- **Offline Storage**: LocalStorage / IndexedDB

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **ORM**: Sequelize
- **Authentication**: JWT (jsonwebtoken)
- **Real-time**: Socket.IO
- **File Upload**: Multer
- **Validation**: Joi or Express-validator

### Infrastructure
- **Cloud Storage**: AWS S3 or similar (for PDFs/images)
- **Deployment**: Docker containers
- **Environment**: Development, Staging, Production

## Project Structure

```
soluflow/
├── client/                      # React frontend
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json        # PWA manifest
│   ├── src/
│   │   ├── assets/              # Images, fonts
│   │   ├── components/          # Reusable UI components
│   │   │   ├── common/          # Buttons, inputs, modals
│   │   │   ├── layout/          # Header, footer, nav
│   │   │   ├── songs/           # Song display components
│   │   │   └── services/        # Service-related components
│   │   ├── pages/               # Page components
│   │   │   ├── Home.jsx
│   │   │   ├── Service.jsx
│   │   │   ├── Library.jsx
│   │   │   ├── Login.jsx
│   │   │   └── SongView.jsx
│   │   ├── context/             # React Context
│   │   │   ├── AuthContext.jsx
│   │   │   ├── ServiceContext.jsx
│   │   │   └── SocketContext.jsx
│   │   ├── hooks/               # Custom hooks
│   │   │   ├── useAuth.js
│   │   │   ├── useSocket.js
│   │   │   └── useTranspose.js
│   │   ├── services/            # API services
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   ├── songService.js
│   │   │   └── serviceService.js
│   │   ├── utils/               # Helper functions
│   │   │   ├── chordParser.js
│   │   │   ├── transposer.js
│   │   │   └── nashvilleNumbers.js
│   │   ├── App.jsx
│   │   └── index.js
│   └── package.json
│
├── server/                      # Node.js backend
│   ├── config/
│   │   ├── database.js          # DB configuration
│   │   └── socket.js            # Socket.IO config
│   ├── controllers/             # Route handlers
│   │   ├── authController.js
│   │   ├── songController.js
│   │   ├── serviceController.js
│   │   └── userController.js
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   ├── roles.js             # Role-based access
│   │   └── upload.js            # File upload handling
│   ├── models/                  # Sequelize models
│   │   ├── User.js
│   │   ├── Song.js
│   │   ├── Service.js
│   │   ├── ServiceSong.js
│   │   ├── Note.js
│   │   └── index.js
│   ├── routes/                  # API routes
│   │   ├── auth.js
│   │   ├── songs.js
│   │   ├── services.js
│   │   └── users.js
│   ├── sockets/                 # Socket.IO handlers
│   │   ├── serviceSocket.js
│   │   └── syncHandlers.js
│   ├── utils/
│   │   ├── jwt.js
│   │   └── validators.js
│   ├── app.js                   # Express app
│   ├── server.js                # Entry point
│   └── package.json
│
├── docs/                        # Documentation
│   ├── API.md                   # API endpoints
│   ├── DATABASE.md              # Database schema
│   └── SOCKET_EVENTS.md         # Socket event specs
│
└── README.md
```

## Data Flow Patterns

### 1. Authentication Flow
```
User → Login Page → POST /api/auth/login → JWT Token → Store in Context → Protected Routes
```

### 2. Service Sync Flow (Real-time)
```
Leader Actions → Socket.IO Emit → Server Broadcast → All Followers Update → UI Re-render
```

### 3. Song Transposition Flow
```
User Transpose → Local Calculation → Update State → (If Leader) → Broadcast via Socket
```

### 4. Offline-First Flow
```
API Request → Check Network → If Online: Fetch + Cache → If Offline: Read Cache
```

## Security Considerations

1. **Authentication**: JWT tokens with short expiration (1 hour access, 7 day refresh)
2. **Authorization**: Role-based middleware for protected routes
3. **Guest Access**: Temporary tokens for shareable links (no DB persistence)
4. **File Upload**: Validate file types, size limits (2MB), scan for malware
5. **SQL Injection**: Use parameterized queries via Sequelize
6. **XSS Protection**: Sanitize user input, use Content Security Policy
7. **Rate Limiting**: Implement rate limiting on API endpoints

## Performance Optimization

1. **Frontend**:
   - Code splitting by route
   - Lazy loading for large components
   - Debounce search inputs
   - Virtual scrolling for large song lists
   - Service Worker for offline caching

2. **Backend**:
   - Database indexing on frequently queried fields
   - Query optimization with Sequelize includes
   - Redis caching for frequently accessed data (future)
   - CDN for static assets

3. **Real-time**:
   - Socket.IO rooms for service-specific broadcasts
   - Throttle rapid events (e.g., transpose changes)

## Scalability Considerations

- **Horizontal Scaling**: Stateless backend enables load balancing
- **Socket.IO Adapter**: Redis adapter for multi-server Socket.IO (future)
- **Database**: Read replicas for scaling reads (future)
- **CDN**: Static assets served via CDN
- **Monitoring**: Application logging and error tracking (Sentry, LogRocket)

## Mobile-First Approach

1. **Responsive Breakpoints**:
   - Mobile: < 768px (primary target)
   - Tablet: 768px - 1024px
   - Desktop: > 1024px

2. **Touch Optimization**:
   - Minimum tap target: 44px × 44px
   - Swipe gestures for navigation
   - Pull-to-refresh

3. **Performance**:
   - Minimize bundle size (< 500KB initial)
   - Optimize images (WebP format)
   - Fast initial load (< 3s on 3G)

## Development Phases

**Phase 1**: Architecture & Planning (Current)
**Phase 2**: Project scaffolding & basic UI
**Phase 3**: Backend API & database
**Phase 4**: Core features (songs, services, transpose)
**Phase 5**: Real-time sync & leader mode
**Phase 6**: Polish, testing, optimization
**Phase 7**: Deployment & beta testing
