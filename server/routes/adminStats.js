'use strict';

const { query } = require('../db/query');
const { sendJSON } = require('../lib/http');
const { requireAdmin } = require('../middleware/requireAdmin');

module.exports = {
  'GET /api/admin/stats': requireAdmin(async (req, res) => {
    const count = async (sql) => (await query(sql).get()).n;
    sendJSON(res, 200, {
      destinations: await count('SELECT COUNT(*) n FROM destinations'),
      testimonials: await count('SELECT COUNT(*) n FROM testimonials'),
      contact_new: await count("SELECT COUNT(*) n FROM contact_messages WHERE status = 'new'"),
      trip_new: await count("SELECT COUNT(*) n FROM trip_requests WHERE status = 'new'"),
      newsletter: await count('SELECT COUNT(*) n FROM newsletter_subscribers')
    });
  }),

  // Recent activity feed for the Overview page: latest contact messages,
  // trip requests, and newsletter signups, merged and sorted by time.
  'GET /api/admin/activity': requireAdmin(async (req, res) => {
    const [messages, trips, subs] = await Promise.all([
      query('SELECT id, full_name, email, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 10').all(),
      query('SELECT id, full_name, destination, created_at FROM trip_requests ORDER BY created_at DESC LIMIT 10').all(),
      query('SELECT id, email, created_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 10').all()
    ]);

    const events = [
      ...messages.map((m) => ({ type: 'contact', id: m.id, created_at: m.created_at, summary: `${m.full_name} sent a message` })),
      ...trips.map((t) => ({ type: 'trip', id: t.id, created_at: t.created_at, summary: `${t.full_name} requested a trip${t.destination ? ` to ${t.destination}` : ''}` })),
      ...subs.map((s) => ({ type: 'newsletter', id: s.id, created_at: s.created_at, summary: `${s.email} subscribed to the newsletter` }))
    ];

    events.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    sendJSON(res, 200, { events: events.slice(0, 10) });
  })
};
