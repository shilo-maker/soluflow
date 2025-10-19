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
    }
  ]
});

module.exports = Song;
