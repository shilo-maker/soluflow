require('dotenv').config();
const { Sequelize } = require('sequelize');

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL not found in environment');
  process.exit(1);
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

async function addThemePreferences() {
  console.log('Adding theme preference columns to users table...\n');

  try {
    await sequelize.authenticate();
    console.log('✓ Connected to database\n');

    // Check if columns already exist
    const [results] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('theme_background_color', 'theme_gradient_preset', 'theme_text_color', 'theme_chord_color', 'theme_chord_size')
    `);

    if (results.length > 0) {
      console.log('Theme preference columns already exist. Skipping migration.');
      return;
    }

    // Add theme preference columns
    await sequelize.query(`
      ALTER TABLE users
      ADD COLUMN theme_background_color VARCHAR(7) DEFAULT '#ffffff',
      ADD COLUMN theme_gradient_preset VARCHAR(20) DEFAULT 'professional',
      ADD COLUMN theme_text_color VARCHAR(7) DEFAULT '#000000',
      ADD COLUMN theme_chord_color VARCHAR(7) DEFAULT '#667eea',
      ADD COLUMN theme_chord_size DECIMAL(3,2) DEFAULT 1.0
    `);

    console.log('✓ Added theme preference columns:');
    console.log('  - theme_background_color (default: #ffffff)');
    console.log('  - theme_gradient_preset (default: professional)');
    console.log('  - theme_text_color (default: #000000)');
    console.log('  - theme_chord_color (default: #667eea)');
    console.log('  - theme_chord_size (default: 1.0)');
    console.log('\n✓ Migration completed successfully!');

  } catch (error) {
    console.error('Error during migration:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

addThemePreferences();
