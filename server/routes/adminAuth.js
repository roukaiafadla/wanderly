'use strict';

const { query } = require('../db/query');
const auth = require('../auth');
const { sendJSON, readBody } = require('../lib/http');
const { rateLimited } = require('../lib/rateLimit');
const { currentAdmin } = require('../middleware/requireAdmin');

module.exports = {
  'POST /api/admin/login': async (req, res, url, params, clientIp) => {
    if (rateLimited(`admin-login:${clientIp}`, 6, 5 * 60_000)) {
      return sendJSON(res, 429, { error: 'Too many login attempts. Please wait a few minutes.' });
    }
    const body = await readBody(req);
    const username = (body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) return sendJSON(res, 422, { error: 'Username and password are required.' });

    const user = await query('SELECT * FROM admin_users WHERE username = ?').get(username);
    if (!user || !auth.verifyPassword(password, user.salt, user.hash)) {
      return sendJSON(res, 401, { error: 'Invalid username or password.' });
    }
    const sid = auth.createSession(user);
    const secure = req.headers['x-forwarded-proto'] === 'https';
    auth.setSessionCookie(res, sid, secure);
    sendJSON(res, 200, { ok: true, username: user.username });
  },

  'POST /api/admin/logout': async (req, res) => {
    const cookies = auth.parseCookies(req);
    auth.destroySession(cookies[auth.SESSION_COOKIE]);
    const secure = req.headers['x-forwarded-proto'] === 'https';
    auth.clearSessionCookie(res, secure);
    sendJSON(res, 200, { ok: true });
  },

  'GET /api/admin/me': async (req, res) => {
    const session = currentAdmin(req);
    if (!session) return sendJSON(res, 401, { error: 'Not authenticated' });
    sendJSON(res, 200, { username: session.username });
  }
};
