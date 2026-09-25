'use strict';

const { query } = require('../db/query');
const { sendJSON, readBody } = require('../lib/http');
const { requireAdmin } = require('../middleware/requireAdmin');
const { slugify, uniqueSlug } = require('../lib/validate');

module.exports = {
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

    const slug = await uniqueSlug(slugify(`${name}-${country}`));
    const featured = body.featured ? 1 : 0;
    const sort_order = Number.parseInt(body.sort_order, 10) || 0;
    const review_count = Number.parseInt(body.review_count, 10) || 0;

    const result = await query(`
      INSERT INTO destinations (slug, name, country, price_from, rating, review_count, tags, image, blurb, featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slug, name, country, price_from, rating, review_count, JSON.stringify(tags), image, blurb, featured, sort_order);

    sendJSON(res, 201, { ok: true, id: Number(result.lastInsertRowid), slug });
  }),

  'PUT /api/admin/destinations/:id': requireAdmin(async (req, res, url, params) => {
    const existing = await query('SELECT * FROM destinations WHERE id = ?').get(params.id);
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

    await query(`
      UPDATE destinations SET name=?, country=?, price_from=?, rating=?, review_count=?, tags=?, image=?, blurb=?, featured=?, sort_order=?
      WHERE id=?
    `).run(name, country, price_from, rating, review_count, JSON.stringify(tags), image, blurb, featured, sort_order, params.id);

    sendJSON(res, 200, { ok: true });
  }),

  'DELETE /api/admin/destinations/:id': requireAdmin(async (req, res, url, params) => {
    const result = await query('DELETE FROM destinations WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Destination not found' });
    sendJSON(res, 200, { ok: true });
  })
};
