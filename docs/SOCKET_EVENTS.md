# Solu Flow - Socket.IO Events Documentation

## Overview

Socket.IO enables real-time synchronization between the leader and all followers in a service. This document defines all socket events used for:
- Leader mode (controlling what everyone sees)
- Follow mode (syncing with leader's actions)
- Real-time transposition broadcast
- Live service updates

---

## Connection & Authentication

### Client → Server: `authenticate`
Authenticate the socket connection with JWT token.

**Payload**:
```javascript
{
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**: `authenticated` or `authentication_error`

---

### Server → Client: `authenticated`
Confirms successful authentication.

**Payload**:
```javascript
{
  userId: 5,
  username: "John Doe",
  role: "member"
}
```

---

### Server → Client: `authentication_error`
Authentication failed.

**Payload**:
```javascript
{
  error: "Invalid token"
}
```

---

## Service Room Management

### Client → Server: `join_service`
Join a service room to receive real-time updates.

**Payload**:
```javascript
{
  serviceId: 5,
  followLeader: true  // Whether to sync with leader
}
```

**Response**: `service_joined` or `join_error`

---

### Server → Client: `service_joined`
Confirms user joined service room successfully.

**Payload**:
```javascript
{
  serviceId: 5,
  currentState: {
    currentSongIndex: 2,
    currentSongId: 12,
    transposedKey: "F",
    isLyricsOnly: false,
    participants: [
      { userId: 1, username: "Jane (Leader)", isLeader: true },
      { userId: 5, username: "John Doe", isLeader: false }
    ]
  }
}
```

---

### Server → Broadcast: `user_joined`
Notify all participants when someone joins.

**Payload**:
```javascript
{
  userId: 5,
  username: "John Doe",
  participantCount: 12
}
```

---

### Client → Server: `leave_service`
Leave the service room.

**Payload**:
```javascript
{
  serviceId: 5
}
```

---

### Server → Broadcast: `user_left`
Notify all participants when someone leaves.

**Payload**:
```javascript
{
  userId: 5,
  username: "John Doe",
  participantCount: 11
}
```

---

## Leader Control Events

### Client → Server: `leader_navigate`
Leader navigates to a different song/segment.

**Payload**:
```javascript
{
  serviceId: 5,
  songIndex: 3,  // Position in set list
  songId: 15
}
```

**Broadcast**: All followers receive `leader_navigated`

---

### Server → Followers: `leader_navigated`
Leader moved to a new song/segment.

**Payload**:
```javascript
{
  songIndex: 3,
  songId: 15,
  song: {
    title: "Next Song",
    content: "...",
    key: "G",
    bpm: 130
  }
}
```

**Client Action**: Followers automatically navigate to this song if `followLeader: true`

---

### Client → Server: `leader_transpose`
Leader transposes the current song.

**Payload**:
```javascript
{
  serviceId: 5,
  songId: 15,
  newKey: "A",  // Transposed to A
  semitones: 2  // Transposed up 2 semitones
}
```

**Broadcast**: All followers receive `leader_transposed`

---

### Server → Followers: `leader_transposed`
Leader changed the key.

**Payload**:
```javascript
{
  songId: 15,
  originalKey: "G",
  newKey: "A",
  semitones: 2
}
```

**Client Action**: Followers transpose their view if `followLeader: true`

---

### Client → Server: `leader_toggle_lyrics`
Leader toggles lyrics-only mode.

**Payload**:
```javascript
{
  serviceId: 5,
  songId: 15,
  isLyricsOnly: true
}
```

**Broadcast**: All followers receive `leader_toggled_lyrics`

---

### Server → Followers: `leader_toggled_lyrics`
Leader toggled lyrics-only view.

**Payload**:
```javascript
{
  songId: 15,
  isLyricsOnly: true
}
```

**Client Action**: Followers toggle to lyrics-only if `followLeader: true`

---

## Follow Mode Events

### Client → Server: `toggle_follow`
User toggles follow mode on/off.

**Payload**:
```javascript
{
  serviceId: 5,
  followLeader: false  // Enter "Free Mode"
}
```

**Response**: `follow_toggled`

---

### Server → Client: `follow_toggled`
Confirms follow mode change.

**Payload**:
```javascript
{
  followLeader: false,
  message: "You are now in Free Mode"
}
```

---

### Client → Server: `sync_with_leader`
User requests to sync back with leader (rejoin leader mode).

**Payload**:
```javascript
{
  serviceId: 5
}
```

**Response**: Server sends current leader state via `leader_state_sync`

---

### Server → Client: `leader_state_sync`
Send current leader state to re-sync a user.

**Payload**:
```javascript
{
  currentSongIndex: 3,
  currentSongId: 15,
  transposedKey: "A",
  isLyricsOnly: false
}
```

---

## Live Service Updates

### Client → Server: `add_song_live`
Leader adds a song to the set list during live service.

**Payload**:
```javascript
{
  serviceId: 5,
  songId: 20,
  position: 4  // Insert at position 4
}
```

**Broadcast**: All participants receive `song_added_live`

---

### Server → Broadcast: `song_added_live`
A song was added to the set list.

**Payload**:
```javascript
{
  songId: 20,
  song: {
    title: "Spontaneous Song",
    key: "D",
    bpm: 100
  },
  position: 4
}
```

---

### Client → Server: `remove_song_live`
Leader removes a song from the set list during live service.

**Payload**:
```javascript
{
  serviceId: 5,
  songIndex: 4
}
```

**Broadcast**: All participants receive `song_removed_live`

---

### Server → Broadcast: `song_removed_live`
A song was removed from the set list.

**Payload**:
```javascript
{
  songIndex: 4
}
```

---

## Chat / Communication Events (Future)

### Client → Server: `send_message`
Send a message to the service chat.

**Payload**:
```javascript
{
  serviceId: 5,
  message: "Repeat bridge 2x"
}
```

**Broadcast**: All participants receive `new_message`

---

### Server → Broadcast: `new_message`
New chat message in service.

**Payload**:
```javascript
{
  userId: 5,
  username: "John Doe",
  message: "Repeat bridge 2x",
  timestamp: "2025-10-15T20:30:00Z"
}
```

---

## Error Events

### Server → Client: `error`
General error event.

**Payload**:
```javascript
{
  message: "You don't have permission to control this service",
  code: "PERMISSION_DENIED"
}
```

---

### Server → Client: `join_error`
Failed to join service room.

**Payload**:
```javascript
{
  message: "Service not found or not accessible",
  code: "SERVICE_NOT_FOUND"
}
```

---

## Disconnection Handling

### Client → Server: `disconnect`
Client disconnects (automatic).

**Server Action**:
- Remove user from service room
- Broadcast `user_left` to remaining participants
- Clean up user's socket session

---

### Server → Client: `reconnect`
Client reconnects after disconnect.

**Server Action**:
- Re-authenticate user
- Re-join service room if applicable
- Send current leader state

---

## Socket.IO Rooms

Each service has a dedicated room: `service_{serviceId}`

**Example**: Service ID 5 → Room name: `service_5`

### Room Management
- Users join room on `join_service`
- Leader events broadcast to entire room
- Users leave room on `leave_service` or disconnect

---

## Client Implementation Example

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: localStorage.getItem('token')
  }
});

// Authenticate
socket.on('authenticated', (data) => {
  console.log('Authenticated as:', data.username);
});

// Join service
socket.emit('join_service', { serviceId: 5, followLeader: true });

// Listen for leader navigation
socket.on('leader_navigated', (data) => {
  console.log('Leader moved to:', data.song.title);
  // Update UI to show new song
});

// Listen for leader transposition
socket.on('leader_transposed', (data) => {
  console.log(`Transposed from ${data.originalKey} to ${data.newKey}`);
  // Update UI with transposed chords
});

// Toggle follow mode
socket.emit('toggle_follow', { serviceId: 5, followLeader: false });

// Leave service
socket.emit('leave_service', { serviceId: 5 });
```

---

## Server Implementation Example

```javascript
const io = require('socket.io')(server);

// Middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Verify JWT token
  const user = verifyToken(token);
  if (user) {
    socket.user = user;
    next();
  } else {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.user.username);

  // Join service room
  socket.on('join_service', async ({ serviceId, followLeader }) => {
    const roomName = `service_${serviceId}`;
    socket.join(roomName);

    // Broadcast to room
    socket.to(roomName).emit('user_joined', {
      userId: socket.user.id,
      username: socket.user.username
    });

    // Send current state
    const currentState = await getServiceState(serviceId);
    socket.emit('service_joined', { serviceId, currentState });
  });

  // Leader navigation
  socket.on('leader_navigate', async ({ serviceId, songIndex, songId }) => {
    // Verify user is leader
    if (!isLeader(socket.user.id, serviceId)) {
      return socket.emit('error', { message: 'Not authorized' });
    }

    const song = await getSong(songId);
    const roomName = `service_${serviceId}`;

    // Broadcast to followers
    io.to(roomName).emit('leader_navigated', {
      songIndex,
      songId,
      song
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.user.username);
    // Cleanup and broadcast user_left
  });
});
```

---

## Security Considerations

1. **Authentication**: All socket connections must be authenticated with valid JWT
2. **Authorization**: Only leaders can emit leader control events
3. **Rate Limiting**: Limit events per user per second to prevent spam
4. **Validation**: Validate all event payloads
5. **Room Isolation**: Users can only join services they have access to

---

## Performance Optimization

1. **Debouncing**: Throttle rapid transpose/navigation events (max 1 per second)
2. **Payload Size**: Keep payloads minimal (send IDs, not full objects when possible)
3. **Compression**: Enable Socket.IO compression for large payloads
4. **Connection Pooling**: Use Socket.IO Redis adapter for horizontal scaling (future)

---

## Testing Strategy

1. **Unit Tests**: Test individual event handlers
2. **Integration Tests**: Test event sequences (join → navigate → transpose)
3. **Load Tests**: Simulate 100+ concurrent users in a service
4. **Network Tests**: Test reconnection and sync recovery

---

This socket event specification ensures reliable real-time synchronization for all Solu Flow users.
