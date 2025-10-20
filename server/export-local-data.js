const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Local SQLite database
const localSequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

async function exportData() {
  try {
    console.log('Exporting data from local database...\n');

    await localSequelize.authenticate();
    console.log('✓ Connected to local database');

    // Export users
    const [users] = await localSequelize.query('SELECT * FROM users');
    console.log(`✓ Exported ${users.length} users`);

    // Export songs
    const [songs] = await localSequelize.query('SELECT * FROM songs');
    console.log(`✓ Exported ${songs.length} songs`);

    // Export services
    const [services] = await localSequelize.query('SELECT * FROM services');
    console.log(`✓ Exported ${services.length} services`);

    // Export service_songs
    const [serviceSongs] = await localSequelize.query('SELECT * FROM service_songs');
    console.log(`✓ Exported ${serviceSongs.length} service_songs`);

    // Export shared_services
    const [sharedServices] = await localSequelize.query('SELECT * FROM shared_services');
    console.log(`✓ Exported ${sharedServices.length} shared_services`);

    // Create export object
    const exportData = {
      users,
      songs,
      services,
      serviceSongs,
      sharedServices,
      exportedAt: new Date().toISOString()
    };

    // Write to file
    const exportPath = path.join(__dirname, 'local-data-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

    console.log(`\n✅ Data exported to: ${exportPath}`);
    console.log(`\nNext step: Run the import script with your production API URL`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await localSequelize.close();
  }
}

exportData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
