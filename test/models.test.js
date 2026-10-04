import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { suggestClaudeModel, suggestImageModel, resolveModel, loadModels } from '../src/lib/models.js';
import { setSetting, getSetting } from '../src/lib/settings.js';
import { fakeAi, startTestApp } from './helpers.js';

let app;
let ai;
beforeEach(async () => {
  ai = fakeAi();
  app = await startTestApp(ai);
  await app.req('PUT', '/api/settings', { anthropicApiKey: 'sk-ant-api03-fakefakefake-1234', openaiApiKey: 'sk-proj-fakefakefake-5678' });
});
afterEach(() => app.close());

test('Claude list keeps only models that can read photos, newest first', async () => {
  const { status, body } = await app.req('GET', '/api/models/claude');
  assert.equal(status, 200);
  assert.deepEqual(body.models.map((m) => m.id), ['fake-opus-9', 'fake-sonnet-9', 'fake-sonnet-8']);
  assert.equal(body.models[0].label, 'Fake Opus 9');
});

test('OpenAI list keeps only gpt-image models and passes the shutdown date on', async () => {
  const { body } = await app.req('GET', '/api/models/openai');
  assert.deepEqual(body.models.map((m) => m.id), ['gpt-image-fake-sunburst', 'gpt-image-fake-flare']);
  assert.equal(body.models[1].shutdownDate, '2027-01-01');
  assert.equal(body.suggested, 'gpt-image-fake-flare');
});

test('the list is cached for 24 hours and Refresh skips the cache', async () => {
  await app.req('GET', '/api/models/claude');
  await app.req('GET', '/api/models/claude');
  assert.equal(ai.calls.anthropic.filter((c) => c[0] === 'listModels').length, 1);
  await app.req('GET', '/api/models/claude?refresh=1');
  assert.equal(ai.calls.anthropic.filter((c) => c[0] === 'listModels').length, 2);
});

test('a cache older than a day is fetched again', async () => {
  await loadModels(app.db, ai, 'claude', { now: Date.parse('2026-01-01T00:00:00Z') });
  await loadModels(app.db, ai, 'claude', { now: Date.parse('2026-01-01T23:00:00Z') });
  assert.equal(ai.calls.anthropic.length, 1);
  await loadModels(app.db, ai, 'claude', { now: Date.parse('2026-01-02T01:00:00Z') });
  assert.equal(ai.calls.anthropic.length, 2);
});

test('if the network fails, a stale list is still shown; a Refresh shows the error', async () => {
  await loadModels(app.db, ai, 'claude', { now: Date.parse('2026-01-01T00:00:00Z') });
  ai.anthropic.listModels = async () => { throw Object.assign(new Error('down'), { status: undefined }); };
  const stale = await loadModels(app.db, ai, 'claude', { now: Date.parse('2026-03-01T00:00:00Z') });
  assert.equal(stale.models.length, 3);
  await assert.rejects(loadModels(app.db, ai, 'claude', { refresh: true }), (e) => e.code === 'network');
});

test('no saved model: the suggestion skips the priciest tier', async () => {
  const { body } = await app.req('GET', '/api/models/claude');
  assert.equal(body.suggested, 'fake-sonnet-9');
  assert.equal(body.saved, null);
  assert.equal(suggestClaudeModel([{ id: 'x-opus-1' }, { id: 'y-haiku-1' }]), 'y-haiku-1');
  assert.equal(suggestClaudeModel([{ id: 'x-opus-1' }]), 'x-opus-1');
  assert.equal(suggestClaudeModel([]), null);
  assert.equal(suggestImageModel([]), null);
});

test('a saved model that is not in the live list is flagged', async () => {
  await app.req('PUT', '/api/settings', { claudeModel: 'retired-model-1' });
  const { body } = await app.req('GET', '/api/models/claude');
  assert.equal(body.savedMissing, true);
  assert.equal(body.saved, 'retired-model-1');
});

test('resolveModel: saved model wins, a retired one fails with a friendly message, none saved falls back to the suggestion', async () => {
  assert.equal(await resolveModel(app.db, ai, 'claude'), 'fake-sonnet-9');
  setSetting(app.db, 'claude_model', 'fake-opus-9');
  assert.equal(await resolveModel(app.db, ai, 'claude'), 'fake-opus-9');
  setSetting(app.db, 'claude_model', 'retired-model-1');
  await assert.rejects(resolveModel(app.db, ai, 'claude'), (e) => e.code === 'model_gone' && /Settings/.test(e.message));
  assert.equal(getSetting(app.db, 'claude_model'), 'retired-model-1');
});

test('a wrong key on refresh gives the friendly message', async () => {
  ai.anthropic.listModels = async () => { throw Object.assign(new Error('nope'), { status: 401 }); };
  const { status, body } = await app.req('GET', '/api/models/claude?refresh=1');
  assert.equal(status, 401);
  assert.equal(body.error.code, 'bad_key');
});
