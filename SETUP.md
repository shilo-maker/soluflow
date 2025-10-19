# Solu Flow - Setup Guide

## ✅ What's Been Built (Stages 1-4 Complete)

### Stage 1: Planning & Architecture ✓
- Complete database schema with 6 tables
- API endpoint specifications
- Socket.IO event definitions
- System architecture documentation

### Stage 2: Project Scaffolding ✓
- React frontend with routing
- Node.js/Express backend
- Socket.IO integration
- All dependencies installed

### Stage 3: UI Mockups ✓
- Home page with services and search
- Library page (song search results)
- Service page with set list
- Song view page with Hebrew RTL support
- Bottom navigation and header

### Stage 4: Backend Foundation ✓
- **Database Models**: Workspace, User, Song, Service, ServiceSong, Note
- **Authentication**: JWT-based login/register/guest auth
- **Middleware**: Auth verification, role-based permissions
- **API Routes**: /api/auth/* endpoints
- **Password Security**: Bcrypt hashing
- **Database Seeding Script**: Ready to populate test data

---

## 🔧 Next Steps: Database Setup

To fully test the backend, you need to set up PostgreSQL:

### Option 1: Install PostgreSQL Locally

1. **Download PostgreSQL** (v14 or higher):
   - Windows: https://www.postgresql.org/download/windows/
   - During installation, remember your password for the `postgres` user

2. **Create Database**:
   ```bash
   # Open psql command line or pgAdmin
   CREATE DATABASE soluflow;
   ```

3. **Update Environment Variables**:
   Edit `server/.env`:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=soluflow
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   ```

4. **Seed Database**:
   ```bash
   cd server
   node utils/seedDatabase.js
   ```

### Option 2: Use Docker (Recommended for Development)

1. **Install Docker Desktop**: https://www.docker.com/products/docker-desktop

2. **Run PostgreSQL Container**:
   ```bash
   docker run --name soluflow-db \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=soluflow \
     -p 5432:5432 \
     -d postgres:14
   ```

3. **Seed Database**:
   ```bash
   cd server
   node utils/seedDatabase.js
   ```

---

## 🚀 Running the Application

### Start Backend Server
```bash
cd server
npm run dev  # Uses nodemon for auto-reload
```

The backend will:
- Connect to PostgreSQL
- Create/sync database tables
- Start server on http://localhost:5001

### Start Frontend
```bash
cd client
npm start
```

Frontend runs on http://localhost:3001

---

## 🧪 Testing the Backend API

Once the database is running, you can test these endpoints:

### 1. Health Check
```bash
curl http://localhost:5001/api/health
```

### 2. Login (after seeding database)
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@oasis.com","password":"password123"}'
```

### 3. Guest Auth
```bash
curl -X POST http://localhost:5001/api/auth/guest \
  -H "Content-Type: application/json" \
  -d '{"code":"X4K9"}'
```

### 4. Get User Info
```bash
curl http://localhost:5001/api/auth/me \
  -H "Authorization: Bearer <your_token_here>"
```

---

## 📊 Test Credentials (After Seeding)

**Admin**:
- Email: `admin@oasis.com`
- Password: `password123`

**Planner**:
- Email: `planner@oasis.com`
- Password: `password123`

**Member**:
- Email: `john@oasis.com`
- Password: `password123`

**Guest Code**: `X4K9` (for service access)

---

## 📁 Project Structure

```
soluflow/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client
│   │   └── mockData.js     # Mock data for UI
│   └── package.json
│
├── server/                 # Node.js backend
│   ├── config/
│   │   └── database.js     # DB configuration
│   ├── controllers/
│   │   └── authController.js
│   ├── middleware/
│   │   ├── auth.js         # JWT verification
│   │   └── roles.js        # Role-based access
│   ├── models/             # Sequelize models
│   │   ├── User.js
│   │   ├── Workspace.js
│   │   ├── Song.js
│   │   ├── Service.js
│   │   ├── ServiceSong.js
│   │   ├── Note.js
│   │   └── index.js        # Model associations
│   ├── routes/
│   │   └── auth.js         # Auth routes
│   ├── utils/
│   │   ├── jwt.js          # JWT utilities
│   │   └── seedDatabase.js # Database seeding
│   ├── server.js           # Entry point
│   └── package.json
│
└── docs/                   # Documentation
    ├── ARCHITECTURE.md
    ├── DATABASE.md
    ├── API.md
    └── SOCKET_EVENTS.md
```

---

## 🎯 Current Status

**Frontend**: ✅ Fully functional with mock data (http://localhost:3001)
**Backend**: ⚠️ Ready but needs PostgreSQL to run
**Database**: ⏳ Needs to be set up (see above)

---

## 🔜 Next Stages

**Stage 5**: Implement core functionality
- Song CRUD operations
- Service CRUD operations
- Notes system
- Transposition logic

**Stage 6**: Real-time sync with Socket.IO
- Leader/follower mode
- Live transposition broadcast
- Multi-user synchronization

**Stage 7**: Mobile optimization & PWA
- Offline caching
- Service worker
- Performance optimization

---

## ❓ Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `pg_isready`
- Verify `.env` database credentials
- Check port 5001 is not in use

### Database connection error
- Ensure PostgreSQL service is running
- Verify database name matches `.env`
- Check firewall isn't blocking port 5432

### Frontend displays mock data
- This is expected until backend API is connected
- Backend integration happens in Stage 5

---

Need help? Check the documentation in the `/docs` folder!
