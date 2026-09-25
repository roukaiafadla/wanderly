'use strict';

const auth = require('../auth');
const { sendJSON } = require('../lib/http');

function currentAdmin(req) {
  const cookies = auth.parseCookies(req);
  return auth.getSession(cookies[auth.SESSION_COOKIE]);
}

function requireAdmin(handler) {
  return async (req, res, url, params, clientIp) => {
    const session = currentAdmin(req);
    if (!session) return sendJSON(res, 401, { error: 'Not authenticated' });
    return handler(req, res, url, params, clientIp, session);
  };
}

module.exports = { requireAdmin, currentAdmin };
