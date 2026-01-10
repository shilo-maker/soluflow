const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SongTag = sequelize.define('SongTag', {
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
  tag_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tags',
      key: 'id'
    },
    onDelete: 'CASCADE'
  }
}, {
  tableName: 'song_tags',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['song_id', 'tag_id']
    },
    {
      fields: ['song_id']
    },
    {
      fields: ['tag_id']
    }
  ]
});

module.exports = SongTag;
