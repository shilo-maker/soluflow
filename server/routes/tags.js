const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Tag, SongTag, Song } = require('../models');
const { Op } = require('sequelize');

// GET /api/tags - Get all available tags
// Returns public tags + user's personal tags
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause;
    if (userRole === 'admin') {
      // Admins see all tags
      whereClause = {};
    } else {
      // Regular users see public tags + their own tags
      whereClause = {
        [Op.or]: [
          { is_public: true },
          { created_by: userId }
        ]
      };
    }

    const tags = await Tag.findAll({
      where: whereClause,
      order: [['name', 'ASC']]
    });

    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// POST /api/tags - Create a new tag
// Admins can create public tags, regular users create personal tags
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, color } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    if (name.length > 50) {
      return res.status(400).json({ error: 'Tag name must be 50 characters or less' });
    }

    // Check if tag with same name already exists
    const existingTag = await Tag.findOne({
      where: { name: name.trim() }
    });

    if (existingTag) {
      return res.status(400).json({ error: 'A tag with this name already exists' });
    }

    const tag = await Tag.create({
      name: name.trim(),
      color: color || '#6c5ce7',
      is_public: userRole === 'admin', // Only admin tags are public
      created_by: userId
    });

    res.status(201).json(tag);
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// PUT /api/tags/:id - Update a tag
// Only the creator or admin can update
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const tag = await Tag.findByPk(id);

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Check permission: only creator or admin can update
    if (tag.created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this tag' });
    }

    if (name) {
      if (name.length > 50) {
        return res.status(400).json({ error: 'Tag name must be 50 characters or less' });
      }

      // Check if another tag with same name exists
      const existingTag = await Tag.findOne({
        where: {
          name: name.trim(),
          id: { [Op.ne]: id }
        }
      });

      if (existingTag) {
        return res.status(400).json({ error: 'A tag with this name already exists' });
      }

      tag.name = name.trim();
    }

    if (color) {
      tag.color = color;
    }

    await tag.save();
    res.json(tag);
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// DELETE /api/tags/:id - Delete a tag
// Only the creator or admin can delete
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const tag = await Tag.findByPk(id);

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Check permission: only creator or admin can delete
    if (tag.created_by !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this tag' });
    }

    // Delete will cascade to SongTag due to association
    await tag.destroy();
    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// POST /api/tags/song/:songId - Add tags to a song
// For public songs: only admin can add tags
// For personal songs: only owner can add tags
router.post('/song/:songId', authenticate, async (req, res) => {
  try {
    const { songId } = req.params;
    const { tagIds } = req.body; // Array of tag IDs
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!Array.isArray(tagIds)) {
      return res.status(400).json({ error: 'tagIds must be an array' });
    }

    const song = await Song.findByPk(songId);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check permission
    if (song.is_public) {
      // Public songs: only admin can add tags
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Only admins can add tags to public songs' });
      }
    } else {
      // Personal songs: only owner can add tags
      if (song.created_by !== userId && userRole !== 'admin') {
        return res.status(403).json({ error: 'Only the song owner can add tags' });
      }
    }

    // Verify all tags exist and user has access to them
    const tags = await Tag.findAll({
      where: {
        id: { [Op.in]: tagIds },
        [Op.or]: [
          { is_public: true },
          { created_by: userId }
        ]
      }
    });

    if (tags.length !== tagIds.length) {
      return res.status(400).json({ error: 'Some tags are invalid or inaccessible' });
    }

    // Add tags (ignore duplicates)
    for (const tagId of tagIds) {
      await SongTag.findOrCreate({
        where: { song_id: songId, tag_id: tagId }
      });
    }

    // Return updated song with tags
    const updatedSong = await Song.findByPk(songId, {
      include: [{ model: Tag, as: 'tags' }]
    });

    res.json(updatedSong.tags);
  } catch (error) {
    console.error('Error adding tags to song:', error);
    res.status(500).json({ error: 'Failed to add tags to song' });
  }
});

// DELETE /api/tags/song/:songId/:tagId - Remove a tag from a song
router.delete('/song/:songId/:tagId', authenticate, async (req, res) => {
  try {
    const { songId, tagId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const song = await Song.findByPk(songId);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check permission
    if (song.is_public) {
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Only admins can remove tags from public songs' });
      }
    } else {
      if (song.created_by !== userId && userRole !== 'admin') {
        return res.status(403).json({ error: 'Only the song owner can remove tags' });
      }
    }

    const songTag = await SongTag.findOne({
      where: { song_id: songId, tag_id: tagId }
    });

    if (!songTag) {
      return res.status(404).json({ error: 'Tag not found on this song' });
    }

    await songTag.destroy();

    // Return updated song tags
    const updatedSong = await Song.findByPk(songId, {
      include: [{ model: Tag, as: 'tags' }]
    });

    res.json(updatedSong.tags);
  } catch (error) {
    console.error('Error removing tag from song:', error);
    res.status(500).json({ error: 'Failed to remove tag from song' });
  }
});

// PUT /api/tags/song/:songId - Set all tags for a song (replace existing)
router.put('/song/:songId', authenticate, async (req, res) => {
  try {
    const { songId } = req.params;
    const { tagIds } = req.body; // Array of tag IDs
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!Array.isArray(tagIds)) {
      return res.status(400).json({ error: 'tagIds must be an array' });
    }

    const song = await Song.findByPk(songId);

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    // Check permission
    if (song.is_public) {
      if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Only admins can modify tags on public songs' });
      }
    } else {
      if (song.created_by !== userId && userRole !== 'admin') {
        return res.status(403).json({ error: 'Only the song owner can modify tags' });
      }
    }

    // Verify all tags exist and user has access to them
    if (tagIds.length > 0) {
      const tags = await Tag.findAll({
        where: {
          id: { [Op.in]: tagIds },
          [Op.or]: [
            { is_public: true },
            { created_by: userId }
          ]
        }
      });

      if (tags.length !== tagIds.length) {
        return res.status(400).json({ error: 'Some tags are invalid or inaccessible' });
      }
    }

    // Remove all existing tags
    await SongTag.destroy({
      where: { song_id: songId }
    });

    // Add new tags
    for (const tagId of tagIds) {
      await SongTag.create({ song_id: songId, tag_id: tagId });
    }

    // Return updated song with tags
    const updatedSong = await Song.findByPk(songId, {
      include: [{ model: Tag, as: 'tags' }]
    });

    res.json(updatedSong.tags);
  } catch (error) {
    console.error('Error setting song tags:', error);
    res.status(500).json({ error: 'Failed to set song tags' });
  }
});

module.exports = router;
