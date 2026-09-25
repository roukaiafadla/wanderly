'use strict';

const { query } = require('../db/query');

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlug(base) {
  let slug = base || 'destination';
  let n = 2;
  while (await query('SELECT id FROM destinations WHERE slug = ?').get(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

module.exports = { isNonEmptyString, EMAIL_RE, slugify, uniqueSlug };
