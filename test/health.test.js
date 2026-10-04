import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';

let server;
let base;

before(async () => {
  server = createApp(openDb(':memory:')).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('GET /api/health says ok', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, schemaVersion: 1 });
});

test('unknown API paths return the standard error shape', async () => {
  const res = await fetch(`${base}/api/nope`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, 'not_found');
  assert.ok(body.error.message);
});

test('the placeholder page is served', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Chef Buddy/);
});
