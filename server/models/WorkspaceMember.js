const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkspaceMember = sequelize.define('WorkspaceMember', {
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
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'planner', 'leader', 'member'),
    allowNull: false,
    defaultValue: 'member'
  },
  joined_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'workspace_members',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['workspace_id', 'user_id']
    }
  ]
});

module.exports = WorkspaceMember;
