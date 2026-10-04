import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAnthropicService } from '../src/ai/anthropic.js';
import { createOpenAiService } from '../src/ai/openai.js';
import { friendlyAiError } from '../src/lib/errors.js';
import { fakeAi, startTestApp } from './helpers.js';

// A pretend vendor that accepts the connection and then never answers, like a stalled network path.
let silent;
let baseURL;
const sockets = new Set();
before(async () => {
  silent = http.createServer(() => { /* never respond */ });
  silent.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((resolve) => silent.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${silent.address().port}`;
});
after(() => { for (const s of sockets) s.destroy(); silent.close(); });

async function timeIt(work) {
  const started = Date.now();
  const err = await work().then(() => null, (e) => e);
  return { err, ms: Date.now() - started };
}

test('a stalled Claude connection gives up at the timeout instead of waiting 10 minutes', async () => {
  const claude = createAnthropicService({ baseURL, listTimeoutMs: 400 });
  for (const call of [() => claude.listModels('sk-ant-api03-whatever'), () => claude.checkKey('sk-ant-api03-whatever')]) {
    const { err, ms } = await timeIt(call);
    assert.ok(err, 'must fail');
    assert.ok(ms >= 300 && ms < 3000, `failed after ${ms} ms (expected about 400, and no retry)`);
    assert.equal(friendlyAiError(err, 'Claude').code, 'timeout');
  }
});

test('a stalled OpenAI connection gives up at the timeout too', async () => {
  const openai = createOpenAiService({ baseURL, listTimeoutMs: 400 });
  for (const call of [() => openai.listModels('sk-proj-whatever'), () => openai.checkKey('sk-proj-whatever')]) {
    const { err, ms } = await timeIt(call);
    assert.ok(err);
    assert.ok(ms >= 300 && ms < 3000, `failed after ${ms} ms`);
    assert.equal(friendlyAiError(err, 'OpenAI').code, 'timeout');
  }
});

test('the default timeout for lists and key tests is 15 seconds', async () => {
  const { LIST_TIMEOUT_MS } = await import('../src/ai/timeouts.js');
  assert.equal(LIST_TIMEOUT_MS, 15_000);
});

test('the timeout message is plain and mentions the usual causes, and no key or SDK text leaks', () => {
  class APIConnectionTimeoutError extends Error {} // like the SDK: the class has the name, err.name stays "Error"
  const mapped = friendlyAiError(new APIConnectionTimeoutError('Request timed out. sk-ant-api03-SECRET'), 'Claude');
  assert.equal(mapped.status, 504);
  assert.match(mapped.message, /Claude did not answer in time/);
  assert.match(mapped.message, /VPN, proxy or firewall/);
  assert.ok(!mapped.message.includes('SECRET'));
});

test('connection problems are told apart: DNS, timeout and everything else', () => {
  const dnsErr = Object.assign(new Error('x'), { cause: { code: 'ENOTFOUND' } });
  assert.match(friendlyAiError(dnsErr, 'OpenAI').message, /look up OpenAI's address/);
  const connTimeout = Object.assign(new Error('x'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
  assert.equal(friendlyAiError(connTimeout, 'OpenAI').code, 'timeout');
  const reset = Object.assign(new Error('x'), { cause: { code: 'ECONNRESET' } });
  assert.equal(friendlyAiError(reset, 'OpenAI').code, 'network');
});

test('Refresh answers with a clear timeout message (not an endless wait) when the vendor stalls', async () => {
  class APIConnectionTimeoutError extends Error {}
  const ai = fakeAi({
    anthropic: { ...fakeAi().anthropic, listModels: async () => { throw new APIConnectionTimeoutError('Request timed out.'); } },
  });
  const app = await startTestApp(ai);
  try {
    await app.req('PUT', '/api/settings', { anthropicApiKey: 'sk-ant-api03-fakefakefake-1234' });
    const { status, body } = await app.req('GET', '/api/models/claude?refresh=1');
    assert.equal(status, 504);
    assert.equal(body.error.code, 'timeout');
  } finally {
    await app.close();
  }
});

test('failures are logged as one safe line (name, status, code) and never include the message', async () => {
  const lines = [];
  const original = console.warn;
  console.warn = (...args) => lines.push(args.join(' '));
  const ai = fakeAi({
    openai: { ...fakeAi().openai, listModels: async () => { class APIConnectionError extends Error {} throw Object.assign(new APIConnectionError('boom sk-proj-LEAKYSECRET'), { cause: { code: 'ETIMEDOUT' } }); } },
  });
  const app = await startTestApp(ai);
  try {
    await app.req('PUT', '/api/settings', { openaiApiKey: 'sk-proj-fakefakefake-5678' });
    await app.req('GET', '/api/models/openai?refresh=1');
  } finally {
    console.warn = original;
    await app.close();
  }
  assert.deepEqual(lines, ['OpenAI: model list failed (APIConnectionError, ETIMEDOUT)']);
});
