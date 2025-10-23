const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Song = sequelize.define('Song', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  workspace_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'workspaces',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'ChordPro format content'
  },
  key: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  bpm: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 40,
      max: 240
    }
  },
  time_signature: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  authors: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  copyright_info: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  code: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: true,
    comment: 'Short code for sharing song with other users'
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether song is visible to all users or only creator'
  },
  approval_status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: true,
    defaultValue: null,
    comment: 'Approval status when regular user submits song to become public'
  },
  listen_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'URL to listen to the song (YouTube, Spotify, etc.)'
  }
}, {
  tableName: 'songs',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['workspace_id']
    },
    {
      fields: ['title']
    },
    {
      fields: ['key']
    },
    {
      fields: ['created_by']
    },
    {
      fields: ['is_public']
    },
    {
      fields: ['code']
    }
  ]
});

module.exports = Song;
