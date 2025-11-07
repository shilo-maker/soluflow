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

async function updateAllUsersToNatureTheme() {
  console.log('Updating all users to Nature theme...\n');

  try {
    await sequelize.authenticate();
    console.log('✓ Connected to database\n');

    // Check how many users will be updated
    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as count FROM users
    `);
    const userCount = countResult[0].count;
    console.log(`Found ${userCount} users to update\n`);

    // Update all users to Nature theme
    await sequelize.query(`
      UPDATE users
      SET
        theme_gradient_preset = 'nature',
        theme_chord_color = '#38b2ac'
      WHERE
        theme_gradient_preset IS NOT NULL
        OR theme_chord_color IS NOT NULL
    `);

    console.log('✓ Updated all users to Nature theme:');
    console.log('  - theme_gradient_preset = nature');
    console.log('  - theme_chord_color = #38b2ac (turquoise)');
    console.log(`\n✓ Migration completed successfully! ${userCount} users updated.`);

  } catch (error) {
    console.error('Error during migration:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

updateAllUsersToNatureTheme();
