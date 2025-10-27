require('dotenv').config();
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function migrateInviteUsageTracking() {
  try {
    console.log('Starting migration: add-invite-usage-tracking');
    console.log('Database dialect:', sequelize.getDialect());

    // Check if columns already exist (works for both SQLite and PostgreSQL)
    let tableInfo;
    if (sequelize.getDialect() === 'sqlite') {
      tableInfo = await sequelize.query(
        "PRAGMA table_info(workspace_invitations);",
        { type: QueryTypes.SELECT }
      );
    } else {
      // PostgreSQL
      tableInfo = await sequelize.query(
        `SELECT column_name as name FROM information_schema.columns WHERE table_name = 'workspace_invitations';`,
        { type: QueryTypes.SELECT }
      );
    }

    const hasUsageCount = tableInfo.some(col => col.name === 'usage_count');
    const hasMaxUses = tableInfo.some(col => col.name === 'max_uses');

    // Add usage_count column if it doesn't exist
    if (!hasUsageCount) {
      console.log('Adding usage_count column...');
      await sequelize.query(
        `ALTER TABLE workspace_invitations ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;`
      );
      console.log('✓ Added usage_count column');
    } else {
      console.log('✓ usage_count column already exists');
    }

    // Add max_uses column if it doesn't exist
    if (!hasMaxUses) {
      console.log('Adding max_uses column...');
      await sequelize.query(
        `ALTER TABLE workspace_invitations ADD COLUMN max_uses INTEGER NOT NULL DEFAULT 10;`
      );
      console.log('✓ Added max_uses column');
    } else {
      console.log('✓ max_uses column already exists');
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateInviteUsageTracking()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = migrateInviteUsageTracking;
