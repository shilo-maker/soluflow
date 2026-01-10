const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Note = sequelize.define('Note', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
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
  service_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'services',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'Optional: note for specific service context'
  },
  content: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: { notes: [] },
    comment: 'JSON structure: { notes: [{ id, lineNumber, text, timestamp }] }'
  },
  is_visible: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Toggle for showing/hiding during performance'
  }
}, {
  tableName: 'notes',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['song_id']
    },
    {
      fields: ['service_id']
    },
    {
      unique: true,
      fields: ['user_id', 'song_id', 'service_id']
    }
  ]
});

module.exports = Note;
