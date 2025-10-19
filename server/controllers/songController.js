const { Song, User, Workspace } = require('../models');
const { Op } = require('sequelize');

// Get all songs for a workspace
const getAllSongs = async (req, res) => {
  try {
    const { workspace_id } = req.query;

    const songs = await Song.findAll({
      where: workspace_id ? { workspace_id } : {},
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
    console.error('Error fetching songs:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
};

// Get a single song by ID
const getSongById = async (req, res) => {
  try {
    const { id } = req.params;

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

    res.json(song);
  } catch (error) {
    console.error('Error fetching song:', error);
    res.status(500).json({ error: 'Failed to fetch song' });
  }
};

// Search songs by title or author
const searchSongs = async (req, res) => {
  try {
    const { q, workspace_id } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const whereClause = {
      [Op.or]: [
        { title: { [Op.like]: `%${q}%` } },
        { authors: { [Op.like]: `%${q}%` } }
      ]
    };

    if (workspace_id) {
      whereClause.workspace_id = workspace_id;
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
      workspace_id,
      title,
      content,
      key,
      bpm,
      time_signature,
      authors,
      copyright_info,
      created_by
    } = req.body;

    if (!workspace_id || !title || !content) {
      return res.status(400).json({
        error: 'workspace_id, title, and content are required'
      });
    }

    const song = await Song.create({
      workspace_id,
      title,
      content,
      key,
      bpm,
      time_signature,
      authors,
      copyright_info,
      created_by: created_by || req.user?.id // From auth middleware if available
    });

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
      copyright_info
    } = req.body;

    const song = await Song.findByPk(id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    await song.update({
      title: title || song.title,
      content: content || song.content,
      key: key !== undefined ? key : song.key,
      bpm: bpm !== undefined ? bpm : song.bpm,
      time_signature: time_signature !== undefined ? time_signature : song.time_signature,
      authors: authors !== undefined ? authors : song.authors,
      copyright_info: copyright_info !== undefined ? copyright_info : song.copyright_info
    });

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

    const song = await Song.findByPk(id);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    await song.destroy();

    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Failed to delete song' });
  }
};

module.exports = {
  getAllSongs,
  getSongById,
  searchSongs,
  createSong,
  updateSong,
  deleteSong
};
