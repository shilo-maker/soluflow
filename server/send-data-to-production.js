const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Your production API URL
const PRODUCTION_API_URL = process.env.PRODUCTION_API_URL || 'https://your-api-url.onrender.com';

async function sendData() {
  try {
    // Read the exported data file
    const exportPath = path.join(__dirname, 'local-data-export.json');

    if (!fs.existsSync(exportPath)) {
      console.error('❌ Export file not found!');
      console.log('Please run: node export-local-data.js first');
      process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    console.log('📦 Loaded export data:');
    console.log(`   - ${data.users?.length || 0} users`);
    console.log(`   - ${data.songs?.length || 0} songs`);
    console.log(`   - ${data.services?.length || 0} services`);
    console.log(`   - ${data.serviceSongs?.length || 0} service songs`);
    console.log(`   - ${data.sharedServices?.length || 0} shared services\n`);

    // Send to production
    const apiUrl = `${PRODUCTION_API_URL}/api/import/data`;
    console.log(`🚀 Sending data to: ${apiUrl}\n`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Import successful!');
    console.log('\nImported:');
    console.log(`   - ${result.imported.users} users`);
    console.log(`   - ${result.imported.workspaces} workspaces`);
    console.log(`   - ${result.imported.songs} songs`);
    console.log(`   - ${result.imported.services} services`);
    console.log(`   - ${result.imported.serviceSongs} service songs`);
    console.log(`   - ${result.imported.sharedServices} shared services\n`);

    console.log('🎉 Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Test your production app');
    console.log('2. REMOVE the import route from server.js (security)');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

sendData();
