import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MIGRATIONS } from '../src/db.js';
import { startTestApp } from './helpers.js';

let app;
before(async () => { app = await startTestApp(); });
after(() => app.close());

test('GET /api/health says ok', async () => {
  const { status, body } = await app.req('GET', '/api/health');
  assert.equal(status, 200);
  assert.deepEqual(body, { ok: true, schemaVersion: MIGRATIONS.length });
});

test('unknown API paths return the standard error shape', async () => {
  const { status, body } = await app.req('GET', '/api/nope');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'not_found');
  assert.ok(body.error.message);
});

test('broken JSON gets a friendly 400, not a stack trace', async () => {
  const res = await fetch(`${app.base}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{nope' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'bad_json');
});

test('the app page is served', async () => {
  const res = await fetch(`${app.base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Chef Buddy/);
});
