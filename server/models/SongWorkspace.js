const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SongWorkspace = sequelize.define('SongWorkspace', {
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
    },
    onDelete: 'CASCADE'
  },
  workspace_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'workspaces',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
}, {
  tableName: 'song_workspaces',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['song_id', 'workspace_id']
    },
    {
      fields: ['song_id']
    },
    {
      fields: ['workspace_id']
    }
  ]
});

module.exports = SongWorkspace;
