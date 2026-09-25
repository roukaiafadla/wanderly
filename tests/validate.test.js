'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isNonEmptyString, EMAIL_RE, slugify } = require('../server/lib/validate');

test('isNonEmptyString rejects blank/whitespace-only strings', () => {
  assert.equal(isNonEmptyString(''), false);
  assert.equal(isNonEmptyString('   '), false);
  assert.equal(isNonEmptyString(null), false);
  assert.equal(isNonEmptyString(undefined), false);
  assert.equal(isNonEmptyString('hi'), true);
});

test('EMAIL_RE accepts valid emails and rejects invalid ones', () => {
  assert.equal(EMAIL_RE.test('a@b.com'), true);
  assert.equal(EMAIL_RE.test('name.surname@sub.example.co'), true);
  assert.equal(EMAIL_RE.test('bad'), false);
  assert.equal(EMAIL_RE.test('bad@'), false);
  assert.equal(EMAIL_RE.test('@bad.com'), false);
  assert.equal(EMAIL_RE.test('bad @bad.com'), false);
});

test('slugify lowercases, strips accents, and dashes non-alphanumerics', () => {
  assert.equal(slugify('Ghardaïa Algeria'), 'ghardaia-algeria');
  assert.equal(slugify('Reykjavík'), 'reykjavik');
  assert.equal(slugify('  Trailing Spaces  '), 'trailing-spaces');
  assert.equal(slugify('São Paulo!!'), 'sao-paulo');
});
