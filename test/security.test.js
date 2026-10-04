import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRateLimiter } from '../src/lib/rate-limit.js';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';
import { addSession, fakeAi, startTestApp } from './helpers.js';

let app;
let ai;
beforeEach(async () => { ai = fakeAi(); app = await startTestApp(ai); });
afterEach(() => app.close());

// fetch() will not let us set Host or Origin freely, so use the raw http client.
function raw(path, { method = 'GET', headers = {}, body } = {}) {
  const { port } = new URL(app.base);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      let text = '';
      res.on('data', (d) => { text += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('every response carries a strict Content-Security-Policy and the other security headers', async () => {
  const res = await fetch(app.base + '/');
  const csp = res.headers.get('content-security-policy');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'(;|$)/, 'no inline scripts, no eval');
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.ok((await fetch(app.base + '/api/health')).headers.get('content-security-policy'));
});

test('a request addressed to another host name is refused (DNS rebinding)', async () => {
  const bad = await raw('/api/settings', { headers: { Host: 'evil.example.com' } });
  assert.equal(bad.status, 403);
  assert.equal(JSON.parse(bad.text).error.code, 'bad_host');
  for (const host of ['localhost:3000', '127.0.0.1:3000', '[::1]:3000']) {
    assert.equal((await raw('/api/health', { headers: { Host: host } })).status, 200, host);
  }
});

test('when the user chose to share on the network, the host check is off', async () => {
  const db = openDb(':memory:');
  const server = createApp(db, { ai: fakeAi(), loopbackOnly: false, imagesDir: app.imagesDir }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/api/health`, { headers: {} });
  assert.equal(res.status, 200);
  await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
});

test('a change coming from a different website is refused (CSRF), our own page is fine', async () => {
  const { port } = new URL(app.base);
  const body = JSON.stringify({ theme: 'dark' });
  const headers = (origin) => ({ 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...(origin ? { Origin: origin } : {}) });
  const cross = await raw('/api/settings', { method: 'PUT', headers: headers('https://evil.example.com'), body });
  assert.equal(cross.status, 403);
  assert.equal(JSON.parse(cross.text).error.code, 'bad_origin');
  assert.equal((await app.req('GET', '/api/settings')).body.theme, 'device', 'nothing was changed');
  const own = await raw('/api/settings', { method: 'PUT', headers: headers(`http://127.0.0.1:${port}`), body });
  assert.equal(own.status, 200);
  const none = await raw('/api/settings', { method: 'PUT', headers: headers(null), body });
  assert.equal(none.status, 200);
  const junk = await raw('/api/settings', { method: 'PUT', headers: headers('not a url'), body });
  assert.equal(junk.status, 403);
});

test('the rate limiter lets N requests through per window, then says how long to wait, then recovers', () => {
  let t = 1_000_000;
  const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => t });
  const results = [];
  const res = { set() {} };
  const run = () => limiter({}, res, (err) => results.push(err ? err.code : 'ok'));
  run(); run(); run();
  assert.deepEqual(results, ['ok', 'ok', 'ok']);
  t += 10_000;
  run();
  assert.equal(results[3], 'slow_down');
  t += 50_000; // the first request is now a minute old
  run();
  assert.equal(results[4], 'ok');
});

test('the AI routes are rate limited with a friendly 429 and Retry-After, and a blocked request spends nothing', async () => {
  const db = openDb(':memory:');
  const limited = createApp(db, {
    ai, imagesDir: app.imagesDir,
    limiters: { ai: createRateLimiter({ limit: 2 }), image: createRateLimiter({ limit: 1 }) },
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => limited.once('listening', resolve));
  const base = `http://127.0.0.1:${limited.address().port}`;
  const call = (method, path, body) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  await call('PUT', '/api/settings', { anthropicApiKey: 'sk-ant-api03-fakefakefake-1234', openaiApiKey: 'sk-proj-fakefakefake-5678' });
  const id = addSession(db);

  assert.equal((await call('POST', '/api/sessions', { ingredients: ['egg'] })).status, 201);
  assert.equal((await call('POST', `/api/sessions/${id}/refine`, { chips: ['Lighter'] })).status, 200);
  const blocked = await call('POST', '/api/sessions', { ingredients: ['egg'] });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  const body = await blocked.json();
  assert.equal(body.error.code, 'slow_down');
  assert.match(body.error.message, /Try again in \d+ seconds/);
  assert.equal(ai.calls.anthropic.filter((c) => c[0] === 'generateRecipe').length, 2, 'the blocked request never reached Claude');
  assert.equal((await call('GET', '/api/sessions')).status, 200, 'reading is never limited');
  await new Promise((resolve) => { limited.close(resolve); limited.closeAllConnections(); });
});

test('behind a proxy, the public name in ALLOWED_HOSTS is accepted and other names are still refused', async () => {
  const db = openDb(':memory:');
  const server = createApp(db, { ai: fakeAi(), imagesDir: app.imagesDir, allowedHosts: ['recipes.example.com'] }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const call = (host, { method = 'GET', origin, body } = {}) => new Promise((resolve, reject) => {
    const headers = { Host: host, ...(origin ? { Origin: origin } : {}), ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}) };
    const req = http.request({ host: '127.0.0.1', port, path: '/api/settings', method, headers }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
  try {
    assert.equal(await call('recipes.example.com'), 200);
    assert.equal(await call('RECIPES.example.com'), 200, 'host names are not case sensitive');
    assert.equal(await call('localhost:3000'), 200, 'localhost still works');
    assert.equal(await call('evil.example.com'), 403);
    const body = JSON.stringify({ theme: 'dark' });
    assert.equal(await call('recipes.example.com', { method: 'PUT', origin: 'https://recipes.example.com', body }), 200, 'our own page through Caddy');
    assert.equal(await call('recipes.example.com', { method: 'PUT', origin: 'https://evil.example.com', body }), 403, 'CSRF check still on');
  } finally {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
});
