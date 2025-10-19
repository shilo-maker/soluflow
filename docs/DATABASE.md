# Solu Flow - Database Schema

## Entity Relationship Diagram

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    User     │         │  Workspace  │         │    Song     │
├─────────────┤         ├─────────────┤         ├─────────────┤
│ id (PK)     │────┐    │ id (PK)     │    ┌────│ id (PK)     │
│ workspace_id│    │    │ name        │    │    │ workspace_id│
│ email       │    └───▶│ created_at  │◀───┘    │ title       │
│ password    │         └─────────────┘         │ content     │
│ username    │                                  │ key         │
│ role        │         ┌─────────────┐         │ bpm         │
│ created_at  │         │   Service   │         │ time_sig    │
└─────────────┘         ├─────────────┤         │ authors     │
       │                │ id (PK)     │         │ created_by  │
       │                │ workspace_id│         │ created_at  │
       │                │ title       │         └──────┬──────┘
       │                │ date        │                │
       │                │ leader_id   │◀───────────────┤
       │                │ code        │                │
       │                │ created_by  │         ┌──────▼──────┐
       │                │ is_public   │         │ServiceSong  │
       │                │ created_at  │         ├─────────────┤
       │                └──────┬──────┘         │ id (PK)     │
       │                       │                │ service_id  │
       │                       │                │ song_id     │
       │                       └───────────────▶│ position    │
       │                                        │ segment_type│
       │                                        │ notes       │
       └──────────────────┐                    └─────────────┘
                          │
                   ┌──────▼──────┐
                   │    Note     │
                   ├─────────────┤
                   │ id (PK)     │
                   │ user_id     │
                   │ song_id     │
                   │ service_id  │
                   │ content     │
                   │ created_at  │
                   │ updated_at  │
                   └─────────────┘
```

## Table Definitions

### 1. Workspaces
Represents an organization or team workspace.

```sql
CREATE TABLE workspaces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workspaces_slug ON workspaces(slug);
```

**Fields**:
- `id`: Unique identifier
- `name`: Workspace display name (e.g., "Oasis Church")
- `slug`: URL-friendly identifier (e.g., "oasis-church")
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 2. Users
All registered users (Admin, Planner, Leader, Member).

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'planner', 'leader', 'member')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_workspace ON users(workspace_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

**Fields**:
- `id`: Unique identifier
- `workspace_id`: Reference to workspace
- `email`: Unique email address
- `password_hash`: Bcrypt hashed password
- `username`: Display name
- `role`: User role (admin, planner, leader, member)
- `is_active`: Account status
- `created_at`: Registration timestamp
- `updated_at`: Last profile update

**Roles**:
- `admin`: Full workspace control
- `planner`: Create/manage services and songs
- `leader`: Control service flow during live sessions
- `member`: View and participate in services

---

### 3. Songs
Song library with chords, lyrics, and metadata.

```sql
CREATE TABLE songs (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,  -- ChordPro format
  key VARCHAR(10),         -- E, C#m, etc.
  bpm INTEGER,
  time_signature VARCHAR(10),  -- 4/4, 6/8, etc.
  authors VARCHAR(255),
  copyright_info TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_songs_workspace ON songs(workspace_id);
CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_key ON songs(key);
CREATE FULLTEXT INDEX idx_songs_search ON songs(title, authors);
```

**Fields**:
- `id`: Unique identifier
- `workspace_id`: Reference to workspace
- `title`: Song title
- `content`: Song content in ChordPro format (chords + lyrics)
- `key`: Musical key (e.g., "E", "C#m")
- `bpm`: Beats per minute
- `time_signature`: Time signature (e.g., "4/4")
- `authors`: Songwriters/composers
- `copyright_info`: Copyright and licensing info
- `created_by`: User who added the song
- `created_at`: Creation timestamp
- `updated_at`: Last edit timestamp

**ChordPro Format Example**:
```
{title: Bamidbar}
{key: Eb}
{bpm: 105}
{time: 4/4}

{soc: Verse 1}
[Cm]במדבר קול קורא [Bb]כאן ב[Ab]מדבר
הוא [Eb]יצילה ל[Ab]נו
{eoc}

{soc: Chorus}
[Cm]סולו לו ד[Bb]רך, י[Ab]שר לו מ[Eb]סילה
{eoc}
```

---

### 4. Services
Planned worship services (set lists).

```sql
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  date DATE,
  time TIME,
  location VARCHAR(255),
  leader_id INTEGER REFERENCES users(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  code VARCHAR(20) UNIQUE,  -- For shareable guest links (e.g., "X4K9")
  is_public BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_services_workspace ON services(workspace_id);
CREATE INDEX idx_services_date ON services(date);
CREATE INDEX idx_services_code ON services(code);
CREATE INDEX idx_services_leader ON services(leader_id);
```

**Fields**:
- `id`: Unique identifier
- `workspace_id`: Reference to workspace
- `title`: Service title (e.g., "15/10 OasisChurch")
- `date`: Service date
- `time`: Service time
- `location`: Venue name
- `leader_id`: User assigned as leader
- `created_by`: User who created the service
- `code`: Short code for guest access (e.g., "X4K9")
- `is_public`: Whether guests can access via link
- `is_archived`: Archived services
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

---

### 5. Service_Songs
Junction table connecting services and songs (set list order).

```sql
CREATE TABLE service_songs (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  song_id INTEGER REFERENCES songs(id) ON DELETE SET NULL,
  position INTEGER NOT NULL,  -- Order in set list
  segment_type VARCHAR(50) DEFAULT 'song',  -- 'song', 'prayer', 'reading', 'break'
  segment_title VARCHAR(255),  -- For non-song items
  segment_content TEXT,        -- Content for prayers/readings
  notes TEXT,                  -- Planner notes for this item
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_service_songs_service ON service_songs(service_id);
CREATE INDEX idx_service_songs_position ON service_songs(service_id, position);
CREATE INDEX idx_service_songs_song ON service_songs(song_id);
```

**Fields**:
- `id`: Unique identifier
- `service_id`: Reference to service
- `song_id`: Reference to song (nullable for non-song items)
- `position`: Order in the set list (0, 1, 2, ...)
- `segment_type`: Type of item (song, prayer, reading, break)
- `segment_title`: Title for non-song segments
- `segment_content`: Text content for prayers/readings
- `notes`: Planner's notes (e.g., "Repeat bridge 2x")
- `created_at`: When added to service

**Segment Types**:
- `song`: Regular song from library
- `prayer`: Prayer text
- `reading`: Scripture or reading
- `break`: Break or transition marker

---

### 6. Notes
Personal notes users add to songs (per service context).

```sql
CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,  -- Optional: note for specific service
  content TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT true,  -- Toggle on/off during performance
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, song_id, service_id)
);

CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_song ON notes(song_id);
CREATE INDEX idx_notes_service ON notes(service_id);
```

**Fields**:
- `id`: Unique identifier
- `user_id`: User who created the note
- `song_id`: Song the note applies to
- `service_id`: Optional service context (null = general note)
- `content`: Note text
- `is_visible`: Toggle for showing/hiding during performance
- `created_at`: Creation timestamp
- `updated_at`: Last edit timestamp

**Note Types**:
- **General note**: `service_id` is NULL (applies to song always)
- **Service-specific note**: `service_id` set (applies only to this service)

---

### 7. Attachments (Optional - Future)
File attachments (PDFs, images) linked to songs or services.

```sql
CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,  -- S3 or cloud storage URL
  file_type VARCHAR(50) NOT NULL,  -- 'pdf', 'image'
  file_size INTEGER NOT NULL,  -- in bytes
  linked_to_type VARCHAR(50),  -- 'song' or 'service'
  linked_to_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attachments_workspace ON attachments(workspace_id);
CREATE INDEX idx_attachments_linked ON attachments(linked_to_type, linked_to_id);
```

---

## Relationships Summary

1. **One Workspace** → Many Users
2. **One Workspace** → Many Songs
3. **One Workspace** → Many Services
4. **One User** → Many Notes
5. **One Service** → Many Service_Songs (set list)
6. **One Song** → Many Service_Songs (used in multiple services)
7. **One Song** → Many Notes (from different users)
8. **One Service** → One Leader (User)
9. **One Service** → One Creator (User)

---

## Indexes and Performance

### Primary Indexes
- All primary keys automatically indexed
- Foreign keys indexed for JOIN performance

### Additional Indexes
- `workspaces.slug` - Fast workspace lookup by URL
- `users.email` - Fast login queries
- `users.workspace_id` - Filter users by workspace
- `songs.workspace_id` - Filter songs by workspace
- `songs.title` - Search songs by title
- `services.code` - Fast guest access lookup
- `services.date` - Filter services by date
- `service_songs(service_id, position)` - Fast set list ordering

### Full-Text Search
- `songs(title, authors)` - Search songs by title and authors

---

## Sample Queries

### Get all songs in a service (in order)
```sql
SELECT ss.position, s.title, s.content, s.key, s.bpm, ss.segment_type, ss.notes
FROM service_songs ss
LEFT JOIN songs s ON ss.song_id = s.id
WHERE ss.service_id = $1
ORDER BY ss.position ASC;
```

### Get user's notes for a specific song in a service
```sql
SELECT content, is_visible
FROM notes
WHERE user_id = $1
  AND song_id = $2
  AND (service_id = $3 OR service_id IS NULL)
ORDER BY service_id DESC NULLS LAST
LIMIT 1;
```

### Search songs by title or author
```sql
SELECT id, title, authors, key
FROM songs
WHERE workspace_id = $1
  AND (title ILIKE $2 OR authors ILIKE $2)
ORDER BY title ASC;
```

### Get upcoming services for a workspace
```sql
SELECT s.id, s.title, s.date, s.time, u.username as leader_name
FROM services s
LEFT JOIN users u ON s.leader_id = u.id
WHERE s.workspace_id = $1
  AND s.date >= CURRENT_DATE
  AND s.is_archived = false
ORDER BY s.date ASC, s.time ASC;
```

---

## Database Migrations Strategy

Use Sequelize migrations for version control:

1. Initial schema setup
2. Add indexes
3. Add constraints
4. Seed default data (roles, etc.)

---

## Data Validation Rules

### User
- Email: Valid email format, unique per workspace
- Password: Min 8 characters (hashed with bcrypt)
- Role: Must be one of: admin, planner, leader, member

### Song
- Title: Required, max 255 chars
- Content: Required (ChordPro format)
- Key: Optional, max 10 chars (e.g., "C#m")
- BPM: Optional, integer 40-240

### Service
- Title: Required, max 255 chars
- Code: Auto-generated, 4-6 chars, alphanumeric, unique
- Leader: Must reference valid user

### Note
- Content: Required, max 5000 chars
- User must have access to the song/service

---

## Guest Access Implementation

**Guests do not have database records**. Instead:

1. Service with `is_public = true` and valid `code`
2. Guest enters code → Server generates temporary JWT token
3. Token includes: `{ type: 'guest', serviceId: X, exp: ... }`
4. Guest can view service and songs, but cannot save notes

**Token Expiration**: 24 hours (refresh on activity)

---

## Backup and Recovery

1. **Daily automated backups** of PostgreSQL database
2. **Point-in-time recovery** enabled (WAL archiving)
3. **Retention policy**: 30 days
4. **Test restores**: Monthly verification

---

This schema provides a solid foundation for all core features while remaining flexible for future enhancements.
