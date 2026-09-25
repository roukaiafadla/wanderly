'use strict';

// No dotenv dependency needed — run with `node --env-file=.env ...`
// (Node 20.6+) and process.env is already populated by the time this loads.
// Falls back to sane local defaults so `node server/index.js` still works
// with zero setup.

const config = {
  port: Number.parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database: leave both unset to use a local SQLite file at server/data/wanderly.db.
  // Set both to point at a Turso (libSQL) database for a deployment where the
  // filesystem doesn't persist across restarts/redeploys.
  databaseUrl: process.env.DATABASE_URL || null,
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN || null,

  sessionTtlMs: Number.parseInt(process.env.SESSION_TTL_MS, 10) || 12 * 60 * 60 * 1000
};

if (config.databaseUrl && config.databaseUrl.startsWith('libsql://') && !config.databaseAuthToken) {
  // eslint-disable-next-line no-console
  console.warn('[config] DATABASE_URL looks like a remote Turso database but DATABASE_AUTH_TOKEN is not set.');
}

module.exports = config;
