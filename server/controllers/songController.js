const { Song, User, Workspace, SongWorkspace, WorkspaceMember, SharedSong } = require('../models');
const { Op } = require('sequelize');

// Get all songs for a workspace with visibility filtering
const getAllSongs = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const activeWorkspaceId = req.user?.active_workspace_id;

    // Build where clause based on role and workspace
    let whereClause = {};

    if (userRole === 'admin') {
      // Admins see all songs
      whereClause = {};
    } else if (activeWorkspaceId) {
      // Regular users in a workspace see:
      // 1. All songs in their active workspace
      // 2. Public songs from outside their workspace (global library)
      // 3. Their own private songs
      // 4. Songs shared with them
      const visibilityFilter = [
        { workspace_id: activeWorkspaceId }, // All songs in active workspace
        { is_public: true } // Public songs from anywhere
      ];

      if (userId) {
        visibilityFilter.push({ created_by: userId }); // User's own songs

        // Get song IDs that are shared with this user
        const sharedSongs = await SharedSong.findAll({
          where: { user_id: userId },
          attributes: ['song_id']
        });
        const sharedSongIds = sharedSongs.map(s => s.song_id);

        if (sharedSongIds.length > 0) {
          visibilityFilter.push({ id: { [Op.in]: sharedSongIds } }); // Songs shared with user
        }
      }

      whereClause = {
        [Op.or]: visibilityFilter
      };
    } else {
      // Users without active workspace see public songs + their own + shared
      const visibilityFilter = [{ is_public: true }];
      if (userId) {
        visibilityFilter.push({ created_by: userId });

        // Get song IDs that are shared with this user
        const sharedSongs = await SharedSong.findAll({
          where: { user_id: userId },
          attributes: ['song_id']
        });
        const sharedSongIds = sharedSongs.map(s => s.song_id);

        if (sharedSongIds.length > 0) {
          visibilityFilter.push({ id: { [Op.in]: sharedSongIds } }); // Songs shared with user
        }
      }
      whereClause = {
        [Op.or]: visibilityFilter
      };
    }

    const songs = await Song.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        },
        {
          model: Workspace,
          as: 'workspace',
          attributes: ['id', 'name', 'workspace_type']
        }
      ],
      order: [['title', 'ASC']]
    });

    // Fix N+1 query: Fetch all SharedSongs for this user in one query
    let sharedSongsMap = new Map();
    if (userId && songs.length > 0) {
      const songIds = songs.map(s => s.id);
      const sharedSongs = await SharedSong.findAll({
        where: {
          song_id: { [Op.in]: songIds },
          user_id: userId
        },
        include: [
          {
            model: User,
            as: 'sharer',
            attributes: ['id', 'username', 'email']
          }
        ]
      });

      // Create a Map for O(1) lookup
      sharedSongs.forEach(ss => {
        sharedSongsMap.set(ss.song_id, ss);
      });
    }

    // Map songs with share info (no async needed now)
    const songsWithShareInfo = songs.map(song => {
      const songData = song.toJSON();

      if (userId && sharedSongsMap.has(song.id)) {
        const sharedSong = sharedSongsMap.get(song.id);
        songData.isShared = true;
        songData.sharedBy = sharedSong.sharer;
      }

      return songData;
    });

    res.json(songsWithShareInfo);
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
};

// Get a single song by ID (with visibility check)
const getSongById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const isGuest = req.user?.type === 'guest';

    const song = await Song.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Debug logging
    console.log('[getSongById] req.user:', req.user);
    console.log('[getSongById] isGuest:', isGuest);
    console.log('[getSongById] userId:', userId);
    console.log('[getSongById] song.is_public:', song.is_public);

    // For guest users, allow viewing any song (they can only access via public services)
    if (isGuest) {
      console.log('[getSongById] Returning song for guest user');
      return res.json(song);
    }

    // Allow unauthenticated users to view public songs
    if (!req.user && song.is_public) {
      console.log('[getSongById] Returning public song for unauthenticated user');
      return res.json(song);
    }

    // For authenticated users, check workspace membership and permissions
    if (!userId) {
      return res.status(403).json({ error: 'You do not have permission to view this song' });
    }

    // Check if user is a member of the workspace this song belongs to
    const workspaceMembership = await WorkspaceMember.findOne({
      where: {
        workspace_id: song.workspace_id,
        user_id: userId
      }
    });

    // Check if song has been shared with this user
    const sharedSong = await SharedSong.findOne({
      where: {
        song_id: song.id,
        user_id: userId
      }
    });

    // Check visibility permissions
    // Allow access if user is admin, song is public, user created it, user is workspace member, or song is shared with them
    const canView = userRole === 'admin' ||
                    song.is_public ||
                    song.created_by === userId ||
                    !!workspaceMembership ||
                    !!sharedSong;

    if (!canView) {
      return res.status(403).json({ error: 'You do not have permission to view this song' });
    }

    res.json(song);
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
};

// Search songs by title or author (with visibility filtering)
const searchSongs = async (req, res) => {
  try {
    const { q } = req.query;
    // Use active_workspace_id if workspace_id not provided in query
    const workspace_id = req.query.workspace_id || req.user?.active_workspace_id;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Build where clause based on role
    let whereClause = {
      [Op.or]: [
        { title: { [Op.like]: `%${q}%` } },
        { authors: { [Op.like]: `%${q}%` } }
      ]
    };

    if (userRole === 'admin') {
      // Admins see all songs - just apply the search filter
      // No visibility filtering needed for admins
    } else {
      // Build visibility filter for regular users
      const visibilityFilter = [];
      visibilityFilter.push({ is_public: true });
      if (userId) {
        visibilityFilter.push({ created_by: userId });
      }

      // If workspace_id is provided, use it as a filter (for workspace-specific views)
      // Otherwise, search ALL public songs + user's own songs
      if (workspace_id) {
        whereClause = {
          [Op.and]: [
            {
              [Op.or]: [
                { title: { [Op.like]: `%${q}%` } },
                { authors: { [Op.like]: `%${q}%` } }
              ]
            },
            { workspace_id },
            { [Op.or]: visibilityFilter }
          ]
        };
      } else {
        whereClause = {
          [Op.and]: [
            {
              [Op.or]: [
                { title: { [Op.like]: `%${q}%` } },
                { authors: { [Op.like]: `%${q}%` } }
              ]
            },
            { [Op.or]: visibilityFilter }
          ]
        };
      }
    }

    const songs = await Song.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['title', 'ASC']]
    });

    res.json(songs);
  } catch (error) {
    console.error('Error searching songs:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
};

// Create a new song
const createSong = async (req, res) => {
  try {
    const {
      title,
      content,
      key,
      bpm,
      time_signature,
      authors,
      copyright_info,
      listen_url,
      created_by,
      workspace_ids // Array of workspace IDs where the song should be visible
    } = req.body;

    const userId = req.user?.id;
    const userRole = req.user?.role;
    // Use active_workspace_id if workspace_id not provided in body
    const workspace_id = req.body.workspace_id || req.user?.active_workspace_id;

    if (!workspace_id || !title || !content) {
      return res.status(400).json({
        error: 'workspace_id (or active workspace), title, and content are required'
      });
    }

    // Set is_public based on user role
    // Admins create public songs by default, regular users create private songs
    const isPublic = userRole === 'admin';

    const song = await Song.create({
      workspace_id,
      title,
      content,
      key,
      bpm,
      time_signature,
      authors,
      copyright_info,
      listen_url,
      created_by: created_by || userId,
      is_public: isPublic,
      approval_status: null
    });

    // If workspace_ids are provided, create SongWorkspace entries
    if (workspace_ids && Array.isArray(workspace_ids) && workspace_ids.length > 0) {
      const songWorkspaceEntries = workspace_ids.map(wsId => ({
        song_id: song.id,
        workspace_id: wsId
      }));
      await SongWorkspace.bulkCreate(songWorkspaceEntries);
    }

    res.status(201).json(song);
  } catch (error) {
    console.error('Error creating song:', error);
    res.status(500).json({ error: 'Failed to create song' });
  }
};

// Update a song
const updateSong = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      key,
      bpm,
      time_signature,
      authors,
      copyright_info,
      is_public,
      workspace_ids // Array of workspace IDs where the song should be visible
    } = req.body;

    const userId = req.user?.id;
    const userRole = req.user?.role;

    const song = await Song.findByPk(id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check permission to edit
    const canEdit = userRole === 'admin' || song.created_by === userId;

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this song' });
    }

    // Build update object - only include provided fields
    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (key !== undefined) updateData.key = key;
    if (bpm !== undefined) updateData.bpm = bpm;
    if (time_signature !== undefined) updateData.time_signature = time_signature;
    if (authors !== undefined) updateData.authors = authors;
    if (copyright_info !== undefined) updateData.copyright_info = copyright_info;
    if (req.body.listen_url !== undefined) updateData.listen_url = req.body.listen_url;

    // Only admins can change is_public status
    if (userRole === 'admin' && is_public !== undefined) {
      updateData.is_public = is_public;
      console.log('Admin updating is_public to:', is_public);
    }

    console.log('Updating song with data:', updateData);

    await song.update(updateData);

    // Update workspace visibility if workspace_ids are provided
    if (workspace_ids !== undefined && Array.isArray(workspace_ids)) {
      // Delete existing workspace associations
      await SongWorkspace.destroy({
        where: { song_id: id }
      });

      // Create new associations
      if (workspace_ids.length > 0) {
        const songWorkspaceEntries = workspace_ids.map(wsId => ({
          song_id: id,
          workspace_id: wsId
        }));
        await SongWorkspace.bulkCreate(songWorkspaceEntries);
      }
    }

    // Reload to get fresh data from database
    await song.reload();

    console.log('Song after update - is_public:', song.is_public);

    res.json(song);
  } catch (error) {
    console.error('Error updating song:', error);
    res.status(500).json({ error: 'Failed to update song' });
  }
};

// Delete a song
const deleteSong = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const song = await Song.findByPk(id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Only admins or the creator can delete
    const canDelete = userRole === 'admin' || song.created_by === userId;

    if (!canDelete) {
      return res.status(403).json({ error: 'You do not have permission to delete this song' });
    }

    await song.destroy();

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
};

// Submit song for approval (regular users only)
const submitForApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole === 'admin') {
      return res.status(400).json({ error: 'Admins do not need to submit songs for approval' });
    }

    const song = await Song.findByPk(id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Only the creator can submit their song
    if (song.created_by !== userId) {
      return res.status(403).json({ error: 'You can only submit your own songs for approval' });
    }

    // Check if already public
    if (song.is_public) {
      return res.status(400).json({ error: 'Song is already public' });
    }

    // Check if already pending
    if (song.approval_status === 'pending') {
      return res.status(400).json({ error: 'Song is already pending approval' });
    }

    await song.update({ approval_status: 'pending' });

    res.json({ message: 'Song submitted for approval', song });
  } catch (error) {
    console.error('Error submitting song for approval:', error);
    res.status(500).json({ error: 'Failed to submit song for approval' });
  }
};

// Get pending approvals (admin only)
const getPendingApprovals = async (req, res) => {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can view pending approvals' });
    }

    const songs = await Song.findAll({
      where: {
        approval_status: 'pending',
        is_public: false
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['updated_at', 'DESC']]
    });

    res.json(songs);
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({ error: 'Failed to fetch pending approvals' });
  }
};

// Approve song (admin only)
const approveSong = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can approve songs' });
    }

    const song = await Song.findByPk(id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (song.approval_status !== 'pending') {
      return res.status(400).json({ error: 'Song is not pending approval' });
    }

    await song.update({
      is_public: true,
      approval_status: 'approved'
    });

    res.json({ message: 'Song approved and made public', song });
  } catch (error) {
    console.error('Error approving song:', error);
    res.status(500).json({ error: 'Failed to approve song' });
  }
};

// Reject song (admin only)
const rejectSong = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userRole = req.user?.role;

    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can reject songs' });
    }

    const song = await Song.findByPk(id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (song.approval_status !== 'pending') {
      return res.status(400).json({ error: 'Song is not pending approval' });
    }

    await song.update({
      approval_status: 'rejected'
    });

    res.json({ message: 'Song rejected', song, reason });
  } catch (error) {
    console.error('Error rejecting song:', error);
    res.status(500).json({ error: 'Failed to reject song' });
  }
};

// Get share link for a song
const getShareLink = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const song = await Song.findByPk(id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Verify user has permission (owner or admin)
    const userRole = req.user?.role;
    const canShare = userRole === 'admin' || song.created_by === userId;

    if (!canShare) {
      return res.status(403).json({ error: 'Access denied. You can only share your own songs.' });
    }

    // Generate code if it doesn't exist
    if (!song.code) {
      // Generate unique code (4 characters)
      const generateCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      let code = generateCode();
      // Ensure code is unique
      let existing = await Song.findOne({ where: { code } });
      while (existing) {
        code = generateCode();
        existing = await Song.findOne({ where: { code } });
      }

      await song.update({ code });
    }

    // Return the song code
    res.json({ code: song.code });
  } catch (error) {
    console.error('Error getting share link:', error);
    res.status(500).json({ error: 'Failed to get share link' });
  }
};

// Get song by code (for shared access)
const getSongByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const song = await Song.findOne({
      where: { code },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check if authenticated user already has this song shared
    if (req.user && req.user.id) {
      const isOwner = song.created_by === req.user.id;
      const sharedSong = await SharedSong.findOne({
        where: {
          song_id: song.id,
          user_id: req.user.id
        }
      });
      const songData = song.toJSON();
      songData.alreadyAdded = isOwner || !!sharedSong;
      songData.isOwner = isOwner;
      return res.json(songData);
    }

    // For unauthenticated users, just return the song
    res.json(song);
  } catch (error) {
    console.error('Error fetching song by code:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
};

// Accept/add a shared song (for registered users)
const acceptSharedSong = async (req, res) => {
  try {
    const { code } = req.params;
    const userId = req.user?.id;

    // Find the song by code
    const song = await Song.findOne({
      where: { code },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    if (!song) {
      return res.status(404).json({ error: 'Song not found or not available for sharing' });
    }

    // Check if user is the owner
    if (song.created_by === userId) {
      return res.status(400).json({ error: 'You already own this song' });
    }

    // Check if already shared
    const existingShare = await SharedSong.findOne({
      where: {
        song_id: song.id,
        user_id: userId
      }
    });

    if (existingShare) {
      return res.status(400).json({ error: 'Song already added to your library' });
    }

    // Create the shared song record
    await SharedSong.create({
      song_id: song.id,
      user_id: userId,
      shared_by: song.created_by
    });

    // Return song with creator info
    res.json({
      message: 'Song added to your library successfully',
      song: song.toJSON()
    });
  } catch (error) {
    console.error('Error accepting shared song:', error);
    res.status(500).json({ error: 'Failed to add shared song' });
  }
};

module.exports = {
  getAllSongs,
  getSongById,
  searchSongs,
  createSong,
  updateSong,
  deleteSong,
  submitForApproval,
  getPendingApprovals,
  approveSong,
  rejectSong,
  getShareLink,
  getSongByCode,
  acceptSharedSong
};
