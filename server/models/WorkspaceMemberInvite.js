const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkspaceMemberInvite = sequelize.define('WorkspaceMemberInvite', {
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
  invited_email: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  invited_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  role: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'member',
    validate: {
      isIn: [['admin', 'planner', 'leader', 'member']]
    }
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'confirmed', 'declined']]
    }
  },
  token: {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true
  },
  invited_by_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  responded_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'workspace_member_invites',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['workspace_id', 'invited_email']
    }
  ]
});

module.exports = WorkspaceMemberInvite;
