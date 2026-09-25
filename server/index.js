'use strict';

const http = require('node:http');
const { URL } = require('node:url');
const config = require('./config/env');
const logger = require('./lib/logger');
const { sendJSON, serveStatic } = require('./lib/http');
const { matchRoute } = require('./routes');

const server = http.createServer(async (req, res) => {
  const start = Date.now();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientIp = req.socket.remoteAddress || 'unknown';

  res.on('finish', () => logger.request(req, res.statusCode, Date.now() - start));

  if (url.pathname.startsWith('/api/')) {
    const match = matchRoute(req.method, url.pathname);
    if (!match) return sendJSON(res, 404, { error: 'Not found' });
    try {
      await match.handler(req, res, url, match.params, clientIp);
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) logger.error('Unhandled route error', { path: url.pathname, message: err.message });
      sendJSON(res, status, { error: status === 500 ? 'Internal server error' : err.message });
    }
    return;
  }

  serveStatic(req, res, url.pathname === '/' ? '/index.html' : url.pathname);
});

server.listen(config.port, () => {
  logger.info(`Wanderly server running at http://localhost:${config.port}`, { env: config.nodeEnv });
});

module.exports = server;
