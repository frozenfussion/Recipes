import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseCookInput, chatHistory } from '../src/lib/chef.js';
import { buildSystemPrompt } from '../src/ai/prompts.js';
import { addSession, fakeAi, sampleRecipe, startTestApp } from './helpers.js';

const KEY = 'sk-ant-api03-fakefakefake-1234';
let app;
let ai;
beforeEach(async () => { ai = fakeAi(); app = await startTestApp(ai); });
afterEach(() => app.close());

const withKey = () => app.req('PUT', '/api/settings', { anthropicApiKey: KEY });
const generateCalls = () => ai.calls.anthropic.filter((c) => c[0] === 'generateRecipe').map((c) => c[1]);
const cook = (body) => app.req('POST', '/api/sessions', body);

// Reads a Server-Sent Events response into [{ event, data }].
async function chat(id, content) {
  const res = await fetch(`${app.base}/api/sessions/${id}/messages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
  });
  if (!res.headers.get('content-type').startsWith('text/event-stream')) return { status: res.status, json: await res.json(), events: [] };
  const events = (await res.text()).split('\n\n').filter(Boolean).map((block) => {
    const event = block.match(/^event: (.*)$/m)[1];
    return { event, data: JSON.parse(block.match(/^data: (.*)$/m)[1]) };
  });
  return { status: res.status, events };
}

/* ---------- starting a session ---------- */

test('no key: a friendly message and nothing is created', async () => {
  const { status, body } = await cook({ ingredients: ['rice'] });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'no_key');
  assert.match(body.error.message, /Settings/);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
});

test('needs at least an ingredient or some words', async () => {
  await withKey();
  const { status, body } = await cook({ prefs: { diets: ['Halal'] } });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'nothing_to_cook');
  assert.equal(generateCalls().length, 0, 'no money spent on an empty request');
});

test('a recipe is generated, saved as a draft with the chat so far, and the prompt carries diets and allergies', async () => {
  await withKey();
  const { status, body } = await cook({
    prefs: { diets: ['Halal'], allergies: ['Nut-free'], cuisine: 'Indian', spice: 'Mild' },
    ingredients: ['chicken thighs', 'rice'], want: 'something quick',
  });
  assert.equal(status, 201);
  assert.equal(body.status, 'draft');
  assert.equal(body.recipe.title, 'Garlicky Chicken & Spinach Rice');
  assert.deepEqual(body.prefs.diets, ['Halal']);
  assert.deepEqual(body.messages.map((m) => m.role), ['user', 'assistant']);
  assert.equal(body.messages[1].content, 'Here you go!');
  assert.match(body.messages[0].content, /chicken thighs, rice/);

  const [call] = generateCalls();
  assert.equal(call.apiKey, KEY);
  assert.equal(call.model, 'fake-sonnet-9', 'the suggested model is used when none is saved');
  assert.match(call.system, /Diets: Halal/);
  assert.match(call.system, /Allergies and intolerances \(absolute\): Nut-free/);
  assert.match(call.system, /Halal: no pork/);
  assert.match(call.messages[0].content, /Ingredients I have: chicken thighs, rice\./);
  assert.match(call.messages[0].content, /What I fancy: something quick/);
});

test('the saved model is used, and a retired one fails with a friendly message before any recipe call', async () => {
  await withKey();
  await app.req('PUT', '/api/settings', { claudeModel: 'fake-opus-9' });
  await cook({ ingredients: ['egg'] });
  assert.equal(generateCalls()[0].model, 'fake-opus-9');
  await app.req('PUT', '/api/settings', { claudeModel: 'retired-model-1' });
  const { status, body } = await cook({ ingredients: ['egg'] });
  assert.equal(status, 400);
  assert.equal(body.error.code, 'model_gone');
  assert.equal(generateCalls().length, 1);
});

test('an invalid recipe is retried once, telling Claude what was wrong', async () => {
  await withKey();
  let n = 0;
  ai.anthropic.generateRecipe = async (args) => {
    ai.calls.anthropic.push(['generateRecipe', args]);
    return ++n === 1 ? { recipe: { title: 'Broken', steps: [] }, text: '' } : { recipe: sampleRecipe(), text: '' };
  };
  const { status, body } = await cook({ ingredients: ['egg'] });
  assert.equal(status, 201);
  assert.equal(n, 2);
  const [first, second] = generateCalls();
  assert.doesNotMatch(first.system, /could not be used/);
  assert.match(second.system, /previous answer could not be used/);
  assert.equal(body.messages[1].content, "Here's a recipe for you! Shout if you hit a snag. 👨‍🍳", 'a friendly default when Claude said nothing');
});

test('two bad answers in a row give a friendly error and create nothing', async () => {
  await withKey();
  ai.anthropic.generateRecipe = async () => ({ recipe: null, text: 'I would rather chat.' });
  const { status, body } = await cook({ ingredients: ['egg'] });
  assert.equal(status, 502);
  assert.equal(body.error.code, 'bad_ai_recipe');
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
});

test('Claude errors become friendly messages', async () => {
  await withKey();
  for (const [status, code] of [[401, 'bad_key'], [429, 'rate_limited'], [529, 'busy'], [404, 'model_not_found']]) {
    ai.anthropic.generateRecipe = async () => { throw Object.assign(new Error('sdk detail with ' + KEY), { status }); };
    const res = await cook({ ingredients: ['egg'] });
    assert.equal(res.body.error.code, code);
    assert.ok(!res.text.includes('fakefake'), 'the key must never appear in an error');
    assert.ok(!res.text.includes('sdk detail'));
  }
  ai.anthropic.generateRecipe = async () => { throw Object.assign(new Error('offline'), { status: undefined }); };
  assert.equal((await cook({ ingredients: ['egg'] })).body.error.code, 'network');
});

test('untrusted input is checked: types, sizes and counts', async () => {
  await withKey();
  for (const body of [
    { ingredients: 'rice' }, { ingredients: [1] }, { ingredients: Array(61).fill('x') },
    { ingredients: ['x'.repeat(81)] }, { want: 'x'.repeat(2001) }, { want: 42 }, { prefs: 'Halal' }, { prefs: { diets: 'Halal' } },
  ]) {
    const res = await cook({ ingredients: ['rice'], ...body });
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
  }
  assert.equal(generateCalls().length, 0);
  const parsed = parseCookInput({ ingredients: ['  rice\u0000 ', ''], want: ' hi ' });
  assert.deepEqual(parsed.ingredients, ['rice']);
  assert.equal(parsed.want, 'hi');
});

test('the system prompt holds the safety rules and the user settings', () => {
  const system = buildSystemPrompt({ prefs: { diets: ['Vegan'], allergies: ['Sesame-free'] }, forRecipe: true, recipe: sampleRecipe() });
  for (const needle of ['Halal: no pork', 'Kosher:', 'Allergies are absolute', 'metric', 'Diets: Vegan', 'Sesame-free', 'submit_recipe', 'Garlicky Chicken']) {
    assert.ok(system.includes(needle), needle);
  }
});

/* ---------- chat ---------- */

test('chat streams the reply, saves both messages, and sends the recipe and history as context', async () => {
  await withKey();
  const id = addSession(app.db, { prefs: { diets: ['Halal'] } });
  const { status, events } = await chat(id, 'Can I use Greek yoghurt?');
  assert.equal(status, 200);
  assert.deepEqual(events.map((e) => e.event), ['delta', 'delta', 'done']);
  assert.equal(events[0].data.text, 'Hello ');
  assert.equal(events[2].data.message.content, 'Hello there!');

  const session = (await app.req('GET', `/api/sessions/${id}`)).body;
  assert.deepEqual(session.messages.map((m) => [m.role, m.content]), [
    ['assistant', 'Here is a recipe!'], ['user', 'Can I use Greek yoghurt?'], ['assistant', 'Hello there!'],
  ]);
  const sent = ai.calls.anthropic.find((c) => c[0] === 'streamChat')[1];
  assert.match(sent.system, /Garlicky Chicken/);
  assert.match(sent.system, /Diets: Halal/);
  assert.deepEqual(sent.messages, [{ role: 'user', content: 'Can I use Greek yoghurt?' }], 'history starts with a user turn');
});

test('chat without a key is a normal JSON error, before any stream starts', async () => {
  const id = addSession(app.db);
  const { status, json } = await chat(id, 'hello');
  assert.equal(status, 400);
  assert.equal(json.error.code, 'no_key');
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE session_id = ?').get(id).n, 1, 'nothing saved');
});

test('a failure mid-stream arrives as an error event; the user message stays, no assistant message is saved', async () => {
  await withKey();
  ai.anthropic.streamChat = async ({ onText }) => { onText('Hel'); throw Object.assign(new Error('boom'), { status: 529 }); };
  const id = addSession(app.db);
  const { events } = await chat(id, 'hello');
  assert.deepEqual(events.map((e) => e.event), ['delta', 'error']);
  assert.equal(events[1].data.code, 'busy');
  const roles = (await app.req('GET', `/api/sessions/${id}`)).body.messages.map((m) => m.role);
  assert.deepEqual(roles, ['assistant', 'user']);
});

test('chat input is checked, and unknown sessions are 404', async () => {
  await withKey();
  const id = addSession(app.db);
  assert.equal((await chat(id, '   ')).json.error.code, 'empty_message');
  assert.equal((await chat(id, 'x'.repeat(2001))).json.error.code, 'too_long');
  assert.equal((await chat(9999, 'hi')).status, 404);
});

test('only the last 30 messages go to Claude, and notes are never sent', () => {
  const messages = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  messages.splice(10, 0, { role: 'note', content: 'Duplicated from X' });
  const turns = chatHistory(messages);
  assert.ok(turns.length <= 30);
  assert.equal(turns[0].role, 'user');
  assert.ok(!turns.some((t) => t.content.startsWith('Duplicated')));
  assert.equal(turns.at(-1).content, 'm49');
});

/* ---------- refine ---------- */

test('refine changes the recipe in place and adds the request and a reply to the chat', async () => {
  await withKey();
  const id = addSession(app.db, { status: 'saved' });
  const { status, body } = await app.req('POST', `/api/sessions/${id}/refine`, { chips: ['Spicier', 'Quicker'], text: 'swap chicken for chickpeas' });
  assert.equal(status, 200);
  assert.equal(body.title, 'Garlicky Chicken & Spinach Rice (refined)');
  assert.equal(body.recipe.steps.at(-1), 'Refined: Spicier; Quicker; swap chicken for chickpeas');
  assert.equal(body.status, 'saved', 'status is not changed by a refine');
  const tail = body.messages.slice(-2);
  assert.deepEqual(tail.map((m) => [m.role, m.content]), [
    ['user', 'Refine: Spicier, Quicker, swap chicken for chickpeas'], ['assistant', 'I made it a bit different.'],
  ]);
  assert.match(generateCalls()[0].messages[0].content, /400 g chicken thighs/, 'the current recipe is sent');
});

test('refine needs something to do; a bad AI answer changes nothing', async () => {
  await withKey();
  const id = addSession(app.db);
  assert.equal((await app.req('POST', `/api/sessions/${id}/refine`, {})).body.error.code, 'nothing_to_refine');
  ai.anthropic.generateRecipe = async () => ({ recipe: { title: 'x' }, text: '' });
  const res = await app.req('POST', `/api/sessions/${id}/refine`, { chips: ['Lighter'] });
  assert.equal(res.status, 502);
  const session = (await app.req('GET', `/api/sessions/${id}`)).body;
  assert.equal(session.title, 'Garlicky Chicken & Spinach Rice');
  assert.equal(session.messages.length, 1);
});

test('refine keeps what Claude saw in the fridge photos', async () => {
  await withKey();
  const id = addSession(app.db, { recipe: sampleRecipe({ detected_ingredients: ['eggs', 'milk'] }) });
  const { body } = await app.req('POST', `/api/sessions/${id}/refine`, { chips: ['Lighter'] });
  assert.deepEqual(body.recipe.detected_ingredients, ['eggs', 'milk']);
});
