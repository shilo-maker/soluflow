const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ServiceSong = sequelize.define('ServiceSong', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  service_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'services',
      key: 'id'
    }
  },
  song_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'songs',
      key: 'id'
    }
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Order in the set list'
  },
  segment_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'song',
    comment: 'song, prayer, reading, break'
  },
  segment_title: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Title for non-song segments'
  },
  segment_content: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Content for prayers/readings'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Planner notes for this item'
  },
  transposition: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Transposition value for this song in this service (-11 to +11)'
  }
}, {
  tableName: 'service_songs',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      fields: ['service_id']
    },
    {
      fields: ['service_id', 'position']
    },
    {
      fields: ['song_id']
    }
  ]
});

module.exports = ServiceSong;
