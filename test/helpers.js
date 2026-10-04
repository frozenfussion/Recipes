import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.js';
import { createSession } from '../src/lib/sessions.js';
import { createApp } from '../src/server.js';

// A running app on a random port with an in-memory database, a temporary images folder
// and fake AI services. Call close() when done. req(method, path, body) returns { status, body, text }.
export async function startTestApp(ai = {}) {
  const db = openDb(':memory:');
  const imagesDir = mkdtempSync(path.join(tmpdir(), 'chefbuddy-images-'));
  const server = createApp(db, { ai, imagesDir }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function req(method, route, body) {
    const res = await fetch(base + route, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, body: parsed, text };
  }

  return {
    db, base, req, imagesDir,
    close: () => new Promise((resolve) => {
      server.close(() => { rmSync(imagesDir, { recursive: true, force: true }); resolve(); });
      server.closeAllConnections();
    }),
  };
}

export const sampleRecipe = (overrides = {}) => ({
  title: 'Garlicky Chicken & Spinach Rice',
  emoji: '🍗',
  time_minutes: 35,
  servings: 2,
  tags: ['Halal', 'Nut-free'],
  ingredients: ['400 g chicken thighs', '1 cup basmati rice', '150 g spinach'],
  steps: ['Marinate the chicken.', 'Sear it.', 'Add rice and simmer.'],
  shopping_list: [],
  notes: '',
  ...overrides,
});

// Quick way to put a session in the database for a test.
export function addSession(db, { recipe = sampleRecipe(), ...rest } = {}) {
  return createSession(db, { recipe, messages: [{ role: 'assistant', content: 'Here is a recipe!' }], ...rest });
}

// Fake Claude and OpenAI services. Override any method per test. Model ids here are made up.
export function fakeAi(overrides = {}) {
  const calls = { anthropic: [], openai: [] };
  const ai = {
    calls,
    anthropic: {
      async listModels(key) {
        calls.anthropic.push(['listModels', key]);
        return [
          { id: 'fake-opus-9', display_name: 'Fake Opus 9', created_at: '2026-03-01T00:00:00Z', vision: true },
          { id: 'fake-sonnet-9', display_name: 'Fake Sonnet 9', created_at: '2026-02-01T00:00:00Z', vision: true },
          { id: 'fake-sonnet-8', display_name: 'Fake Sonnet 8', created_at: '2025-12-01T00:00:00Z', vision: true },
          { id: 'fake-textonly-1', display_name: 'Fake Text Only', created_at: '2026-04-01T00:00:00Z', vision: false },
        ];
      },
      async checkKey(key) { calls.anthropic.push(['checkKey', key]); },
    },
    openai: {
      async listModels(key) {
        calls.openai.push(['listModels', key]);
        return [
          { id: 'gpt-image-fake-sunburst', created: 200, shutdown_date: null },
          { id: 'gpt-image-fake-flare', created: 100, shutdown_date: '2027-01-01' },
          { id: 'gpt-chat-fake', created: 300, shutdown_date: null },
        ];
      },
      async checkKey(key) { calls.openai.push(['checkKey', key]); },
    },
  };
  return Object.assign(ai, overrides);
}
