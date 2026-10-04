import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { maskKey } from '../src/lib/mask.js';
import { friendlyAiError } from '../src/lib/errors.js';
import { fakeAi, startTestApp } from './helpers.js';

const CLAUDE_KEY = 'sk-ant-api03-SECRETSECRETSECRET-a1b2';
const OPENAI_KEY = 'sk-proj-OTHERSECRETOTHERSECRET-z9y8';

let app;
let ai;
beforeEach(async () => { ai = fakeAi(); app = await startTestApp(ai); });
afterEach(() => app.close());

test('maskKey shows only the first 7 and last 4 characters', () => {
  assert.equal(maskKey(CLAUDE_KEY), 'sk-ant-…a1b2');
  assert.equal(maskKey(''), '');
  assert.equal(maskKey('short'), '••••');
});

test('fresh settings: no keys, defaults', async () => {
  const { body } = await app.req('GET', '/api/settings');
  assert.deepEqual(body, {
    claude: { hasKey: false, maskedKey: '', model: null },
    openai: { hasKey: false, maskedKey: '', model: null, quality: 'low' },
    theme: 'device',
  });
});

test('a saved key comes back masked and the full key is in no response', async () => {
  await app.req('PUT', '/api/settings', { anthropicApiKey: CLAUDE_KEY, openaiApiKey: OPENAI_KEY });
  const get = await app.req('GET', '/api/settings');
  assert.equal(get.body.claude.hasKey, true);
  assert.equal(get.body.claude.maskedKey, 'sk-ant-…a1b2');
  assert.equal(get.body.openai.maskedKey, 'sk-proj…z9y8');
  const put = await app.req('PUT', '/api/settings', { theme: 'dark' });
  // Scan every response we have seen for any trace of the secret middle part.
  for (const text of [get.text, put.text]) {
    assert.ok(!text.includes('SECRETSECRET'), 'full key leaked');
    assert.ok(!text.includes('OTHERSECRET'), 'full key leaked');
  }
});

test('an empty key field means "leave unchanged", never "erase"', async () => {
  await app.req('PUT', '/api/settings', { anthropicApiKey: CLAUDE_KEY });
  await app.req('PUT', '/api/settings', { anthropicApiKey: '', claudeModel: 'fake-sonnet-9' });
  const { body } = await app.req('GET', '/api/settings');
  assert.equal(body.claude.hasKey, true);
  assert.equal(body.claude.model, 'fake-sonnet-9');
});

test('Remove key deletes the key and its cached model list', async () => {
  await app.req('PUT', '/api/settings', { anthropicApiKey: CLAUDE_KEY });
  await app.req('GET', '/api/models/claude');
  const { body } = await app.req('DELETE', '/api/settings/key/anthropic');
  assert.equal(body.claude.hasKey, false);
  const models = await app.req('GET', '/api/models/claude');
  assert.equal(models.status, 400);
  assert.equal(models.body.error.code, 'no_key');
});

test('bad input is rejected with a plain message and nothing is half-saved', async () => {
  const badKey = await app.req('PUT', '/api/settings', { anthropicApiKey: 'has spaces in it nope' });
  assert.equal(badKey.status, 400);
  const mixed = await app.req('PUT', '/api/settings', { anthropicApiKey: CLAUDE_KEY, theme: 'neon' });
  assert.equal(mixed.status, 400);
  assert.equal((await app.req('GET', '/api/settings')).body.claude.hasKey, false);
  assert.equal((await app.req('PUT', '/api/settings', { imageQuality: 'ultra' })).status, 400);
  assert.equal((await app.req('PUT', '/api/settings', { claudeModel: 'x; DROP TABLE' })).status, 400);
});

test('theme and quality are saved', async () => {
  const { body } = await app.req('PUT', '/api/settings', { theme: 'dark', imageQuality: 'high' });
  assert.equal(body.theme, 'dark');
  assert.equal(body.openai.quality, 'high');
});

test('Test uses the typed key without saving it', async () => {
  const { status, body } = await app.req('POST', '/api/settings/test/anthropic', { apiKey: CLAUDE_KEY });
  assert.equal(status, 200);
  assert.deepEqual(body, { ok: true });
  assert.deepEqual(ai.calls.anthropic, [['checkKey', CLAUDE_KEY]]);
  assert.equal((await app.req('GET', '/api/settings')).body.claude.hasKey, false);
});

test('Test with no key anywhere says so', async () => {
  const { status, body } = await app.req('POST', '/api/settings/test/openai', {});
  assert.equal(status, 400);
  assert.equal(body.error.code, 'no_key');
});

test('a wrong key shows a friendly message that never contains the key or the SDK text', async () => {
  const bad = fakeAi({ anthropic: { async checkKey() { const e = new Error(`401 invalid x-api-key ${CLAUDE_KEY}`); e.status = 401; throw e; }, async listModels() { return []; } } });
  await app.close();
  app = await startTestApp(bad);
  const { status, body, text } = await app.req('POST', '/api/settings/test/anthropic', { apiKey: CLAUDE_KEY });
  assert.equal(status, 401);
  assert.equal(body.error.code, 'bad_key');
  assert.match(body.error.message, /did not accept the API key/);
  assert.ok(!text.includes('SECRETSECRET'));
});

test('friendlyAiError maps the common failures', () => {
  const cases = [[401, 'bad_key'], [404, 'model_not_found'], [413, 'too_large'], [429, 'rate_limited'], [529, 'busy'], [500, 'busy'], [400, 'bad_request'], [undefined, 'network'], [418, 'ai_error']];
  for (const [status, code] of cases) {
    const err = new Error('raw sdk text'); err.status = status;
    const mapped = friendlyAiError(err, 'Claude');
    assert.equal(mapped.code, code, `status ${status}`);
    assert.ok(!mapped.message.includes('raw sdk text'));
  }
  const moderation = Object.assign(new Error('x'), { status: 400, code: 'moderation_blocked' });
  assert.equal(friendlyAiError(moderation, 'OpenAI').code, 'image_declined');
});
