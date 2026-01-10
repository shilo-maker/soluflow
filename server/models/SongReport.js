const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SongReport = sequelize.define('SongReport', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  song_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'songs',
      key: 'id'
    }
  },
  reporter_email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Email of the person reporting (may not be a registered user)'
  },
  reporter_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Optional name of the reporter'
  },
  report_type: {
    type: DataTypes.ENUM('lyrics_error', 'chord_error', 'wrong_key', 'missing_info', 'other'),
    allowNull: false,
    defaultValue: 'other'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Description of the issue'
  },
  status: {
    type: DataTypes.ENUM('pending', 'reviewed', 'resolved', 'dismissed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  admin_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notes from admin when reviewing'
  },
  reviewed_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'song_reports',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['song_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

module.exports = SongReport;
