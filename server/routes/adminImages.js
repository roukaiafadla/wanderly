'use strict';

const { query } = require('../db/query');
const { sendJSON, readBody } = require('../lib/http');
const { requireAdmin } = require('../middleware/requireAdmin');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_UPLOAD_BYTES = 4_000_000; // ~4MB, generous headroom for a base64-encoded 2-3MB source image

module.exports = {
  // Body: { data: "data:image/png;base64,....", filename?: string }
  'POST /api/admin/images': requireAdmin(async (req, res) => {
    const body = await readBody(req, MAX_UPLOAD_BYTES);
    const dataUrl = String(body.data || '');
    const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
    if (!match) return sendJSON(res, 422, { error: 'Validation failed', fields: { data: 'Expected a base64 data URL.' } });

    const [, mimeType, base64] = match;
    if (!ALLOWED_MIME.has(mimeType)) {
      return sendJSON(res, 422, { error: 'Validation failed', fields: { data: 'Only JPEG, PNG, WebP, or AVIF images are allowed.' } });
    }

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0) return sendJSON(res, 422, { error: 'Validation failed', fields: { data: 'Image data is empty.' } });
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return sendJSON(res, 422, { error: 'Validation failed', fields: { data: 'Image is too large (max ~3MB).' } });
    }

    const result = await query('INSERT INTO images (mime_type, data) VALUES (?, ?)').run(mimeType, buffer);
    const id = Number(result.lastInsertRowid);
    sendJSON(res, 201, { ok: true, id, url: `/api/images/${id}` });
  }),

  'DELETE /api/admin/images/:id': requireAdmin(async (req, res, url, params) => {
    const result = await query('DELETE FROM images WHERE id = ?').run(params.id);
    if (result.changes === 0) return sendJSON(res, 404, { error: 'Image not found' });
    sendJSON(res, 200, { ok: true });
  })
};
