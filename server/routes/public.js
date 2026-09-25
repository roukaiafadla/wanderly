'use strict';

const { query } = require('../db/query');
const { sendJSON, readBody } = require('../lib/http');
const { rateLimited } = require('../lib/rateLimit');
const { isNonEmptyString, EMAIL_RE } = require('../lib/validate');

module.exports = {
  'GET /api/destinations': async (req, res, url) => {
    const featuredOnly = url.searchParams.get('featured') === 'true';
    const rows = featuredOnly
      ? await query('SELECT * FROM destinations WHERE featured = 1 ORDER BY sort_order ASC').all()
      : await query('SELECT * FROM destinations ORDER BY sort_order ASC').all();
    const data = rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) }));
    sendJSON(res, 200, { destinations: data });
  },

  'GET /api/destinations/:slug': async (req, res, url, params) => {
    const row = await query('SELECT * FROM destinations WHERE slug = ?').get(params.slug);
    if (!row) return sendJSON(res, 404, { error: 'Destination not found' });
    sendJSON(res, 200, { destination: { ...row, tags: JSON.parse(row.tags) } });
  },

  'GET /api/testimonials': async (req, res) => {
    const rows = await query('SELECT id, name, quote, avatar, trip, rating FROM testimonials ORDER BY sort_order ASC').all();
    sendJSON(res, 200, { testimonials: rows });
  },

  // Serves images uploaded through the admin dashboard, stored as blobs in
  // the same database (so they persist on hosts with an ephemeral filesystem,
  // same as the rest of the data).
  'GET /api/images/:id': async (req, res, url, params) => {
    const row = await query('SELECT mime_type, data FROM images WHERE id = ?').get(params.id);
    if (!row) return sendJSON(res, 404, { error: 'Image not found' });
    const buffer = Buffer.from(row.data);
    res.writeHead(200, {
      'Content-Type': row.mime_type,
      'Content-Length': buffer.length,
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    res.end(buffer);
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

    const result = await query('INSERT INTO contact_messages (full_name, email, message) VALUES (?, ?, ?)').run(full_name, email, message);
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

    const result = await query(`
      INSERT INTO trip_requests (full_name, email, destination, travelers, start_date, budget, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(full_name, email, destination || null, travelers, start_date || null, budget || null, notes || null);
    sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
  },

  'POST /api/newsletter': async (req, res, url, params, clientIp) => {
    if (rateLimited(`news:${clientIp}`, 5)) return sendJSON(res, 429, { error: 'Too many requests. Please try again later.' });
    const body = await readBody(req);
    const email = (body.email || '').trim();
    if (!EMAIL_RE.test(email)) return sendJSON(res, 422, { error: 'A valid email is required.' });
    try {
      await query('INSERT INTO newsletter_subscribers (email) VALUES (?)').run(email);
      sendJSON(res, 201, { ok: true });
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) return sendJSON(res, 200, { ok: true, already: true });
      throw err;
    }
  }
};
