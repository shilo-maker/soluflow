const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './server/database.sqlite',
  logging: console.log
});

async function migrate() {
  console.log('=== Starting Song Sharing Migration ===\n');

  try {
    // 1. Add code column to songs table (without UNIQUE constraint due to SQLite limitation)
    console.log('1. Adding code column to songs table...');
    await sequelize.query(`
      ALTER TABLE songs
      ADD COLUMN code TEXT
    `);
    console.log('✓ Added code column to songs table\n');

    // 2. Create unique index on code column
    console.log('2. Creating unique index on songs.code column...');
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_songs_code ON songs(code)
    `);
    console.log('✓ Created unique index on songs.code\n');

    // 3. Create shared_songs table
    console.log('3. Creating shared_songs table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS shared_songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        shared_by INTEGER NOT NULL,
        shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_by) REFERENCES users(id),
        UNIQUE(song_id, user_id)
      )
    `);
    console.log('✓ Created shared_songs table\n');

    // 4. Create indexes for shared_songs table
    console.log('4. Creating indexes on shared_songs table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_shared_songs_user_id ON shared_songs(user_id)
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_shared_songs_song_id ON shared_songs(song_id)
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_shared_songs_shared_by ON shared_songs(shared_by)
    `);
    console.log('✓ Created indexes on shared_songs table\n');

    console.log('=== Migration Completed Successfully! ===');
    console.log('\nSong sharing features enabled:');
    console.log('- Users can now generate share codes for their songs');
    console.log('- Songs can be shared via link, code, or QR code');
    console.log('- Shared songs appear in recipient\'s library with "Shared with me" badge');
    console.log('- Only personal and workspace songs can be shared (not public songs)\n');

  } catch (error) {
    console.error('✗ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

migrate();
