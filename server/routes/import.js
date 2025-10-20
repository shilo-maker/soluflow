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

    // Create personal workspaces first (since User requires workspace_id)
    for (const user of users || []) {
      // Check if user already exists
      const existingUser = await User.findOne({ where: { email: user.email } });

      if (existingUser) {
        console.log(`User ${user.email} already exists, using existing workspace`);
        userIdMap[user.id] = existingUser.id;
        workspaceIdMap[user.id] = existingUser.workspace_id;
      } else {
        // Create workspace first
        // Generate a unique slug from username
        const baseSlug = user.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
        let slug = baseSlug;
        let counter = 1;

        // Ensure slug is unique
        while (await Workspace.findOne({ where: { slug } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }

        const workspace = await Workspace.create({
          name: `${user.username}'s Workspace`,
          slug: slug,
          workspace_type: 'personal',
          created_by: null // Will update after user is created
        });

        workspaceIdMap[user.id] = workspace.id;
        console.log(`Created workspace for ${user.username}`);
      }
    }

    // Import users
    for (const user of users || []) {
      const existingUser = await User.findOne({ where: { email: user.email } });

      if (!existingUser) {
        const workspaceId = workspaceIdMap[user.id];

        const newUser = await User.create({
          username: user.username,
          email: user.email,
          password_hash: user.password_hash, // Already hashed
          role: user.role || 'member',
          workspace_id: workspaceId,
          active_workspace_id: workspaceId,
          is_active: user.is_active !== undefined ? user.is_active : true
        });
        userIdMap[user.id] = newUser.id;
        console.log(`Created user: ${user.email}`);

        // Update workspace created_by
        await Workspace.update(
          { created_by: newUser.id },
          { where: { id: workspaceId } }
        );

        // Add user as admin of their personal workspace
        await WorkspaceMember.create({
          workspace_id: workspaceId,
          user_id: newUser.id,
          role: 'admin'
        });
      }
    }

    // Import songs
    // Get the first user as default for songs without created_by
    const defaultUserId = Object.values(userIdMap)[0];
    const defaultWorkspaceId = Object.values(workspaceIdMap)[0];

    for (const song of songs || []) {
      // Use the song's created_by if available, otherwise use default user
      let newUserId = song.created_by ? userIdMap[song.created_by] : null;
      let workspaceId = song.created_by ? workspaceIdMap[song.created_by] : null;

      // If no created_by or mapping failed, use defaults
      if (!newUserId || !workspaceId) {
        newUserId = defaultUserId;
        workspaceId = defaultWorkspaceId;
      }

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
      let newUserId = service.created_by ? userIdMap[service.created_by] : null;
      let workspaceId = service.created_by ? workspaceIdMap[service.created_by] : null;

      // If no created_by or mapping failed, use defaults
      if (!newUserId || !workspaceId) {
        newUserId = defaultUserId;
        workspaceId = defaultWorkspaceId;
      }

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
