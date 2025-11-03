# SoluFlow Integration API Documentation

This document describes how to integrate external applications (like SoluEvents) with SoluFlow's worship team management features.

## Overview

The Integration API allows external applications to:
- Search for songs in SoluFlow's database
- Retrieve song details
- Create worship services with setlists
- Access user workspaces

## Base URL

- **Development**: `http://localhost:5002/api/integration`
- **Production**: `https://soluflow.app/api/integration`

## Authentication

The Integration API supports two authentication methods:

### Method 1: API Key (Recommended for Server-to-Server)

Add the API key as a header in your requests:

```http
X-API-Key: your-api-key-here
```

**Setup**: Add `INTEGRATION_API_KEY` to your SoluFlow `.env` file:
```env
INTEGRATION_API_KEY=your-secure-random-key-here
```

Generate a secure key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Method 2: JWT Bearer Token (For User-Specific Operations)

Use the user's SoluFlow authentication token:

```http
Authorization: Bearer user-jwt-token
```

This method provides access to the user's personal songs and workspaces.

---

## API Endpoints

### 1. Health Check

Check if the Integration API is running.

**Endpoint**: `GET /api/integration/health`

**Authentication**: None required

**Response**:
```json
{
  "success": true,
  "message": "SoluFlow Integration API is running",
  "version": "1.0.0",
  "endpoints": {
    "search": "GET /api/integration/songs/search?q=query&limit=10",
    "getSong": "GET /api/integration/songs/:id",
    "createService": "POST /api/integration/services",
    "getWorkspaces": "GET /api/integration/workspaces"
  }
}
```

---

### 2. Search Songs

Search for songs with autocomplete support.

**Endpoint**: `GET /api/integration/songs/search`

**Authentication**: Optional (JWT or API Key)
- Without auth: Returns only public songs
- With auth: Returns public songs + user's private songs

**Query Parameters**:
- `q` (string, optional): Search query (searches title and authors)
- `limit` (number, optional, default: 10): Maximum results to return

**Example Request**:
```javascript
fetch('http://localhost:5002/api/integration/songs/search?q=kadosh&limit=5', {
  headers: {
    'X-API-Key': 'your-api-key'
  }
})
```

**Response**:
```json
{
  "success": true,
  "songs": [
    {
      "id": 123,
      "title": "Kadosh",
      "authors": "Paul Wilbur",
      "key": "Em",
      "bpm": 140,
      "timeSignature": "4/4",
      "code": "ABC123",
      "listenUrl": "https://youtube.com/watch?v=...",
      "creator": "shilo",
      "workspace": "My Worship Team"
    }
  ],
  "count": 1
}
```

---

### 3. Get Song Details

Retrieve full details for a specific song.

**Endpoint**: `GET /api/integration/songs/:id`

**Authentication**: Optional (JWT or API Key)

**URL Parameters**:
- `id` (number): Song ID

**Example Request**:
```javascript
fetch('http://localhost:5002/api/integration/songs/123', {
  headers: {
    'X-API-Key': 'your-api-key'
  }
})
```

**Response**:
```json
{
  "success": true,
  "song": {
    "id": 123,
    "title": "Kadosh",
    "content": "[Verse 1]\nKadosh kadosh kadosh...",
    "authors": "Paul Wilbur",
    "key": "Em",
    "bpm": 140,
    "timeSignature": "4/4",
    "copyrightInfo": "© 2001 Integrity Music",
    "code": "ABC123",
    "listenUrl": "https://youtube.com/watch?v=...",
    "creator": "shilo",
    "workspace": "My Worship Team"
  }
}
```

---

### 4. Get User Workspaces

Retrieve all workspaces the authenticated user has access to.

**Endpoint**: `GET /api/integration/workspaces`

**Authentication**: Required (JWT Token)

**Example Request**:
```javascript
fetch('http://localhost:5002/api/integration/workspaces', {
  headers: {
    'Authorization': 'Bearer user-jwt-token'
  }
})
```

**Response**:
```json
{
  "success": true,
  "workspaces": [
    {
      "id": 1,
      "name": "My Worship Team",
      "type": "worship_team",
      "role": "admin"
    },
    {
      "id": 2,
      "name": "Community Church",
      "type": "church",
      "role": "member"
    }
  ]
}
```

---

### 5. Create Service (Setlist)

Create a new worship service with a setlist of songs.

**Endpoint**: `POST /api/integration/services`

**Authentication**: Required (JWT Token)

**Request Body**:
```json
{
  "name": "Sunday Morning Service",
  "date": "2025-11-10T10:00:00Z",
  "songIds": [123, 456, 789],
  "notes": "Special event for Hanukkah celebration",
  "workspaceId": 1
}
```

**Fields**:
- `name` (string, required): Service name
- `date` (string, required): ISO 8601 date/time
- `songIds` (array of numbers, optional): Song IDs in order
- `notes` (string, optional): Service notes
- `workspaceId` (number, optional): Target workspace (uses user's default if not specified)

**Example Request**:
```javascript
fetch('http://localhost:5002/api/integration/services', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer user-jwt-token'
  },
  body: JSON.stringify({
    name: "Hanukkah Celebration",
    date: "2025-11-10T18:00:00Z",
    songIds: [123, 456, 789],
    notes: "Festival of Lights special service"
  })
})
```

**Response**:
```json
{
  "success": true,
  "service": {
    "id": 42,
    "name": "Hanukkah Celebration",
    "date": "2025-11-10T18:00:00.000Z",
    "code": "XYZ789",
    "leader": "shilo",
    "songs": [
      {
        "id": 123,
        "title": "Kadosh",
        "authors": "Paul Wilbur",
        "key": "Em",
        "bpm": 140,
        "position": 0,
        "transposition": 0
      }
    ],
    "shareUrl": "http://localhost:3000/service/XYZ789"
  },
  "message": "Service created successfully from SoluEvents"
}
```

---

## Integration Examples

### Example 1: Song Search Autocomplete (React)

```javascript
import { useState, useEffect } from 'react';

function SongSearchInput({ onSelectSong }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `http://localhost:5002/api/integration/songs/search?q=${encodeURIComponent(query)}&limit=10`,
          {
            headers: {
              'X-API-Key': process.env.REACT_APP_SOLUFLOW_API_KEY
            }
          }
        );
        const data = await response.json();

        if (data.success) {
          setSuggestions(data.songs);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="song-search">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search SoluFlow songs..."
      />

      {loading && <div>Searching...</div>}

      {suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map(song => (
            <li
              key={song.id}
              onClick={() => {
                onSelectSong(song);
                setQuery('');
                setSuggestions([]);
              }}
            >
              <strong>{song.title}</strong>
              {song.authors && <span> - {song.authors}</span>}
              {song.key && <span> ({song.key})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default SongSearchInput;
```

### Example 2: Create Service from Event Program

```javascript
async function createSoluFlowService(eventData, userToken) {
  try {
    const response = await fetch('http://localhost:5002/api/integration/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        name: eventData.eventName,
        date: eventData.eventDate,
        songIds: eventData.selectedSongs.map(s => s.id),
        notes: `Created from SoluEvents - ${eventData.description || ''}`,
        workspaceId: eventData.workspaceId // Optional
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('Service created:', data.service);
      console.log('Share URL:', data.service.shareUrl);

      // Optionally, save the service code to link back to SoluFlow
      return {
        serviceId: data.service.id,
        serviceCode: data.service.code,
        shareUrl: data.service.shareUrl
      };
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Failed to create SoluFlow service:', error);
    throw error;
  }
}

// Usage
const result = await createSoluFlowService({
  eventName: "Hanukkah Celebration 2025",
  eventDate: "2025-11-10T18:00:00Z",
  selectedSongs: [
    { id: 123, title: "Kadosh" },
    { id: 456, title: "Hine Ma Tov" },
    { id: 789, title: "Baruch Haba" }
  ],
  description: "Festival of Lights celebration"
}, userJwtToken);

console.log(`Service created! Share: ${result.shareUrl}`);
```

### Example 3: Full Integration Flow

```javascript
// SoluEvents Component
import { useState } from 'react';

function EventProgramEditor() {
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [eventData, setEventData] = useState({
    name: '',
    date: '',
    description: ''
  });

  const handleSelectSong = (song) => {
    setSelectedSongs([...selectedSongs, {
      id: song.id,
      title: song.title,
      authors: song.authors,
      key: song.key,
      soluflowData: song // Store full SoluFlow data
    }]);
  };

  const handleCreateService = async () => {
    try {
      // Create service in SoluFlow
      const result = await createSoluFlowService({
        eventName: eventData.name,
        eventDate: eventData.date,
        selectedSongs: selectedSongs,
        description: eventData.description
      }, localStorage.getItem('userToken'));

      // Save the link in your event
      await saveEventProgram({
        ...eventData,
        songs: selectedSongs,
        soluflowServiceId: result.serviceId,
        soluflowServiceUrl: result.shareUrl
      });

      alert(`Event created! SoluFlow service: ${result.shareUrl}`);
    } catch (error) {
      alert('Failed to create service: ' + error.message);
    }
  };

  return (
    <div>
      <h2>Event Program</h2>

      <input
        type="text"
        placeholder="Event Name"
        value={eventData.name}
        onChange={(e) => setEventData({...eventData, name: e.target.value})}
      />

      <input
        type="datetime-local"
        value={eventData.date}
        onChange={(e) => setEventData({...eventData, date: e.target.value})}
      />

      <h3>Songs</h3>
      <SongSearchInput onSelectSong={handleSelectSong} />

      <ul>
        {selectedSongs.map((song, index) => (
          <li key={index}>
            {song.title} - {song.authors} ({song.key})
          </li>
        ))}
      </ul>

      <button onClick={handleCreateService}>
        Create SoluFlow Service
      </button>
    </div>
  );
}
```

---

## CORS Configuration

SoluEvents is already whitelisted for local development:
- `http://localhost:3003`
- `http://10.100.102.27:3003`

For production, add your SoluEvents production URL to the `.env` file:
```env
SOLU_EVENTS_URL=https://your-solu-events-domain.com
```

---

## Error Handling

All endpoints return a consistent error format:

```json
{
  "success": false,
  "error": "Error message here",
  "details": "Additional details if available"
}
```

**Common HTTP Status Codes**:
- `200` - Success
- `201` - Created (for POST requests)
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid auth)
- `403` - Forbidden (no access to resource)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

The Integration API uses the same rate limits as the main SoluFlow API:
- **Global**: 1000 requests per 15 minutes per IP
- **Authentication endpoints**: 20 requests per 15 minutes

---

## Security Best Practices

1. **Never expose API keys in client-side code** - Use environment variables
2. **Use HTTPS in production** - SoluFlow production uses HTTPS
3. **Validate user input** - Always sanitize and validate data before sending
4. **Handle errors gracefully** - Don't expose sensitive error details to users
5. **Store tokens securely** - Use secure storage (httpOnly cookies, encrypted storage)

---

## Support

For issues or questions about the Integration API:
- GitHub Issues: https://github.com/yourusername/soluflow/issues
- Email: support@soluflow.app

---

## Changelog

### v1.0.0 (2025-11-03)
- Initial release
- Song search endpoint
- Get song details endpoint
- Create service endpoint
- Get workspaces endpoint
- API key authentication
- JWT authentication support
