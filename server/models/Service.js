const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

const Service = sequelize.define('Service', {
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
  date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  time: {
    type: DataTypes.TIME,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  leader_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  code: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: true,
    comment: 'Short code for guest access'
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'services',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['workspace_id']
    },
    {
      fields: ['date']
    },
    {
      fields: ['code']
    },
    {
      fields: ['leader_id']
    },
    {
      // Composite index for listing services by workspace and date
      fields: ['workspace_id', 'date']
    },
    {
      // Composite index for filtering archived services
      fields: ['workspace_id', 'is_archived']
    },
    {
      // Index for is_public queries
      fields: ['is_public']
    }
  ],
  hooks: {
    beforeCreate: (service) => {
      // Generate random 4-character code if not provided using crypto for better randomness
      if (!service.code) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
          code += chars.charAt(crypto.randomInt(chars.length));
        }
        service.code = code;
      }
    }
  }
});

module.exports = Service;
