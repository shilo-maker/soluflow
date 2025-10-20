const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

// Local SQLite database
const localSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

// Production PostgreSQL database
const prodSequelize = new Sequelize(process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: console.log
});

async function migrateToProduction() {
  try {
    console.log('========================================');
    console.log('SOLUFLOW PRODUCTION MIGRATION');
    console.log('========================================\n');

    // Step 1: Connect to both databases
    console.log('Step 1: Connecting to databases...');
    await localSequelize.authenticate();
    console.log('✓ Connected to local SQLite database');
    await prodSequelize.authenticate();
    console.log('✓ Connected to production PostgreSQL database\n');

    // Step 2: Export data from local database
    console.log('Step 2: Exporting data from local database...');

    const [localUsers] = await localSequelize.query('SELECT * FROM users');
    console.log(`✓ Exported ${localUsers.length} users`);

    const [localSongs] = await localSequelize.query('SELECT * FROM songs');
    console.log(`✓ Exported ${localSongs.length} songs`);

    const [localServices] = await localSequelize.query('SELECT * FROM services');
    console.log(`✓ Exported ${localServices.length} services`);

    const [localServiceSongs] = await localSequelize.query('SELECT * FROM service_songs');
    console.log(`✓ Exported ${localServiceSongs.length} service_songs`);

    const [localSharedServices] = await localSequelize.query('SELECT * FROM shared_services');
    console.log(`✓ Exported ${localSharedServices.length} shared_services\n`);

    // Step 3: Drop and recreate production database tables
    console.log('Step 3: Recreating production database schema...');

    // Drop all tables in correct order (respecting foreign keys)
    await prodSequelize.query('DROP TABLE IF EXISTS shared_services CASCADE');
    await prodSequelize.query('DROP TABLE IF EXISTS service_songs CASCADE');
    await prodSequelize.query('DROP TABLE IF EXISTS services CASCADE');
    await prodSequelize.query('DROP TABLE IF EXISTS song_workspaces CASCADE');
    await prodSequelize.query('DROP TABLE IF EXISTS songs CASCADE');
    await prodSequelize.query('DROP TABLE IF EXISTS workspace_invitations CASCADE');
    await prodSequelize.query('DROP TABLE IF EXISTS workspace_members CASCADE');
    await prodSequelize.query('DROP TABLE IF EXISTS workspaces CASCADE');
    await prodSequelize.query('DROP TABLE IF EXISTS users CASCADE');
    await prodSequelize.query('DROP TYPE IF EXISTS approval_status_enum CASCADE');
    await prodSequelize.query('DROP TYPE IF EXISTS workspace_type_enum CASCADE');
    await prodSequelize.query('DROP TYPE IF EXISTS workspace_role_enum CASCADE');
    console.log('✓ Dropped existing tables');

    // Create enum types
    await prodSequelize.query(`
      CREATE TYPE approval_status_enum AS ENUM ('pending', 'approved', 'rejected')
    `);
    await prodSequelize.query(`
      CREATE TYPE workspace_type_enum AS ENUM ('personal', 'organization')
    `);
    await prodSequelize.query(`
      CREATE TYPE workspace_role_enum AS ENUM ('admin', 'planner', 'leader', 'member')
    `);
    console.log('✓ Created enum types');

    // Create users table
    await prodSequelize.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created users table');

    // Create workspaces table
    await prodSequelize.query(`
      CREATE TABLE workspaces (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        workspace_type workspace_type_enum NOT NULL DEFAULT 'organization',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created workspaces table');

    // Create workspace_members table
    await prodSequelize.query(`
      CREATE TABLE workspace_members (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role workspace_role_enum NOT NULL DEFAULT 'member',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(workspace_id, user_id)
      )
    `);
    console.log('✓ Created workspace_members table');

    // Create workspace_invitations table
    await prodSequelize.query(`
      CREATE TABLE workspace_invitations (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created workspace_invitations table');

    // Create songs table
    await prodSequelize.query(`
      CREATE TABLE songs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        authors VARCHAR(255),
        content TEXT NOT NULL,
        key VARCHAR(10),
        bpm INTEGER,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
        is_public BOOLEAN DEFAULT false,
        approval_status approval_status_enum DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created songs table');

    // Create song_workspaces table
    await prodSequelize.query(`
      CREATE TABLE song_workspaces (
        id SERIAL PRIMARY KEY,
        song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(song_id, workspace_id)
      )
    `);
    console.log('✓ Created song_workspaces table');

    // Create services table
    await prodSequelize.query(`
      CREATE TABLE services (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date DATE,
        time TIME,
        location VARCHAR(255),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
        leader_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_public BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created services table');

    // Create service_songs table
    await prodSequelize.query(`
      CREATE TABLE service_songs (
        id SERIAL PRIMARY KEY,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        segment_type VARCHAR(50) DEFAULT 'song',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Created service_songs table');

    // Create shared_services table
    await prodSequelize.query(`
      CREATE TABLE shared_services (
        id SERIAL PRIMARY KEY,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        shared_with_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        share_code VARCHAR(255) UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(service_id, shared_with_user_id)
      )
    `);
    console.log('✓ Created shared_services table');

    // Create indexes
    await prodSequelize.query('CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id)');
    await prodSequelize.query('CREATE INDEX idx_workspace_members_user ON workspace_members(user_id)');
    await prodSequelize.query('CREATE INDEX idx_songs_workspace ON songs(workspace_id)');
    await prodSequelize.query('CREATE INDEX idx_songs_created_by ON songs(created_by)');
    await prodSequelize.query('CREATE INDEX idx_services_workspace ON services(workspace_id)');
    await prodSequelize.query('CREATE INDEX idx_service_songs_service ON service_songs(service_id)');
    console.log('✓ Created indexes\n');

    // Step 4: Import users
    console.log('Step 4: Importing users...');
    const userIdMap = {}; // Maps old IDs to new IDs
    for (const user of localUsers) {
      const [result] = await prodSequelize.query(`
        INSERT INTO users (username, email, password, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id
      `, {
        replacements: [
          user.username,
          user.email,
          user.password,
          user.role || 'user',
          user.created_at || new Date(),
          user.updated_at || new Date()
        ]
      });
      userIdMap[user.id] = result[0].id;
    }
    console.log(`✓ Imported ${localUsers.length} users\n`);

    // Step 5: Create personal workspaces for all users
    console.log('Step 5: Creating personal workspaces for users...');
    const workspaceIdMap = {}; // Maps user IDs to their personal workspace IDs
    for (const user of localUsers) {
      const newUserId = userIdMap[user.id];
      const [result] = await prodSequelize.query(`
        INSERT INTO workspaces (name, workspace_type, created_by, created_at, updated_at)
        VALUES (?, 'personal', ?, ?, ?)
        RETURNING id
      `, {
        replacements: [
          `${user.username}'s Workspace`,
          newUserId,
          new Date(),
          new Date()
        ]
      });
      const workspaceId = result[0].id;
      workspaceIdMap[user.id] = workspaceId;

      // Add user as admin of their personal workspace
      await prodSequelize.query(`
        INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
        VALUES (?, ?, 'admin', ?, ?)
      `, {
        replacements: [workspaceId, newUserId, new Date(), new Date()]
      });
    }
    console.log(`✓ Created ${localUsers.length} personal workspaces\n`);

    // Step 6: Import songs and associate with workspaces
    console.log('Step 6: Importing songs...');
    const songIdMap = {};
    for (const song of localSongs) {
      const newUserId = userIdMap[song.created_by];
      const workspaceId = workspaceIdMap[song.created_by]; // Assign to creator's personal workspace

      const [result] = await prodSequelize.query(`
        INSERT INTO songs (title, authors, content, key, bpm, created_by, workspace_id, is_public, approval_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `, {
        replacements: [
          song.title,
          song.authors,
          song.content,
          song.key,
          song.bpm,
          newUserId,
          workspaceId,
          song.is_public !== undefined ? song.is_public : true,
          song.approval_status || null,
          song.created_at || new Date(),
          song.updated_at || new Date()
        ]
      });
      songIdMap[song.id] = result[0].id;
    }
    console.log(`✓ Imported ${localSongs.length} songs\n`);

    // Step 7: Import services
    console.log('Step 7: Importing services...');
    const serviceIdMap = {};
    for (const service of localServices) {
      const newUserId = userIdMap[service.created_by];
      const workspaceId = workspaceIdMap[service.created_by]; // Assign to creator's personal workspace
      const newLeaderId = service.leader_id ? userIdMap[service.leader_id] : null;

      const [result] = await prodSequelize.query(`
        INSERT INTO services (title, date, time, location, created_by, workspace_id, leader_id, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `, {
        replacements: [
          service.title,
          service.date,
          service.time,
          service.location,
          newUserId,
          workspaceId,
          newLeaderId,
          service.is_public !== undefined ? service.is_public : true,
          service.created_at || new Date(),
          service.updated_at || new Date()
        ]
      });
      serviceIdMap[service.id] = result[0].id;
    }
    console.log(`✓ Imported ${localServices.length} services\n`);

    // Step 8: Import service_songs
    console.log('Step 8: Importing service songs...');
    for (const serviceSong of localServiceSongs) {
      const newServiceId = serviceIdMap[serviceSong.service_id];
      const newSongId = songIdMap[serviceSong.song_id];

      if (newServiceId && newSongId) {
        await prodSequelize.query(`
          INSERT INTO service_songs (service_id, song_id, position, segment_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, {
          replacements: [
            newServiceId,
            newSongId,
            serviceSong.position || 0,
            serviceSong.segment_type || 'song',
            serviceSong.created_at || new Date(),
            serviceSong.updated_at || new Date()
          ]
        });
      }
    }
    console.log(`✓ Imported ${localServiceSongs.length} service songs\n`);

    // Step 9: Import shared_services
    console.log('Step 9: Importing shared services...');
    for (const sharedService of localSharedServices) {
      const newServiceId = serviceIdMap[sharedService.service_id];
      const newUserId = userIdMap[sharedService.shared_with_user_id];

      if (newServiceId && newUserId) {
        await prodSequelize.query(`
          INSERT INTO shared_services (service_id, shared_with_user_id, share_code, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `, {
          replacements: [
            newServiceId,
            newUserId,
            sharedService.share_code,
            sharedService.created_at || new Date(),
            sharedService.updated_at || new Date()
          ]
        });
      }
    }
    console.log(`✓ Imported ${localSharedServices.length} shared services\n`);

    // Step 10: Verify data
    console.log('Step 10: Verifying imported data...');
    const [prodUsers] = await prodSequelize.query('SELECT COUNT(*) as count FROM users');
    const [prodWorkspaces] = await prodSequelize.query('SELECT COUNT(*) as count FROM workspaces');
    const [prodSongs] = await prodSequelize.query('SELECT COUNT(*) as count FROM songs');
    const [prodServices] = await prodSequelize.query('SELECT COUNT(*) as count FROM services');

    console.log(`✓ Production users: ${prodUsers[0].count}`);
    console.log(`✓ Production workspaces: ${prodWorkspaces[0].count}`);
    console.log(`✓ Production songs: ${prodSongs[0].count}`);
    console.log(`✓ Production services: ${prodServices[0].count}\n`);

    console.log('========================================');
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('========================================');
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ MIGRATION FAILED');
    console.error('========================================');
    console.error(error);
    throw error;
  } finally {
    await localSequelize.close();
    await prodSequelize.close();
    console.log('\nDatabase connections closed.');
  }
}

// Run migration
migrateToProduction()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
