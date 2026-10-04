import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setSetting } from '../src/lib/settings.js';
import { addSession, fakeAi, startTestApp } from './helpers.js';

// KEY_SOURCE=server: the keys come from the environment (filled by systemd from a protected file),
// the database is never asked for or given a key, and the Settings page can only look.
const CLAUDE_KEY = 'sk-ant-api03-SERVERSECRETSERVER-c3d4';
const OPENAI_KEY = 'sk-proj-SERVEROTHERSECRET-e5f6';
const DB_KEY = 'sk-ant-api03-OLDDATABASEKEY-0000';

let app;
let ai;
async function start(serverKeys) {
  ai = fakeAi();
  app = await startTestApp(ai, { serverKeys });
}
afterEach(() => app.close());

test('Settings says the keys are on the server and shows only a masked form', async () => {
  await start({ anthropic_api_key: CLAUDE_KEY, openai_api_key: null });
  const { body, text } = await app.req('GET', '/api/settings');
  assert.equal(body.keysOnServer, true);
  assert.deepEqual(
    { hasKey: body.claude.hasKey, maskedKey: body.claude.maskedKey },
    { hasKey: true, maskedKey: 'sk-ant-…c3d4' },
  );
  assert.equal(body.openai.hasKey, false);
  assert.ok(!text.includes('SERVERSECRET'), 'full key leaked');
});

test('the server keys are what the AI calls use, and a key left in the database is ignored', async () => {
  await start({ anthropic_api_key: CLAUDE_KEY, openai_api_key: OPENAI_KEY });
  setSetting(app.db, 'anthropic_api_key', DB_KEY);
  assert.equal((await app.req('POST', '/api/sessions', { ingredients: ['egg'] })).status, 201);
  const generate = ai.calls.anthropic.find((c) => c[0] === 'generateRecipe');
  assert.equal(generate[1].apiKey, CLAUDE_KEY);
  const id = addSession(app.db);
  assert.equal((await app.req('POST', `/api/sessions/${id}/ai-photo`)).status, 200);
  assert.equal(ai.calls.openai.find((c) => c[0] === 'generateImage')[1].apiKey, OPENAI_KEY);
  assert.ok(ai.calls.anthropic.every((c) => c[1] !== DB_KEY), 'the database key was never used');
});

test('saving or removing a key on the Settings page is refused and nothing reaches the database', async () => {
  await start({ anthropic_api_key: CLAUDE_KEY, openai_api_key: null });
  const put = await app.req('PUT', '/api/settings', { openaiApiKey: OPENAI_KEY, theme: 'dark' });
  assert.equal(put.status, 400);
  assert.equal(put.body.error.code, 'keys_on_server');
  const row = app.db.prepare("SELECT COUNT(*) AS n FROM settings WHERE key LIKE '%api_key'").get();
  assert.equal(row.n, 0);
  assert.equal((await app.req('GET', '/api/settings')).body.theme, 'device', 'nothing half-saved');
  const del = await app.req('DELETE', '/api/settings/key/anthropic');
  assert.equal(del.body.error.code, 'keys_on_server');
  assert.equal((await app.req('GET', '/api/settings')).body.claude.hasKey, true);
});

test('other settings can still be changed', async () => {
  await start({ anthropic_api_key: CLAUDE_KEY, openai_api_key: null });
  const { status, body } = await app.req('PUT', '/api/settings', { theme: 'dark', claudeModel: 'fake-sonnet-9', anthropicApiKey: '' });
  assert.equal(status, 200);
  assert.equal(body.theme, 'dark');
  assert.equal(body.claude.model, 'fake-sonnet-9');
});

test('Test checks the server key, and refuses a typed one', async () => {
  await start({ anthropic_api_key: CLAUDE_KEY, openai_api_key: null });
  assert.equal((await app.req('POST', '/api/settings/test/anthropic', {})).status, 200);
  assert.deepEqual(ai.calls.anthropic, [['checkKey', CLAUDE_KEY]]);
  const typed = await app.req('POST', '/api/settings/test/anthropic', { apiKey: OPENAI_KEY });
  assert.equal(typed.body.error.code, 'keys_on_server');
});

test('a missing server key says where it has to be added', async () => {
  await start({ anthropic_api_key: null, openai_api_key: null });
  for (const route of ['/api/models/claude', '/api/models/openai']) {
    const { status, body } = await app.req('GET', route);
    assert.equal(status, 400);
    assert.equal(body.error.code, 'no_key');
    assert.match(body.error.message, /on the server/);
  }
  const cook = await app.req('POST', '/api/sessions', { ingredients: ['egg'] });
  assert.match(cook.body.error.message, /on the server/);
});
