const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './server/database.sqlite',
  logging: console.log
});

async function migrate() {
  console.log('=== Starting Multi-Workspace Migration ===\n');

  try {
    // 1. Add workspace_type column to workspaces
    console.log('1. Adding workspace_type column to workspaces...');
    await sequelize.query(`
      ALTER TABLE workspaces
      ADD COLUMN workspace_type TEXT DEFAULT 'personal' CHECK(workspace_type IN ('personal', 'organization'))
    `);
    console.log('✓ Added workspace_type column\n');

    // 2. Create workspace_members table
    console.log('2. Creating workspace_members table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'planner', 'leader', 'member')),
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(workspace_id, user_id)
      )
    `);
    console.log('✓ Created workspace_members table\n');

    // 3. Create workspace_invitations table
    console.log('3. Creating workspace_invitations table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS workspace_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_by INTEGER NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Created workspace_invitations table\n');

    // 4. Add active_workspace_id to users table
    console.log('4. Adding active_workspace_id to users...');
    await sequelize.query(`
      ALTER TABLE users
      ADD COLUMN active_workspace_id INTEGER
      REFERENCES workspaces(id)
    `);
    console.log('✓ Added active_workspace_id column\n');

    // 5. Migrate existing data - create workspace_members entries
    console.log('5. Migrating existing user-workspace relationships...');
    const [users] = await sequelize.query(`SELECT id, workspace_id, role FROM users`);

    for (const user of users) {
      await sequelize.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, {
        replacements: [user.workspace_id, user.id, user.role]
      });
    }
    console.log(`✓ Migrated ${users.length} user-workspace relationships\n`);

    // 6. Set active_workspace_id to current workspace_id for all users
    console.log('6. Setting active workspace for all users...');
    await sequelize.query(`
      UPDATE users
      SET active_workspace_id = workspace_id
    `);
    console.log('✓ Set active workspaces\n');

    // 7. Mark all existing workspaces as 'personal' type
    console.log('7. Setting existing workspaces as personal type...');
    await sequelize.query(`
      UPDATE workspaces
      SET workspace_type = 'personal'
    `);
    console.log('✓ Updated workspace types\n');

    console.log('=== Migration Completed Successfully! ===');
    console.log('\nNext steps:');
    console.log('- Users can now be members of multiple workspaces');
    console.log('- Each user has a personal workspace');
    console.log('- Users can create/join up to 3 organization workspaces');
    console.log('- Invite links can be generated for organization workspaces\n');

  } catch (error) {
    console.error('✗ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

migrate();
