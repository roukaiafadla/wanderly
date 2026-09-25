'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { client } = require('./query');
const config = require('../config/env');

async function migrate() {
  // WAL mode is a local-file-only pragma; skip it against a remote Turso db.
  if (!config.databaseUrl) {
    await client.execute('PRAGMA journal_mode = WAL');
  }

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.execute(statement);
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Schema is up to date.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = migrate;
