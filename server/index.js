'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const db = require('./db');
const auth = require('./auth');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// ---------- tiny helpers ----------

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// very small fixed-window rate limiter, keyed by IP, per route
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

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function uniqueSlug(base) {
  let slug = base || 'destination';
  let n = 2;
  while (db.prepare('SELECT id FROM destinations WHERE slug = ?').get(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

// ---------- admin auth ----------

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

// ---------- static file serving ----------

async function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, decodeURIComponent(pathname));

  // prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    let stat = await fs.promises.stat(filePath).catch(() => null);
    if (stat && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fs.promises.stat(filePath).catch(() => null);
    }
    if (!stat) {
      // SPA-friendly-ish fallback for clean URLs, e.g. /destinations
      const withHtml = filePath + '.html';
      if (fs.existsSync(withHtml)) {
        filePath = withHtml;
      } else {
        return serve404(res);
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    stream.pipe(res);
    stream.on('error', () => serve404(res));
  } catch {
    serve404(res);
  }
}

function serve404(res) {
  const notFoundPath = path.join(PUBLIC_DIR, '404.html');
  if (fs.existsSync(notFoundPath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(notFoundPath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}

// ---------- API handlers ----------

const api = {
  'GET /api/destinations': (req, res, url) => {
    const featuredOnly = url.searchParams.get('featured') === 'true';
    const rows = featuredOnly
      ? db.prepare('SELECT * FROM destinations WHERE featured = 1 ORDER BY sort_order ASC').all()
      : db.prepare('SELECT * FROM destinations ORDER BY sort_order ASC').all();
    const data = rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) }));
    sendJSON(res, 200, { destinations: data });
  },

  'GET /api/destinations/:slug': (req, res, url, params) => {
    const row = db.prepare('SELECT * FROM destinations WHERE slug = ?').get(params.slug);
    if (!row) return sendJSON(res, 404, { error: 'Destination not found' });
    sendJSON(res, 200, { destination: { ...row, tags: JSON.parse(row.tags) } });
  },

  'GET /api/testimonials': (req, res) => {
    const rows = db.prepare('SELECT id, name, quote, avatar, trip, rating FROM testimonials ORDER BY sort_order ASC').all();
    sendJSON(res, 200, { testimonials: rows });
  },

  'POST /api/contact': async (req, res, url, params, clientIp) => {
    if (rateLimited(`contact:${clientIp}`)) return sendJSON(res, 429, { error: 'Too many requests. Please try again later.' });

    const body = await readBody(req);
    const full_name = (body.full_name || '').trim();
    const email = (body.email || '').trim();
    const message = (body.message || '').trim();

    const errors = {};
    if (!isNonEmptyString(full_name)) errors.full_name = 'Full name is required.';
    if (!EMAIL_RE.test(email)) errors.email = 'A valid email is required.';
    if (!isNonEmptyString(message) || message.length < 5) errors.message = 'Message is too short.';
    if (Object.keys(errors).length) return sendJSON(res, 422, { error: 'Validation failed', fields: errors });

    const stmt = db.prepare('INSERT INTO contact_messages (full_name, email, message) VALUES (?, ?, ?)');
    const result = stmt.run(full_name, email, message);
    sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
  },

  'POST /api/trip-requests': async (req, res, url, params, clientIp) => {
    if (rateLimited(`trip:${clientIp}`)) return sendJSON(res, 429, { error: 'Too many requests. Please try again later.' });

    const body = await readBody(req);
    const full_name = (body.full_name || '').trim();
    const email = (body.email || '').trim();
    const destination = (body.destination || '').trim();
    const travelers = Number.parseInt(body.travelers, 10) || 1;
    const start_date = (body.start_date || '').trim();
    const budget = (body.budget || '').trim();
    const notes = (body.notes || '').trim();

    const errors = {};
    if (!isNonEmptyString(full_name)) errors.full_name = 'Full name is required.';
    if (!EMAIL_RE.test(email)) errors.email = 'A valid email is required.';
    if (travelers < 1 || travelers > 20) errors.travelers = 'Travelers must be between 1 and 20.';
    if (Object.keys(errors).length) return sendJSON(res, 422, { error: 'Validation failed', fields: errors });

    const stmt = db.prepare(`
      INSERT INTO trip_requests (full_name, email, destination, travelers, start_date, budget, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(full_name, email, destination || null, travelers, start_date || null, budget || null, notes || null);
    sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
  },

  'POST /api/newsletter': async (req, res, url, params, clientIp) => {
    if (rateLimited(`news:${clientIp}`, 5)) return sendJSON(res, 429, { error: 'Too many requests. Please try again later.' });
    const body = await readBody(req);
    const email = (body.email || '').trim();
    if (!EMAIL_RE.test(email)) return sendJSON(res, 422, { error: 'A valid email is required.' });
    try {
      db.prepare('INSERT INTO newsletter_subscribers (email) VALUES (?)').run(email);
      sendJSON(res, 201, { ok: true });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendJSON(res, 200, { ok: true, already: true });
      throw err;
    }
  },

  // ---------- admin: auth ----------

  'POST /api/admin/login': async (req, res, url, params, clientIp) => {
    if (rateLimited(`admin-login:${clientIp}`, 6, 5 * 60_000)) {
      return sendJSON(res, 429, { error: 'Too many login attempts. Please wait a few minutes.' });
    }
    const body = await readBody(req);
    const username = (body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) return sendJSON(res, 422, { error: 'Username and password are required.' });

    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
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
  },

  // ---------- admin: dashboard stats ----------

  'GET /api/admin/stats': requireAdmin(async (req, res) => {
    const count = (sql) => db.prepare(sql).get().n;
    sendJSON(res, 200, {
      destinations: count('SELECT COUNT(*) n FROM destinations'),
      testimonials: count('SELECT COUNT(*) n FROM testimonials'),
      contact_new: count("SELECT COUNT(*) n FROM contact_messages WHERE status = 'new'"),
      trip_new: count("SELECT COUNT(*) n FROM trip_requests WHERE status = 'new'"),
      newsletter: count('SELECT COUNT(*) n FROM newsletter_subscribers')
    });
  }),

  // ---------- admin: destinations CRUD ----------

  'POST /api/admin/destinations': requireAdmin(async (req, res) => {
    const body = await readBody(req);
    const name = (body.name || '').trim();
    const country = (body.country || '').trim();
    const price_from = Number.parseInt(body.price_from, 10);
    const rating = Number.parseFloat(body.rating);
    const image = (body.image || '').trim();
    const blurb = (body.blurb || '').trim();
    const tags = Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',').map((t) => t.trim()).filter(Boolean);

    const errors = {};
    if (!name) errors.name = 'Name is required.';
    if (!country) errors.country = 'Country is required.';
    if (!image) errors.image = 'Image path is required.';
    if (!Number.isFinite(price_from) || price_from < 0) errors.price_from = 'Price must be a non-negative number.';
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) errors.rating = 'Rating must be between 0 and 5.';
    if (Object.keys(errors).length) return sendJSON(res, 422, { error: 'Validation failed', fields: errors });

    const slug = uniqueSlug(slugify(`${name}-${country}`));
    const featured = body.featured ? 1 : 0;
    const sort_order = Number.parseInt(body.sort_order, 10) || 0;
    const review_count = Number.parseInt(body.review_count, 10) || 0;

    const result = db.prepare(`
      INSERT INTO destinations (slug, name, country, price_from, rating, review_count, tags, image, blurb, featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slug, name, country, price_from, rating, review_count, JSON.stringify(tags), image, blurb, featured, sort_order);

    sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid), slug });
  }),

  'PUT /api/admin/destinations/:id': requireAdmin(async (req, res, url, params) => {
    const existing = db.prepare('SELECT * FROM destinations WHERE id = ?').get(params.id);
    if (!existing) return sendJSON(res, 404, { error: 'Destination not found' });

    const body = await readBody(req);
    const name = (body.name || existing.name).trim();
    const country = (body.country || existing.country).trim();
    const price_from = body.price_from !== undefined ? Number.parseInt(body.price_from, 10) : existing.price_from;
    const rating = body.rating !== undefined ? Number.parseFloat(body.rating) : existing.rating;
    const image = (body.image || existing.image).trim();
    const blurb = body.blurb !== undefined ? String(body.blurb).trim() : existing.blurb;
    const tags = body.tags !== undefined
      ? (Array.isArray(body.tags) ? body.tags : String(body.tags).split(',').map((t) => t.trim()).filter(Boolean))
      : JSON.parse(existing.tags);
    const featured = body.featured !== undefined ? (body.featured ? 1 : 0) : existing.featured;
    const sort_order = body.sort_order !== undefined ? Number.parseInt(body.sort_order, 10) : existing.sort_order;
    const review_count = body.review_count !== undefined ? Number.parseInt(body.review_count, 10) : existing.review_count;

    const errors = {};
    if (!name) errors.name = 'Name is required.';
    if (!country) errors.country = 'Country is required.';
    if (!Number.isFinite(price_from) || price_from < 0) errors.price_from = 'Price must be a non-negative number.';
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) errors.rating = 'Rating must be between 0 and 5.';
    if (Object.keys(errors).length) return sendJSON(res, 422, { error: 'Validation failed', fields: errors });

    db.prepare(`
      UPDATE destinations SET name=?, country=?, price_from=?, rating=?, review_count=?, tags=?, image=?, blurb=?, featured=?, sort_order=?
      WHERE id=?
    `).run(name, country, price_from, rating, review_count, JSON.stringify(tags), image, blurb, featured, sort_order, params.id);

    sendJSON(res, 200, { ok: true });
  }),

  'DELETE /api/admin/destinations/:id': requireAdmin(async (req, res, url, params) => {
    const result = db.prepare('DELETE FROM destinations WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Destination not found' });
    sendJSON(res, 200, { ok: true });
  }),

  // ---------- admin: testimonials CRUD ----------

  'POST /api/admin/testimonials': requireAdmin(async (req, res) => {
    const body = await readBody(req);
    const name = (body.name || '').trim();
    const quote = (body.quote || '').trim();
    const avatar = (body.avatar || '').trim();
    const trip = (body.trip || '').trim();
    const rating = Number.parseInt(body.rating, 10) || 5;
    const sort_order = Number.parseInt(body.sort_order, 10) || 0;

    const errors = {};
    if (!name) errors.name = 'Name is required.';
    if (!quote) errors.quote = 'Quote is required.';
    if (!avatar) errors.avatar = 'Avatar path is required.';
    if (Object.keys(errors).length) return sendJSON(res, 422, { error: 'Validation failed', fields: errors });

    const result = db.prepare(`
      INSERT INTO testimonials (name, quote, avatar, trip, rating, sort_order) VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, quote, avatar, trip, rating, sort_order);
    sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
  }),

  'PUT /api/admin/testimonials/:id': requireAdmin(async (req, res, url, params) => {
    const existing = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(params.id);
    if (!existing) return sendJSON(res, 404, { error: 'Testimonial not found' });
    const body = await readBody(req);
    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    const quote = body.quote !== undefined ? String(body.quote).trim() : existing.quote;
    const avatar = body.avatar !== undefined ? String(body.avatar).trim() : existing.avatar;
    const trip = body.trip !== undefined ? String(body.trip).trim() : existing.trip;
    const rating = body.rating !== undefined ? Number.parseInt(body.rating, 10) : existing.rating;
    const sort_order = body.sort_order !== undefined ? Number.parseInt(body.sort_order, 10) : existing.sort_order;

    const errors = {};
    if (!name) errors.name = 'Name is required.';
    if (!quote) errors.quote = 'Quote is required.';
    if (Object.keys(errors).length) return sendJSON(res, 422, { error: 'Validation failed', fields: errors });

    db.prepare('UPDATE testimonials SET name=?, quote=?, avatar=?, trip=?, rating=?, sort_order=? WHERE id=?')
      .run(name, quote, avatar, trip, rating, sort_order, params.id);
    sendJSON(res, 200, { ok: true });
  }),

  'DELETE /api/admin/testimonials/:id': requireAdmin(async (req, res, url, params) => {
    const result = db.prepare('DELETE FROM testimonials WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Testimonial not found' });
    sendJSON(res, 200, { ok: true });
  }),

  // ---------- admin: leads ----------

  'GET /api/admin/contact-messages': requireAdmin(async (req, res) => {
    const rows = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
    sendJSON(res, 200, { messages: rows });
  }),

  'PATCH /api/admin/contact-messages/:id': requireAdmin(async (req, res, url, params) => {
    const body = await readBody(req);
    const status = (body.status || '').trim();
    if (!['new', 'read', 'archived'].includes(status)) return sendJSON(res, 422, { error: 'Invalid status.' });
    const result = db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(status, params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Message not found' });
    sendJSON(res, 200, { ok: true });
  }),

  'DELETE /api/admin/contact-messages/:id': requireAdmin(async (req, res, url, params) => {
    const result = db.prepare('DELETE FROM contact_messages WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Message not found' });
    sendJSON(res, 200, { ok: true });
  }),

  'GET /api/admin/trip-requests': requireAdmin(async (req, res) => {
    const rows = db.prepare('SELECT * FROM trip_requests ORDER BY created_at DESC').all();
    sendJSON(res, 200, { requests: rows });
  }),

  'PATCH /api/admin/trip-requests/:id': requireAdmin(async (req, res, url, params) => {
    const body = await readBody(req);
    const status = (body.status || '').trim();
    if (!['new', 'contacted', 'booked', 'archived'].includes(status)) return sendJSON(res, 422, { error: 'Invalid status.' });
    const result = db.prepare('UPDATE trip_requests SET status = ? WHERE id = ?').run(status, params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Request not found' });
    sendJSON(res, 200, { ok: true });
  }),

  'DELETE /api/admin/trip-requests/:id': requireAdmin(async (req, res, url, params) => {
    const result = db.prepare('DELETE FROM trip_requests WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Request not found' });
    sendJSON(res, 200, { ok: true });
  }),

  'GET /api/admin/newsletter': requireAdmin(async (req, res) => {
    const rows = db.prepare('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC').all();
    sendJSON(res, 200, { subscribers: rows });
  }),

  'DELETE /api/admin/newsletter/:id': requireAdmin(async (req, res, url, params) => {
    const result = db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Subscriber not found' });
    sendJSON(res, 200, { ok: true });
  })
};

// route matcher supporting one ":param" segment
function matchRoute(method, pathname) {
  for (const key of Object.keys(api)) {
    const [routeMethod, routePath] = key.split(' ');
    if (routeMethod !== method) continue;
    const routeParts = routePath.split('/');
    const pathParts = pathname.split('/');
    if (routeParts.length !== pathParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      else if (routeParts[i] !== pathParts[i]) { ok = false; break; }
    }
    if (ok) return { handler: api[key], params };
  }
  return null;
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientIp = req.socket.remoteAddress || 'unknown';

  if (url.pathname.startsWith('/api/')) {
    const match = matchRoute(req.method, url.pathname);
    if (!match) return sendJSON(res, 404, { error: 'Not found' });
    try {
      await match.handler(req, res, url, match.params, clientIp);
    } catch (err) {
      const status = err.status || 500;
      sendJSON(res, status, { error: status === 500 ? 'Internal server error' : err.message });
    }
    return;
  }

  serveStatic(req, res, url.pathname === '/' ? '/index.html' : url.pathname);
});

server.listen(PORT, () => {
  console.log(`Wanderly server running at http://localhost:${PORT}`);
});
