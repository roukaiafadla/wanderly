'use strict';

const { query } = require('../db/query');
const { sendJSON, readBody } = require('../lib/http');
const { requireAdmin } = require('../middleware/requireAdmin');

module.exports = {
  // ---------- contact messages ----------

  'GET /api/admin/contact-messages': requireAdmin(async (req, res) => {
    const rows = await query('SELECT * FROM contact_messages ORDER BY created_at DESC').all();
    sendJSON(res, 200, { messages: rows });
  }),

  'PATCH /api/admin/contact-messages/:id': requireAdmin(async (req, res, url, params) => {
    const body = await readBody(req);
    const status = (body.status || '').trim();
    if (!['new', 'read', 'archived'].includes(status)) return sendJSON(res, 422, { error: 'Invalid status.' });
    const result = await query('UPDATE contact_messages SET status = ? WHERE id = ?').run(status, params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Message not found' });
    sendJSON(res, 200, { ok: true });
  }),

  'DELETE /api/admin/contact-messages/:id': requireAdmin(async (req, res, url, params) => {
    const result = await query('DELETE FROM contact_messages WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Message not found' });
    sendJSON(res, 200, { ok: true });
  }),

  // ---------- trip requests ----------

  'GET /api/admin/trip-requests': requireAdmin(async (req, res) => {
    const rows = await query('SELECT * FROM trip_requests ORDER BY created_at DESC').all();
    sendJSON(res, 200, { requests: rows });
  }),

  'PATCH /api/admin/trip-requests/:id': requireAdmin(async (req, res, url, params) => {
    const body = await readBody(req);
    const status = (body.status || '').trim();
    if (!['new', 'contacted', 'booked', 'archived'].includes(status)) return sendJSON(res, 422, { error: 'Invalid status.' });
    const result = await query('UPDATE trip_requests SET status = ? WHERE id = ?').run(status, params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Request not found' });
    sendJSON(res, 200, { ok: true });
  }),

  'DELETE /api/admin/trip-requests/:id': requireAdmin(async (req, res, url, params) => {
    const result = await query('DELETE FROM trip_requests WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Request not found' });
    sendJSON(res, 200, { ok: true });
  }),

  // ---------- newsletter ----------

  'GET /api/admin/newsletter': requireAdmin(async (req, res) => {
    const rows = await query('SELECT * FROM newsletter_subscribers ORDER BY created_at DESC').all();
    sendJSON(res, 200, { subscribers: rows });
  }),

  'DELETE /api/admin/newsletter/:id': requireAdmin(async (req, res, url, params) => {
    const result = await query('DELETE FROM newsletter_subscribers WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Subscriber not found' });
    sendJSON(res, 200, { ok: true });
  })
};
