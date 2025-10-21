const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SharedSong = sequelize.define('SharedSong', {
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
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  shared_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'User who shared the song (original creator or someone who shared it)'
  }
}, {
  tableName: 'shared_songs',
  timestamps: true,
  underscored: true,
  createdAt: 'shared_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['song_id', 'user_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['song_id']
    },
    {
      fields: ['shared_by']
    }
  ]
});

module.exports = SharedSong;
