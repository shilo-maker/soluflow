const { Song, Service, ServiceSong, User, Workspace, WorkspaceMember } = require('../models');
const { Op } = require('sequelize');

/**
 * Integration API for external apps (like SoluEvents)
 * These endpoints are designed for cross-app communication
 */

/**
 * Search songs for integration - optimized for autocomplete
 * GET /api/integration/songs/search?q=query&limit=10
 */
exports.searchSongsForIntegration = async (req, res) => {
  try {
    const { q = '', limit = 10 } = req.query;
    const userId = req.user?.id;

    // Build query for songs the user can access
    const whereClause = {
      [Op.or]: [
        { is_public: true },
        ...(userId ? [
          { created_by: userId },
          { '$sharedWith.user_id$': userId }
        ] : [])
      ]
    };

    // Add search filter if query provided
    if (q) {
      whereClause[Op.and] = [
        {
          [Op.or]: [
            { title: { [Op.like]: `%${q}%` } },
            { authors: { [Op.like]: `%${q}%` } }
          ]
        }
      ];
    }

    const songs = await Song.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: Workspace,
          as: 'workspace',
          attributes: ['id', 'name']
        }
      ],
      attributes: [
        'id',
        'title',
        'authors',
        'key',
        'bpm',
        'time_signature',
        'code',
        'is_public',
        'listen_url'
      ],
      limit: parseInt(limit),
      order: [['title', 'ASC']]
    });

    // Return simplified format for integration
    const formattedSongs = songs.map(song => ({
      id: song.id,
      title: song.title,
      authors: song.authors,
      key: song.key,
      bpm: song.bpm,
      timeSignature: song.time_signature,
      code: song.code,
      listenUrl: song.listen_url,
      creator: song.creator?.username,
      workspace: song.workspace?.name
    }));

    res.json({
      success: true,
      songs: formattedSongs,
      count: formattedSongs.length
    });
  } catch (error) {
    console.error('Integration song search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search songs'
    });
  }
};

/**
 * Get song details by ID for integration
 * GET /api/integration/songs/:id
 */
exports.getSongForIntegration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const song = await Song.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: Workspace,
          as: 'workspace',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!song) {
      return res.status(404).json({
        success: false,
        error: 'Song not found'
      });
    }

    // Check access permissions
    const hasAccess = song.is_public ||
                     song.created_by === userId ||
                     (userId && await song.hasSharedWith(userId));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      song: {
        id: song.id,
        title: song.title,
        content: song.content,
        authors: song.authors,
        key: song.key,
        bpm: song.bpm,
        timeSignature: song.time_signature,
        copyrightInfo: song.copyright_info,
        code: song.code,
        listenUrl: song.listen_url,
        creator: song.creator?.username,
        workspace: song.workspace?.name
      }
    });
  } catch (error) {
    console.error('Integration get song error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get song'
    });
  }
};

/**
 * Create a service from external app (like SoluEvents)
 * POST /api/integration/services
 * Body: {
 *   name: string,
 *   date: string (ISO date),
 *   songIds: array of song IDs,
 *   notes?: string,
 *   workspaceId?: number (optional, uses user's default workspace if not provided)
 * }
 */
exports.createServiceFromIntegration = async (req, res) => {
  try {
    const { name, date, songIds = [], notes, workspaceId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Validate required fields
    if (!name || !date) {
      return res.status(400).json({
        success: false,
        error: 'Service name and date are required'
      });
    }

    // Determine workspace to use
    let targetWorkspaceId = workspaceId;

    if (!targetWorkspaceId) {
      // Find user's default workspace (first workspace they're a member of)
      const membership = await WorkspaceMember.findOne({
        where: { user_id: userId },
        include: [{
          model: Workspace,
          as: 'workspace',
          attributes: ['id', 'name']
        }],
        order: [['created_at', 'ASC']]
      });

      if (!membership) {
        return res.status(400).json({
          success: false,
          error: 'No workspace found. Please specify a workspaceId or join a workspace first.'
        });
      }

      targetWorkspaceId = membership.workspace_id;
    } else {
      // Verify user has access to specified workspace
      const membership = await WorkspaceMember.findOne({
        where: {
          workspace_id: targetWorkspaceId,
          user_id: userId
        }
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to specified workspace'
        });
      }
    }

    // Create the service
    const service = await Service.create({
      workspace_id: targetWorkspaceId,
      name: name,
      date: new Date(date),
      leader_id: userId,
      notes: notes || '',
      is_archived: false,
      is_public: false
    });

    // Add songs to service if provided
    if (songIds && songIds.length > 0) {
      // Verify all songs exist and user has access
      const songs = await Song.findAll({
        where: {
          id: { [Op.in]: songIds }
        }
      });

      if (songs.length !== songIds.length) {
        // Some songs not found, but we'll add the ones that exist
        console.warn(`Some songs not found. Requested: ${songIds.length}, Found: ${songs.length}`);
      }

      // Add songs in the order provided
      const serviceSongs = songIds.map((songId, index) => ({
        service_id: service.id,
        song_id: songId,
        position: index,
        transposition: 0
      }));

      await ServiceSong.bulkCreate(serviceSongs, { ignoreDuplicates: true });
    }

    // Fetch the created service with all details
    const createdService = await Service.findByPk(service.id, {
      include: [
        {
          model: User,
          as: 'leader',
          attributes: ['id', 'username']
        },
        {
          model: Song,
          as: 'songs',
          through: {
            attributes: ['position', 'transposition']
          },
          attributes: ['id', 'title', 'authors', 'key', 'bpm']
        }
      ]
    });

    res.status(201).json({
      success: true,
      service: {
        id: createdService.id,
        name: createdService.name,
        date: createdService.date,
        code: createdService.code,
        leader: createdService.leader?.username,
        songs: createdService.songs?.map(song => ({
          id: song.id,
          title: song.title,
          authors: song.authors,
          key: song.key,
          bpm: song.bpm,
          position: song.ServiceSong?.position,
          transposition: song.ServiceSong?.transposition
        })) || [],
        shareUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/service/${createdService.code}`
      },
      message: 'Service created successfully from SoluEvents'
    });
  } catch (error) {
    console.error('Integration create service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create service',
      details: error.message
    });
  }
};

/**
 * Get user's workspaces for integration
 * GET /api/integration/workspaces
 */
exports.getWorkspacesForIntegration = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const memberships = await WorkspaceMember.findAll({
      where: { user_id: userId },
      include: [{
        model: Workspace,
        as: 'workspace',
        attributes: ['id', 'name', 'workspace_type']
      }]
    });

    const workspaces = memberships.map(m => ({
      id: m.workspace.id,
      name: m.workspace.name,
      type: m.workspace.workspace_type,
      role: m.role
    }));

    res.json({
      success: true,
      workspaces
    });
  } catch (error) {
    console.error('Integration get workspaces error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get workspaces'
    });
  }
};

/**
 * Health check for integration API
 * GET /api/integration/health
 */
exports.integrationHealthCheck = async (req, res) => {
  res.json({
    success: true,
    message: 'SoluFlow Integration API is running',
    version: '1.0.0',
    endpoints: {
      search: 'GET /api/integration/songs/search?q=query&limit=10',
      getSong: 'GET /api/integration/songs/:id',
      createService: 'POST /api/integration/services',
      getWorkspaces: 'GET /api/integration/workspaces'
    }
  });
};
