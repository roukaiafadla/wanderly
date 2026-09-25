'use strict';

function timestamp() {
  return new Date().toISOString();
}

function line(level, msg, meta) {
  const base = `[${timestamp()}] ${level.toUpperCase()} ${msg}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

const logger = {
  info(msg, meta) {
    console.log(line('info', msg, meta));
  },
  warn(msg, meta) {
    console.warn(line('warn', msg, meta));
  },
  error(msg, meta) {
    console.error(line('error', msg, meta));
  },
  // One line per request: method, path, status, duration.
  request(req, status, durationMs) {
    console.log(line('http', `${req.method} ${req.url} ${status} ${durationMs}ms`));
  }
};

module.exports = logger;
