// Service room Socket.IO handlers
// Handles real-time leader/follower synchronization

const serviceRooms = {};  // Track active rooms: { serviceId: { leader: socketId, followers: [socketIds], currentState: {...} } }

const setupServiceRooms = (io) => {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join a service room
    socket.on('join-service', ({ serviceId, userId, userRole, isLeader }) => {
      console.log(`User ${userId} joining service ${serviceId} as ${isLeader ? 'leader' : 'follower'} (role: ${userRole})`);

      socket.join(`service-${serviceId}`);
      socket.serviceId = serviceId;
      socket.userId = userId;
      socket.isLeader = isLeader;
      // Track admin status for security validation (admin/planner can change leadership)
      socket.isWorkspaceAdmin = userRole === 'admin' || userRole === 'planner';

      // Initialize room if doesn't exist
      if (!serviceRooms[serviceId]) {
        serviceRooms[serviceId] = {
          leader: null,
          followers: [],
          currentState: {
            currentSongId: null,
            transposition: 0,
            isLyricsOnly: false,
            fontSize: 16
          }
        };
      }

      // Set as leader or follower
      if (isLeader) {
        const wasLeaderDisconnected = serviceRooms[serviceId].leader === null;
        serviceRooms[serviceId].leader = socket.id;
        socket.emit('became-leader', { serviceId });

        // If leader was disconnected and is now reconnecting, notify followers
        if (wasLeaderDisconnected) {
          socket.to(`service-${serviceId}`).emit('leader-reconnected', {
            serviceId,
            message: 'Leader reconnected'
          });
          console.log(`Leader reconnected to service ${serviceId}`);
        }
      } else {
        if (!serviceRooms[serviceId].followers.includes(socket.id)) {
          serviceRooms[serviceId].followers.push(socket.id);
        }
        // Send current state to new follower
        socket.emit('sync-state', serviceRooms[serviceId].currentState);
      }

      // Notify room about new participant
      io.to(`service-${serviceId}`).emit('room-update', {
        leaderSocketId: serviceRooms[serviceId].leader,
        followerCount: serviceRooms[serviceId].followers.length
      });

      console.log(`Service ${serviceId} now has leader: ${serviceRooms[serviceId].leader}, followers: ${serviceRooms[serviceId].followers.length}`);
    });

    // Leave service room
    socket.on('leave-service', ({ serviceId }) => {
      handleLeaveService(socket, serviceId, io);
    });

    // Leader navigates to a song (now includes transposition for the new song)
    socket.on('leader-navigate', ({ serviceId, songId, songIndex, transposition }) => {
      if (socket.isLeader && serviceRooms[serviceId]) {
        console.log(`Leader navigating to song ${songId} (index ${songIndex}, transposition ${transposition}) in service ${serviceId}`);

        serviceRooms[serviceId].currentState.currentSongId = songId;
        serviceRooms[serviceId].currentState.currentSongIndex = songIndex;
        if (transposition !== undefined) {
          serviceRooms[serviceId].currentState.transposition = transposition;
        }

        // Broadcast to all followers in the room (not to leader)
        // Include transposition so followers get it immediately with navigation
        socket.to(`service-${serviceId}`).emit('leader-navigated', {
          songId,
          songIndex,
          transposition: transposition !== undefined ? transposition : serviceRooms[serviceId].currentState.transposition
        });
      }
    });

    // Leader changes transposition (now includes songId for verification)
    socket.on('leader-transpose', ({ serviceId, transposition, songId }) => {
      if (socket.isLeader && serviceRooms[serviceId]) {
        console.log(`Leader transposed to ${transposition} for song ${songId || 'current'} in service ${serviceId}`);

        serviceRooms[serviceId].currentState.transposition = transposition;

        // Include songId so followers can verify they're on the correct song
        socket.to(`service-${serviceId}`).emit('leader-transposed', {
          transposition,
          songId: songId || serviceRooms[serviceId].currentState.currentSongId
        });
      }
    });

    // Leader toggles lyrics only mode
    socket.on('leader-toggle-lyrics', ({ serviceId, isLyricsOnly }) => {
      if (socket.isLeader && serviceRooms[serviceId]) {
        console.log(`Leader toggled lyrics only to ${isLyricsOnly} in service ${serviceId}`);

        serviceRooms[serviceId].currentState.isLyricsOnly = isLyricsOnly;

        socket.to(`service-${serviceId}`).emit('leader-toggled-lyrics', {
          isLyricsOnly
        });
      }
    });

    // Leader changes font size
    socket.on('leader-font-size', ({ serviceId, fontSize }) => {
      if (socket.isLeader && serviceRooms[serviceId]) {
        serviceRooms[serviceId].currentState.fontSize = fontSize;

        socket.to(`service-${serviceId}`).emit('leader-changed-font', {
          fontSize
        });
      }
    });

    // Admin changes service leader (requires current leader or admin)
    socket.on('leader-changed', ({ serviceId, newLeaderId }) => {
      // Security: Only allow current leader or workspace admins to change leadership
      // socket.isWorkspaceAdmin is set at join time for admin users
      if (!socket.isLeader && !socket.isWorkspaceAdmin) {
        console.warn(`[Security] Unauthorized leader change attempt from socket ${socket.id} for service ${serviceId}`);
        return;
      }

      console.log(`Leader changed for service ${serviceId} to user ${newLeaderId}`);

      // Broadcast to all users in the service room (including the sender)
      io.to(`service-${serviceId}`).emit('leader-changed', {
        newLeaderId
      });

      // Update room leadership if the new leader is currently connected
      if (serviceRooms[serviceId]) {
        // Find the socket of the new leader in the room
        const roomSockets = io.sockets.adapter.rooms.get(`service-${serviceId}`);
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const clientSocket = io.sockets.sockets.get(socketId);
            if (clientSocket && clientSocket.userId === newLeaderId) {
              // Transfer leadership
              const oldLeaderSocketId = serviceRooms[serviceId].leader;

              // Remove old leader from leader position (make them a follower)
              if (oldLeaderSocketId && oldLeaderSocketId !== socketId) {
                const oldLeaderSocket = io.sockets.sockets.get(oldLeaderSocketId);
                if (oldLeaderSocket) {
                  oldLeaderSocket.isLeader = false;
                  serviceRooms[serviceId].followers.push(oldLeaderSocketId);
                }
              }

              // Set new leader
              serviceRooms[serviceId].leader = socketId;
              serviceRooms[serviceId].followers = serviceRooms[serviceId].followers.filter(
                id => id !== socketId
              );
              clientSocket.isLeader = true;

              console.log(`Socket ${socketId} promoted to leader of service ${serviceId}`);
              break;
            }
          }
        }
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      if (socket.serviceId) {
        handleLeaveService(socket, socket.serviceId, io);
      }
    });
  });
};

// Helper function to handle leaving a service
const handleLeaveService = (socket, serviceId, io) => {
  if (!serviceRooms[serviceId]) return;

  socket.leave(`service-${serviceId}`);

  // If leader left, notify followers to switch to free mode
  if (serviceRooms[serviceId].leader === socket.id) {
    console.log(`Leader disconnected from service ${serviceId}`);

    // Set leader to null (don't promote anyone)
    serviceRooms[serviceId].leader = null;

    // Notify all followers that leader disconnected (they should switch to free mode)
    io.to(`service-${serviceId}`).emit('leader-disconnected', {
      serviceId,
      message: 'Leader disconnected - switched to free mode'
    });

    console.log(`Service ${serviceId} leader disconnected, followers switched to free mode`);
  } else {
    // Remove from followers
    serviceRooms[serviceId].followers = serviceRooms[serviceId].followers.filter(
      id => id !== socket.id
    );
  }

  // Notify room about participant leaving
  io.to(`service-${serviceId}`).emit('room-update', {
    leaderSocketId: serviceRooms[serviceId].leader,
    followerCount: serviceRooms[serviceId].followers.length
  });

  // Clean up room only if completely empty
  if (!serviceRooms[serviceId].leader && serviceRooms[serviceId].followers.length === 0) {
    delete serviceRooms[serviceId];
    console.log(`Service room ${serviceId} deleted (empty)`);
  }
};

module.exports = setupServiceRooms;
