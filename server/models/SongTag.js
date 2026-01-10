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
    allowNull: false
  },
  tag_id: {
    type: DataTypes.INTEGER,
    allowNull: false
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
