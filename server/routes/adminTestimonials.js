'use strict';

const { query } = require('../db/query');
const { sendJSON, readBody } = require('../lib/http');
const { requireAdmin } = require('../middleware/requireAdmin');

module.exports = {
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

    const result = await query(`
      INSERT INTO testimonials (name, quote, avatar, trip, rating, sort_order) VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, quote, avatar, trip, rating, sort_order);
    sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
  }),

  'PUT /api/admin/testimonials/:id': requireAdmin(async (req, res, url, params) => {
    const existing = await query('SELECT * FROM testimonials WHERE id = ?').get(params.id);
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

    await query('UPDATE testimonials SET name=?, quote=?, avatar=?, trip=?, rating=?, sort_order=? WHERE id=?')
      .run(name, quote, avatar, trip, rating, sort_order, params.id);
    sendJSON(res, 200, { ok: true });
  }),

  'DELETE /api/admin/testimonials/:id': requireAdmin(async (req, res, url, params) => {
    const result = await query('DELETE FROM testimonials WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Testimonial not found' });
    sendJSON(res, 200, { ok: true });
  })
};
