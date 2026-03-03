require('dotenv').config();
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function migrateWorkspaceMemberInvites() {
  try {
    console.log('Starting migration: add-workspace-member-invites');
    console.log('Database dialect:', sequelize.getDialect());

    // Check if table already exists
    let tableExists = false;
    if (sequelize.getDialect() === 'sqlite') {
      const tables = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='workspace_member_invites';",
        { type: QueryTypes.SELECT }
      );
      tableExists = tables.length > 0;
    } else {
      // PostgreSQL
      const tables = await sequelize.query(
        `SELECT table_name FROM information_schema.tables WHERE table_name = 'workspace_member_invites';`,
        { type: QueryTypes.SELECT }
      );
      tableExists = tables.length > 0;
    }

    if (tableExists) {
      console.log('✓ workspace_member_invites table already exists, skipping');
      return;
    }

    console.log('Creating workspace_member_invites table...');

    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.query(`
        CREATE TABLE workspace_member_invites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
          invited_email VARCHAR(255) NOT NULL,
          invited_user_id INTEGER REFERENCES users(id),
          role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'planner', 'leader', 'member')),
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'declined')),
          token VARCHAR(128) NOT NULL UNIQUE,
          invited_by_id INTEGER NOT NULL REFERENCES users(id),
          expires_at DATETIME NOT NULL,
          responded_at DATETIME,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(workspace_id, invited_email)
        );
      `);
    } else {
      // PostgreSQL
      await sequelize.query(`
        CREATE TABLE workspace_member_invites (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
          invited_email VARCHAR(255) NOT NULL,
          invited_user_id INTEGER REFERENCES users(id),
          role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'planner', 'leader', 'member')),
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'declined')),
          token VARCHAR(128) NOT NULL UNIQUE,
          invited_by_id INTEGER NOT NULL REFERENCES users(id),
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          responded_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          UNIQUE(workspace_id, invited_email)
        );
      `);
    }

    console.log('✓ Created workspace_member_invites table');
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateWorkspaceMemberInvites()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = migrateWorkspaceMemberInvites;
