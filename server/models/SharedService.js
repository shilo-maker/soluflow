const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SharedService = sequelize.define('SharedService', {
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
  }
}, {
  tableName: 'shared_services',
  timestamps: true,
  underscored: true,
  createdAt: 'shared_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['service_id', 'user_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['service_id']
    }
  ]
});

module.exports = SharedService;
