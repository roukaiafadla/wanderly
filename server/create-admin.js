'use strict';

// Usage: node server/create-admin.js <username> <password>
// Creates the admin user, or resets the password if the username already exists.

const db = require('./db');
const { hashPassword } = require('./auth');

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error('Usage: node server/create-admin.js <username> <password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const { salt, hash } = hashPassword(password);
const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);

if (existing) {
  db.prepare('UPDATE admin_users SET salt = ?, hash = ? WHERE username = ?').run(salt, hash, username);
  console.log(`Password updated for admin user "${username}".`);
} else {
  db.prepare('INSERT INTO admin_users (username, salt, hash) VALUES (?, ?, ?)').run(username, salt, hash);
  console.log(`Admin user "${username}" created.`);
}
console.log('You can now log in at /admin/login.html');
