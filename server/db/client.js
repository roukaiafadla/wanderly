'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { createClient } = require('@libsql/client');
const config = require('../config/env');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const LOCAL_DB_PATH = path.join(DATA_DIR, 'wanderly.db');

// Same client, two backends: a local file for development/tests, or a
// remote Turso (libSQL) database in production so data survives redeploys
// on hosts with an ephemeral filesystem (e.g. Render's free tier).
const client = createClient(
  config.databaseUrl
    ? { url: config.databaseUrl, authToken: config.databaseAuthToken || undefined }
    : { url: `file:${LOCAL_DB_PATH}` }
);

module.exports = client;
