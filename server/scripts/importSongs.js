const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Song, Service, ServiceSong, SharedService } = require('../models');

// Parse a ChordPro file
function parseChordProFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  let title = '';
  let subtitle = '';
  let key = '';
  let authors = '';
  let parsedContent = '';

  for (const line of lines) {
    // Extract title
    const titleMatch = line.match(/\{title:(.*?)\}/);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    // Extract subtitle (artist/author)
    const subtitleMatch = line.match(/\{subtitle:(.*?)\}/);
    if (subtitleMatch) {
      subtitle = subtitleMatch[1].trim();
      authors = subtitle;
      continue;
    }

    // Extract key
    const keyMatch = line.match(/\{key:(.*?)\}/);
    if (keyMatch) {
      key = keyMatch[1].trim();
      continue;
    }

    // Skip other directive lines (textfont, textsize, etc.)
    if (line.match(/\{(textfont|textsize|tag):/)) {
      continue;
    }

    // Keep the rest of the content as-is (including chords and lyrics)
    parsedContent += line + '\n';
  }

  return {
    title: title || path.basename(filePath, '.pro'),
    authors: authors || 'Unknown',
    key: key || 'C',
    content: parsedContent.trim()
  };
}

async function clearDatabase() {
  console.log('Deleting all existing services and songs...');

  // Delete in order due to foreign key constraints
  await ServiceSong.destroy({ where: {}, force: true });
  await SharedService.destroy({ where: {}, force: true });
  await Service.destroy({ where: {}, force: true });
  await Song.destroy({ where: {}, force: true });

  console.log('Database cleared.');
}

async function importSongs() {
  try {
    const importDir = path.join(__dirname, '../../import_songs');

    if (!fs.existsSync(importDir)) {
      console.error(`Import directory not found: ${importDir}`);
      return;
    }

    // Clear existing data
    await clearDatabase();

    // Get all .pro files
    const files = fs.readdirSync(importDir).filter(f => f.endsWith('.pro'));
    console.log(`Found ${files.length} ChordPro files to import.`);

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const filePath = path.join(importDir, file);
        const songData = parseChordProFile(filePath);

        // Create song in database
        await Song.create({
          workspace_id: 1, // Assuming workspace ID 1
          title: songData.title,
          content: songData.content,
          key: songData.key,
          authors: songData.authors,
          created_by: 3, // User ID 3 (shilo)
          is_public: true, // Import existing songs as public
          approval_status: null // Already approved since they're being imported
        });

        successCount++;
        console.log(`✓ Imported: ${songData.title}`);
      } catch (err) {
        errorCount++;
        console.error(`✗ Error importing ${file}:`, err.message);
      }
    }

    console.log(`\n=== Import Complete ===`);
    console.log(`Success: ${successCount} songs`);
    console.log(`Errors: ${errorCount} songs`);

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

// Run the import
importSongs()
  .then(() => {
    console.log('\nImport script finished.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
