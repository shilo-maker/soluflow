const express = require('express');
const router = express.Router();
const { User, Workspace, WorkspaceMember, Song, Service, ServiceSong, SharedService } = require('../models');

// Temporary import endpoint (REMOVE AFTER MIGRATION!)
router.post('/data', async (req, res) => {
  try {
    const { users, songs, services, serviceSongs, sharedServices } = req.body;

    console.log('Starting data import...');
    console.log(`Received: ${users?.length} users, ${songs?.length} songs, ${services?.length} services`);

    const userIdMap = {};
    const workspaceIdMap = {};
    const songIdMap = {};
    const serviceIdMap = {};

    // Import users
    for (const user of users || []) {
      const existingUser = await User.findOne({ where: { email: user.email } });

      if (existingUser) {
        console.log(`User ${user.email} already exists, skipping`);
        userIdMap[user.id] = existingUser.id;
      } else {
        const newUser = await User.create({
          username: user.username,
          email: user.email,
          password: user.password, // Already hashed
          role: user.role || 'user'
        });
        userIdMap[user.id] = newUser.id;
        console.log(`Created user: ${user.email}`);
      }
    }

    // Create personal workspaces
    for (const user of users || []) {
      const newUserId = userIdMap[user.id];

      const existingWorkspace = await Workspace.findOne({
        where: {
          created_by: newUserId,
          workspace_type: 'personal'
        }
      });

      if (existingWorkspace) {
        workspaceIdMap[user.id] = existingWorkspace.id;
      } else {
        const workspace = await Workspace.create({
          name: `${user.username}'s Workspace`,
          workspace_type: 'personal',
          created_by: newUserId
        });

        await WorkspaceMember.create({
          workspace_id: workspace.id,
          user_id: newUserId,
          role: 'admin'
        });

        workspaceIdMap[user.id] = workspace.id;
        console.log(`Created workspace for ${user.username}`);
      }
    }

    // Import songs
    for (const song of songs || []) {
      const newUserId = userIdMap[song.created_by];
      const workspaceId = workspaceIdMap[song.created_by];

      const newSong = await Song.create({
        title: song.title,
        authors: song.authors,
        content: song.content,
        key: song.key,
        bpm: song.bpm,
        created_by: newUserId,
        workspace_id: workspaceId,
        is_public: song.is_public !== undefined ? song.is_public : true,
        approval_status: song.approval_status || null
      });

      songIdMap[song.id] = newSong.id;
    }
    console.log(`Imported ${songs?.length || 0} songs`);

    // Import services
    for (const service of services || []) {
      const newUserId = userIdMap[service.created_by];
      const workspaceId = workspaceIdMap[service.created_by];
      const newLeaderId = service.leader_id ? userIdMap[service.leader_id] : null;

      const newService = await Service.create({
        title: service.title,
        date: service.date,
        time: service.time,
        location: service.location,
        created_by: newUserId,
        workspace_id: workspaceId,
        leader_id: newLeaderId,
        is_public: service.is_public !== undefined ? service.is_public : true
      });

      serviceIdMap[service.id] = newService.id;
    }
    console.log(`Imported ${services?.length || 0} services`);

    // Import service songs
    for (const serviceSong of serviceSongs || []) {
      const newServiceId = serviceIdMap[serviceSong.service_id];
      const newSongId = songIdMap[serviceSong.song_id];

      if (newServiceId && newSongId) {
        await ServiceSong.create({
          service_id: newServiceId,
          song_id: newSongId,
          position: serviceSong.position || 0,
          segment_type: serviceSong.segment_type || 'song'
        });
      }
    }
    console.log(`Imported ${serviceSongs?.length || 0} service songs`);

    // Import shared services
    for (const sharedService of sharedServices || []) {
      const newServiceId = serviceIdMap[sharedService.service_id];
      const newUserId = userIdMap[sharedService.shared_with_user_id];

      if (newServiceId && newUserId) {
        await SharedService.create({
          service_id: newServiceId,
          shared_with_user_id: newUserId,
          share_code: sharedService.share_code
        });
      }
    }
    console.log(`Imported ${sharedServices?.length || 0} shared services`);

    res.json({
      success: true,
      message: 'Data imported successfully',
      imported: {
        users: users?.length || 0,
        workspaces: users?.length || 0,
        songs: songs?.length || 0,
        services: services?.length || 0,
        serviceSongs: serviceSongs?.length || 0,
        sharedServices: sharedServices?.length || 0
      }
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
