const { sequelize } = require('../config/database');
const { QueryInterface, DataTypes } = require('sequelize');

/**
 * Migration to add listen_url column to songs table
 * This allows users to add YouTube, Spotify, or other streaming links to songs
 */

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Adding listen_url column to songs table...');

    await queryInterface.addColumn('songs', 'listen_url', {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL to listen to the song (YouTube, Spotify, etc.)'
    });

    console.log('✓ Successfully added listen_url column');
  } catch (error) {
    console.error('Error adding listen_url column:', error);
    throw error;
  }
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Removing listen_url column from songs table...');

    await queryInterface.removeColumn('songs', 'listen_url');

    console.log('✓ Successfully removed listen_url column');
  } catch (error) {
    console.error('Error removing listen_url column:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  up()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { up, down };
