'use strict';

/**
 * Migration: Add edit_token to services table
 * Run: node server/migrations/add-edit-token.js
 *
 * Uses the same database config as the app (DATABASE_URL, SQLite, or local PostgreSQL).
 * Safe to re-run — skips if column already exists.
 */

const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { sequelize } = require('../config/database');

async function migrate() {
  console.log('=== Add edit_token to services ===\n');

  try {
    await sequelize.authenticate();
    console.log('Connected to database.\n');

    // Check if column already exists
    const dialect = sequelize.getDialect();
    let columnExists = false;

    if (dialect === 'sqlite') {
      const [cols] = await sequelize.query("PRAGMA table_info('services')");
      columnExists = cols.some(c => c.name === 'edit_token');
    } else {
      const [cols] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'services' AND column_name = 'edit_token'
      `);
      columnExists = cols.length > 0;
    }

    if (columnExists) {
      console.log('Column edit_token already exists — skipping ALTER TABLE.');
    } else {
      console.log('1. Adding edit_token column...');
      if (dialect === 'sqlite') {
        await sequelize.query('ALTER TABLE services ADD COLUMN edit_token TEXT');
      } else {
        await sequelize.query('ALTER TABLE services ADD COLUMN edit_token VARCHAR(64)');
      }
      console.log('   Done.\n');
    }

    // Backfill existing services that have no edit_token
    console.log('2. Backfilling existing services with random tokens...');
    const [services] = await sequelize.query(
      'SELECT id FROM services WHERE edit_token IS NULL'
    );
    console.log(`   Found ${services.length} services to backfill.`);

    for (const service of services) {
      const token = crypto.randomBytes(32).toString('hex');
      await sequelize.query(
        'UPDATE services SET edit_token = $token WHERE id = $id',
        { bind: { token, id: service.id } }
      );
    }
    console.log('   Done.\n');

    // Add unique index (if not exists)
    console.log('3. Adding unique index on edit_token...');
    try {
      if (dialect === 'sqlite') {
        await sequelize.query(
          'CREATE UNIQUE INDEX IF NOT EXISTS services_edit_token_unique ON services(edit_token)'
        );
      } else {
        await sequelize.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS services_edit_token_unique ON services(edit_token)
        `);
      }
      console.log('   Done.\n');
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        console.log('   Index already exists — skipping.\n');
      } else {
        throw err;
      }
    }

    console.log('=== Migration complete ===');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
