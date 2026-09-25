'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const REPO_ROOT = path.join(__dirname, '..');
const TEST_DB = path.join(os.tmpdir(), `wanderly-test-${Date.now()}.db`);

let serverProcess;

function waitForServer(url, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function attempt() {
      fetch(url).then(() => resolve()).catch(() => {
        if (Date.now() - start > timeoutMs) return reject(new Error('Server did not start in time'));
        setTimeout(attempt, 100);
      });
    })();
  });
}

before(async () => {
  const env = {
    ...process.env,
    PORT: String(PORT),
    DATABASE_URL: `file:${TEST_DB}`,
    DATABASE_AUTH_TOKEN: ''
  };

  // Build a fresh schema + seed data + a known admin user for this run.
  await new Promise((resolve, reject) => {
    const p = spawn('node', ['server/seed.js'], { cwd: REPO_ROOT, env });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('seed failed'))));
  });
  await new Promise((resolve, reject) => {
    const p = spawn('node', ['server/create-admin.js', 'testadmin', 'testpassword123'], { cwd: REPO_ROOT, env });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('create-admin failed'))));
  });

  serverProcess = spawn('node', ['server/index.js'], { cwd: REPO_ROOT, env });
  await waitForServer(`${BASE}/api/destinations`);
});

after(async () => {
  serverProcess.kill();
  fs.rmSync(TEST_DB, { force: true });
  fs.rmSync(`${TEST_DB}-wal`, { force: true });
  fs.rmSync(`${TEST_DB}-shm`, { force: true });
});

test('GET /api/destinations returns seeded destinations', async () => {
  const res = await fetch(`${BASE}/api/destinations`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.destinations.length, 8);
  assert.ok(body.destinations[0].tags instanceof Array);
});

test('GET /api/destinations?featured=true only returns featured ones', async () => {
  const res = await fetch(`${BASE}/api/destinations?featured=true`);
  const body = await res.json();
  assert.equal(body.destinations.length, 4);
  assert.ok(body.destinations.every((d) => d.featured === 1));
});

test('GET /api/destinations/:slug 404s for an unknown slug', async () => {
  const res = await fetch(`${BASE}/api/destinations/nowhere-at-all`);
  assert.equal(res.status, 404);
});

test('POST /api/contact rejects invalid input with field errors', async () => {
  const res = await fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: '', email: 'not-an-email', message: 'hi' })
  });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.fields.full_name);
  assert.ok(body.fields.email);
  assert.ok(body.fields.message);
});

test('POST /api/contact accepts valid input', async () => {
  const res = await fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'Jane Doe', email: 'jane@example.com', message: 'Please plan my dream trip to Kyoto.' })
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.ok, true);
});

test('admin routes reject unauthenticated requests', async () => {
  const res = await fetch(`${BASE}/api/admin/stats`);
  assert.equal(res.status, 401);
});

test('admin login rejects wrong credentials', async () => {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testadmin', password: 'wrongpassword' })
  });
  assert.equal(res.status, 401);
});

test('admin login succeeds and grants access to protected routes', async () => {
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testadmin', password: 'testpassword123' })
  });
  assert.equal(loginRes.status, 200);
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  const statsRes = await fetch(`${BASE}/api/admin/stats`, { headers: { Cookie: cookie } });
  assert.equal(statsRes.status, 200);
  const stats = await statsRes.json();
  assert.equal(stats.destinations, 8);
});

test('image upload: rejects unauthenticated requests', async () => {
  const res = await fetch(`${BASE}/api/admin/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'data:image/png;base64,aGVsbG8=' })
  });
  assert.equal(res.status, 401);
});

test('image upload: rejects disallowed mime types', async () => {
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testadmin', password: 'testpassword123' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  const res = await fetch(`${BASE}/api/admin/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ data: 'data:text/plain;base64,aGVsbG8=' })
  });
  assert.equal(res.status, 422);
});

test('image upload: stores and serves an image byte-for-byte', async () => {
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testadmin', password: 'testpassword123' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  // 1x1 red PNG
  const pngHex = '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415478da6360606060000000050001a5f645400000000049454e44ae426082';
  const pngBuffer = Buffer.from(pngHex, 'hex');
  const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

  const uploadRes = await fetch(`${BASE}/api/admin/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ data: dataUrl })
  });
  assert.equal(uploadRes.status, 201);
  const { url } = await uploadRes.json();

  const fetchRes = await fetch(`${BASE}${url}`);
  assert.equal(fetchRes.status, 200);
  assert.equal(fetchRes.headers.get('content-type'), 'image/png');
  const gotBuffer = Buffer.from(await fetchRes.arrayBuffer());
  assert.equal(gotBuffer.equals(pngBuffer), true);
});

test('full destination CRUD cycle via the admin API', async () => {
  const loginRes = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testadmin', password: 'testpassword123' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];
  const authHeaders = { 'Content-Type': 'application/json', Cookie: cookie };

  const createRes = await fetch(`${BASE}/api/admin/destinations`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Test City', country: 'Testland', price_from: 100, rating: 4.5, image: '/x.jpg', blurb: 'A test place.' })
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.equal(created.slug, 'test-city-testland');

  const updateRes = await fetch(`${BASE}/api/admin/destinations/${created.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ price_from: 200 })
  });
  assert.equal(updateRes.status, 200);

  const getRes = await fetch(`${BASE}/api/destinations/test-city-testland`);
  const gotten = await getRes.json();
  assert.equal(gotten.destination.price_from, 200);

  const deleteRes = await fetch(`${BASE}/api/admin/destinations/${created.id}`, { method: 'DELETE', headers: authHeaders });
  assert.equal(deleteRes.status, 200);

  const afterDeleteRes = await fetch(`${BASE}/api/destinations/test-city-testland`);
  assert.equal(afterDeleteRes.status, 404);
});
