'use strict';

// Very small fixed-window rate limiter, keyed by caller-supplied string
// (e.g. `contact:${ip}`). In-memory, per-process — fine for a single
// instance; would need a shared store (e.g. Redis) behind a load balancer.
const hits = new Map();

function rateLimited(key, max = 8, windowMs = 60_000) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > windowMs) {
    hits.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

module.exports = { rateLimited };
