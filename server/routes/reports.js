const express = require('express');
const router = express.Router();
const { SongReport, Song, User } = require('../models');
const { authenticate, authenticateOptional } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Validation middleware for report submission
const validateReport = [
  body('report_type')
    .isIn(['lyrics_error', 'chord_error', 'wrong_key', 'missing_info', 'other'])
    .withMessage('Invalid report type'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('reporter_email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('reporter_name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name must be less than 100 characters')
];

// POST /api/reports/songs/:songId - Submit a report for a song (public)
router.post('/songs/:songId', validateReport, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { songId } = req.params;
    const { report_type, description, reporter_email, reporter_name } = req.body;

    // Verify song exists and is public
    const song = await Song.findByPk(songId);
    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    if (!song.is_public) {
      return res.status(403).json({ error: 'Can only report public songs' });
    }

    // Create the report
    const report = await SongReport.create({
      song_id: songId,
      report_type,
      description,
      reporter_email,
      reporter_name: reporter_name || null,
      status: 'pending'
    });

    console.log(`New song report submitted for "${song.title}" by ${reporter_email}`);

    res.status(201).json({
      message: 'Report submitted successfully. Thank you for your feedback!',
      report: {
        id: report.id,
        song_title: song.title,
        report_type: report.report_type,
        status: report.status
      }
    });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Admin middleware - check if user has admin role
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/reports - Get all reports (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows: reports } = await SongReport.findAndCountAll({
      where,
      include: [
        {
          model: Song,
          as: 'song',
          attributes: ['id', 'title', 'authors', 'key']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      reports,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// GET /api/reports/stats - Get report statistics (admin only)
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [pendingCount, reviewedCount, resolvedCount, dismissedCount, totalCount] = await Promise.all([
      SongReport.count({ where: { status: 'pending' } }),
      SongReport.count({ where: { status: 'reviewed' } }),
      SongReport.count({ where: { status: 'resolved' } }),
      SongReport.count({ where: { status: 'dismissed' } }),
      SongReport.count()
    ]);

    res.json({
      pending: pendingCount,
      reviewed: reviewedCount,
      resolved: resolvedCount,
      dismissed: dismissedCount,
      total: totalCount
    });
  } catch (error) {
    console.error('Error fetching report stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/reports/:id - Get a single report (admin only)
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const report = await SongReport.findByPk(req.params.id, {
      include: [
        {
          model: Song,
          as: 'song',
          attributes: ['id', 'title', 'authors', 'key', 'content', 'workspace_id']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// PUT /api/reports/:id - Update report status (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, admin_notes } = req.body;

    const report = await SongReport.findByPk(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const updateData = {};
    if (status) {
      if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updateData.status = status;
      updateData.reviewed_by = req.user.id;
      updateData.reviewed_at = new Date();
    }
    if (admin_notes !== undefined) {
      updateData.admin_notes = admin_notes;
    }

    await report.update(updateData);

    // Fetch updated report with associations
    const updatedReport = await SongReport.findByPk(req.params.id, {
      include: [
        {
          model: Song,
          as: 'song',
          attributes: ['id', 'title', 'authors', 'key']
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    res.json(updatedReport);
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// DELETE /api/reports/:id - Delete a report (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const report = await SongReport.findByPk(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await report.destroy();
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Failed to delete report' });
  }
});

module.exports = router;
