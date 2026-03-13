const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

/**
 * Migration to add font_size column to service_songs table
 * This allows per-song font size to be saved within a service context
 */

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Checking if font_size column exists on service_songs...');

    // Check if column already exists (safe for re-runs)
    const tableDescription = await queryInterface.describeTable('service_songs');

    if (tableDescription.font_size) {
      console.log('✓ font_size column already exists — skipping');
      return;
    }

    console.log('Adding font_size column to service_songs table...');

    await queryInterface.addColumn('service_songs', 'font_size', {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Per-song font size set by service creator (null = default 14px)'
    });

    console.log('✓ Successfully added font_size column');
  } catch (error) {
    console.error('Error adding font_size column:', error);
    throw error;
  }
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    console.log('Removing font_size column from service_songs table...');

    await queryInterface.removeColumn('service_songs', 'font_size');

    console.log('✓ Successfully removed font_size column');
  } catch (error) {
    console.error('Error removing font_size column:', error);
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
