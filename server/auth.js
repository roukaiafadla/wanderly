'use strict';

const crypto = require('node:crypto');
const config = require('./config/env');

const SESSION_COOKIE = 'wanderly_admin_sid';
const SESSION_TTL_MS = config.sessionTtlMs; // 12h idle-ish TTL by default (renewed on login only)

// In-memory session store — fine for a single-process admin panel.
// Restarting the server logs everyone out; that's an accepted trade-off
// for keeping this dependency-free.
const sessions = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(check, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSession(user) {
  const sid = crypto.randomBytes(32).toString('hex');
  sessions.set(sid, { userId: user.id, username: user.username, expires: Date.now() + SESSION_TTL_MS });
  return sid;
}

function getSession(sid) {
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  if (Date.now() > s.expires) {
    sessions.delete(sid);
    return null;
  }
  return s;
}

function destroySession(sid) {
  if (sid) sessions.delete(sid);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function setSessionCookie(res, sid, secure) {
  const parts = [
    `${SESSION_COOKIE}=${sid}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res, secure) {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  parseCookies,
  setSessionCookie,
  clearSessionCookie
};
