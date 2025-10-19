# Solu Flow - API Documentation

## Base URL
```
Development: http://localhost:5000/api
Production: https://api.soluflow.com/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Token Types
1. **User Token**: Standard JWT for registered users
2. **Guest Token**: Temporary JWT for service guests (read-only)

---

## API Endpoints

### Authentication

#### POST /auth/register
Register a new user (workspace admin only).

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "username": "John Doe",
  "role": "member",
  "workspaceId": 1
}
```

**Response** (201):
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "John Doe",
    "role": "member"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### POST /auth/login
Authenticate user and receive JWT token.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response** (200):
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "John Doe",
    "role": "member",
    "workspaceId": 1
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors**:
- 401: Invalid credentials
- 404: User not found

---

#### POST /auth/guest
Authenticate as guest using service code.

**Request Body**:
```json
{
  "code": "X4K9"
}
```

**Response** (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "service": {
    "id": 5,
    "title": "15/10 OasisChurch",
    "date": "2025-10-15"
  }
}
```

**Errors**:
- 404: Invalid code
- 403: Service not public

---

#### GET /auth/me
Get current user information.

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "John Doe",
  "role": "member",
  "workspaceId": 1
}
```

---

### Songs

#### GET /songs
Get all songs in workspace (with optional search/filter).

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `search` (optional): Search by title or author
- `key` (optional): Filter by musical key
- `limit` (optional): Results per page (default: 50)
- `offset` (optional): Pagination offset

**Response** (200):
```json
{
  "songs": [
    {
      "id": 1,
      "title": "Bamidbar",
      "authors": "Solu Team",
      "key": "Eb",
      "bpm": 105,
      "timeSig": "4/4",
      "createdAt": "2025-10-01T10:00:00Z"
    }
  ],
  "total": 150
}
```

---

#### GET /songs/:id
Get single song with full content.

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "id": 1,
  "title": "Bamidbar",
  "content": "{title: Bamidbar}\n{key: Eb}\n...",
  "key": "Eb",
  "bpm": 105,
  "timeSig": "4/4",
  "authors": "Solu Team",
  "copyrightInfo": "© 2024 Solu",
  "createdBy": 3,
  "createdAt": "2025-10-01T10:00:00Z",
  "updatedAt": "2025-10-01T10:00:00Z"
}
```

---

#### POST /songs
Create a new song (planner/admin only).

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "title": "New Song",
  "content": "{title: New Song}\n{key: C}\n\n{soc: Verse 1}\n[C]Lyrics here...\n{eoc}",
  "key": "C",
  "bpm": 120,
  "timeSig": "4/4",
  "authors": "John Doe",
  "copyrightInfo": "Public Domain"
}
```

**Response** (201):
```json
{
  "id": 42,
  "title": "New Song",
  "key": "C",
  "createdAt": "2025-10-15T14:30:00Z"
}
```

**Errors**:
- 403: Insufficient permissions
- 400: Validation error

---

#### PUT /songs/:id
Update existing song (planner/admin only).

**Headers**: `Authorization: Bearer <token>`

**Request Body**: Same as POST /songs

**Response** (200):
```json
{
  "id": 42,
  "title": "Updated Song",
  "updatedAt": "2025-10-15T15:00:00Z"
}
```

---

#### DELETE /songs/:id
Delete a song (admin only).

**Headers**: `Authorization: Bearer <token>`

**Response** (204): No content

**Errors**:
- 403: Insufficient permissions
- 404: Song not found

---

### Services

#### GET /services
Get all services in workspace.

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `upcoming` (optional): Filter upcoming services (true/false)
- `archived` (optional): Include archived (true/false)

**Response** (200):
```json
{
  "services": [
    {
      "id": 5,
      "title": "15/10 OasisChurch",
      "date": "2025-10-15",
      "time": "19:00:00",
      "location": "Oasis Church",
      "leaderId": 2,
      "leaderName": "Jane Smith",
      "code": "X4K9",
      "isPublic": true,
      "createdAt": "2025-10-01T10:00:00Z"
    }
  ]
}
```

---

#### GET /services/:id
Get single service with full set list.

**Headers**: `Authorization: Bearer <token>` (or guest token)

**Response** (200):
```json
{
  "id": 5,
  "title": "15/10 OasisChurch",
  "date": "2025-10-15",
  "time": "19:00:00",
  "location": "Oasis Church",
  "leaderId": 2,
  "leaderName": "Jane Smith",
  "code": "X4K9",
  "isPublic": true,
  "setList": [
    {
      "id": 1,
      "position": 0,
      "segmentType": "song",
      "song": {
        "id": 12,
        "title": "Bamidbar",
        "key": "Eb",
        "bpm": 105
      },
      "notes": "Start slow, build up"
    },
    {
      "id": 2,
      "position": 1,
      "segmentType": "prayer",
      "segmentTitle": "Opening Prayer",
      "segmentContent": "Prayer text here..."
    }
  ],
  "createdAt": "2025-10-01T10:00:00Z"
}
```

---

#### POST /services
Create a new service (planner/admin only).

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "title": "20/10 Venue1",
  "date": "2025-10-20",
  "time": "19:00",
  "location": "Venue 1",
  "leaderId": 2,
  "isPublic": true
}
```

**Response** (201):
```json
{
  "id": 6,
  "title": "20/10 Venue1",
  "code": "B7M3",
  "createdAt": "2025-10-15T14:00:00Z"
}
```

---

#### PUT /services/:id
Update service details (planner/admin only).

**Headers**: `Authorization: Bearer <token>`

**Request Body**: Same as POST /services

**Response** (200):
```json
{
  "id": 6,
  "title": "Updated Service",
  "updatedAt": "2025-10-15T15:00:00Z"
}
```

---

#### DELETE /services/:id
Delete a service (admin only).

**Headers**: `Authorization: Bearer <token>`

**Response** (204): No content

---

#### POST /services/:id/songs
Add song to service set list (planner/admin only).

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "songId": 12,
  "position": 0,
  "segmentType": "song",
  "notes": "Repeat bridge 2x"
}
```

**Response** (201):
```json
{
  "id": 10,
  "serviceId": 5,
  "songId": 12,
  "position": 0
}
```

---

#### PUT /services/:id/songs/:songId
Update song position or notes in set list.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "position": 2,
  "notes": "Updated notes"
}
```

**Response** (200):
```json
{
  "id": 10,
  "position": 2,
  "updatedAt": "2025-10-15T15:00:00Z"
}
```

---

#### DELETE /services/:id/songs/:songId
Remove song from service set list.

**Headers**: `Authorization: Bearer <token>`

**Response** (204): No content

---

#### POST /services/:id/segments
Add non-song segment (prayer, reading, break).

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "position": 1,
  "segmentType": "prayer",
  "segmentTitle": "Opening Prayer",
  "segmentContent": "Prayer text here..."
}
```

**Response** (201):
```json
{
  "id": 11,
  "serviceId": 5,
  "segmentType": "prayer",
  "position": 1
}
```

---

### Notes

#### GET /notes
Get all user's notes (optionally filtered by song/service).

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `songId` (optional): Filter by song
- `serviceId` (optional): Filter by service

**Response** (200):
```json
{
  "notes": [
    {
      "id": 1,
      "songId": 12,
      "serviceId": 5,
      "content": "Play softly on verse 1",
      "isVisible": true,
      "createdAt": "2025-10-10T12:00:00Z"
    }
  ]
}
```

---

#### POST /notes
Create or update a note.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "songId": 12,
  "serviceId": 5,
  "content": "Remember to play capo 2",
  "isVisible": true
}
```

**Response** (201):
```json
{
  "id": 2,
  "songId": 12,
  "serviceId": 5,
  "content": "Remember to play capo 2",
  "isVisible": true,
  "createdAt": "2025-10-15T14:00:00Z"
}
```

---

#### PUT /notes/:id
Update note content or visibility.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "content": "Updated note",
  "isVisible": false
}
```

**Response** (200):
```json
{
  "id": 2,
  "content": "Updated note",
  "isVisible": false,
  "updatedAt": "2025-10-15T15:00:00Z"
}
```

---

#### DELETE /notes/:id
Delete a note.

**Headers**: `Authorization: Bearer <token>`

**Response** (204): No content

---

### Users

#### GET /users
Get all users in workspace (admin only).

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "users": [
    {
      "id": 1,
      "email": "user@example.com",
      "username": "John Doe",
      "role": "member",
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

#### PUT /users/:id
Update user details (admin only).

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "username": "Updated Name",
  "role": "leader",
  "isActive": true
}
```

**Response** (200):
```json
{
  "id": 1,
  "username": "Updated Name",
  "role": "leader",
  "updatedAt": "2025-10-15T15:00:00Z"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "details": "Additional context (optional)"
}
```

### HTTP Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `204 No Content`: Successful deletion
- `400 Bad Request`: Validation error or malformed request
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate email)
- `500 Internal Server Error`: Server error

---

## Rate Limiting

- **Authenticated users**: 100 requests per minute
- **Guest users**: 50 requests per minute
- **Login attempts**: 5 attempts per 15 minutes per IP

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634567890
```

---

## Pagination

List endpoints support pagination via query parameters:

- `limit`: Results per page (default: 50, max: 100)
- `offset`: Number of results to skip

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## CORS

CORS is enabled for:
- Development: `http://localhost:3000`
- Production: `https://app.soluflow.com`

Allowed methods: GET, POST, PUT, DELETE, OPTIONS

---

## Versioning

API version is included in the base URL:
```
/api/v1/...
```

Future versions will be backward compatible for at least 6 months.
