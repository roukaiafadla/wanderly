'use strict';

const client = require('./client');

// Mirrors the shape of node:sqlite's `db.prepare(sql).get/all/run(...)`,
// but async (libSQL is network-capable, so every call is a Promise).
// Keeps route handlers readable as `await query(sql).get(id)` instead of
// juggling client.execute({ sql, args }) everywhere.
function query(sql) {
  return {
    async get(...args) {
      const result = await client.execute({ sql, args });
      return result.rows[0];
    },
    async all(...args) {
      const result = await client.execute({ sql, args });
      return result.rows;
    },
    async run(...args) {
      const result = await client.execute({ sql, args });
      return {
        lastInsertRowid: result.lastInsertRowid,
        changes: result.rowsAffected
      };
    }
  };
}

module.exports = { query, client };
