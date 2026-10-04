import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { buildImagePrompt } from '../src/ai/prompts.js';
import { saveImage } from '../src/lib/images.js';
import { addSession, fakeAi, sampleRecipe, startTestApp } from './helpers.js';

const OPENAI_KEY = 'sk-proj-fakefakefake-5678';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 7)]);

let app;
let ai;
beforeEach(async () => { ai = fakeAi(); app = await startTestApp(ai); });
afterEach(() => app.close());

const withKeys = () => app.req('PUT', '/api/settings', { anthropicApiKey: 'sk-ant-api03-fakefakefake-1234', openaiApiKey: OPENAI_KEY });
const imageCalls = () => ai.calls.openai.filter((c) => c[0] === 'generateImage').map((c) => c[1]);
const press = (id) => app.req('POST', `/api/sessions/${id}/ai-photo`);

test('the prompt keeps the dish name and main ingredients, without amounts, and forbids text and people', () => {
  const prompt = buildImagePrompt(sampleRecipe({ ingredients: ['400 g chicken thighs', '1 cup basmati rice', '2 cloves garlic', '½ cup yoghurt, thick', '1 tbsp oil'] }));
  assert.equal(prompt,
    'A natural, appetising photo of Garlicky Chicken & Spinach Rice, made with chicken thighs, basmati rice, garlic, yoghurt, home-cooked, served on a plate, soft daylight, no text, no people.');
});

test('one press makes one picture: landscape size, the cheapest quality by default, the suggested model', async () => {
  await withKeys();
  const id = addSession(app.db);
  const { status, body } = await press(id);
  assert.equal(status, 200);
  assert.equal(imageCalls().length, 1);
  const [call] = imageCalls();
  assert.equal(call.apiKey, OPENAI_KEY);
  assert.equal(call.model, 'gpt-image-fake-flare');
  assert.equal(call.quality, 'low');
  assert.match(call.prompt, /Garlicky Chicken & Spinach Rice/);
  assert.deepEqual(body.photo.kind, 'ai');
  const img = await fetch(`${app.base}/images/${body.photo.id}`);
  assert.equal(img.headers.get('content-type'), 'image/png');
});

test('the model and quality from Settings are used', async () => {
  await withKeys();
  await app.req('PUT', '/api/settings', { imageModel: 'gpt-image-fake-sunburst', imageQuality: 'high' });
  await press(addSession(app.db));
  assert.equal(imageCalls()[0].model, 'gpt-image-fake-sunburst');
  assert.equal(imageCalls()[0].quality, 'high');
});

test('pressing again replaces the old AI picture, so only one is kept', async () => {
  await withKeys();
  const id = addSession(app.db);
  const first = (await press(id)).body.photo;
  const second = (await press(id)).body.photo;
  assert.notEqual(first.id, second.id);
  assert.equal(readdirSync(app.imagesDir).length, 1);
  assert.equal(imageCalls().length, 2);
});

test('the user\'s own photo always wins over the AI one', async () => {
  await withKeys();
  const id = addSession(app.db);
  const mine = saveImage(app.db, app.imagesDir, id, 'cooked', JPEG, 'image/jpeg');
  const { body } = await press(id);
  assert.deepEqual(body.photo, { id: mine.id, kind: 'cooked' });
});

test('missing key, no recipe and unknown session are friendly errors that spend nothing', async () => {
  const id = addSession(app.db);
  assert.equal((await press(id)).body.error.code, 'no_key');
  await withKeys();
  const empty = app.db.prepare("INSERT INTO sessions (title, status, created_at, updated_at) VALUES ('x', 'draft', 'a', 'a')").run().lastInsertRowid;
  assert.equal((await press(Number(empty))).body.error.code, 'no_recipe');
  assert.equal((await press(9999)).status, 404);
  assert.equal(imageCalls().length, 0);
});

test('OpenAI problems become friendly messages and nothing is stored', async () => {
  await withKeys();
  const id = addSession(app.db);
  const cases = [
    [Object.assign(new Error('raw'), { status: 400, code: 'moderation_blocked' }), 422, 'image_declined', /declined this one/],
    [Object.assign(new Error('raw ' + OPENAI_KEY), { status: 401 }), 401, 'bad_key', /OpenAI did not accept/],
    [Object.assign(new Error('raw'), { status: 429 }), 429, 'rate_limited', /OpenAI is busy/],
    [Object.assign(new Error('raw'), { status: undefined }), 503, 'network', /Could not reach OpenAI/],
  ];
  for (const [error, status, code, message] of cases) {
    ai.openai.generateImage = async () => { throw error; };
    const res = await press(id);
    assert.equal(res.status, status);
    assert.equal(res.body.error.code, code);
    assert.match(res.body.error.message, message);
    assert.ok(!res.text.includes('fakefake') && !res.text.includes('raw'));
  }
  assert.equal(readdirSync(app.imagesDir).length, 0);
});

test('a reply that is not a picture is refused', async () => {
  await withKeys();
  ai.openai.generateImage = async () => ({ buffer: Buffer.from('<html>not an image</html>') });
  const res = await press(addSession(app.db));
  assert.equal(res.status, 502);
  assert.equal(readdirSync(app.imagesDir).length, 0);
});

test('COST SAFETY: nothing else in the app ever generates a picture', async () => {
  await withKeys();
  const created = await app.req('POST', '/api/sessions', { ingredients: ['rice'] });
  const id = created.body.id;
  await app.req('POST', `/api/sessions/${id}/refine`, { chips: ['Lighter'] });
  await fetch(`${app.base}/api/sessions/${id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'hi' }) }).then((r) => r.text());
  await app.req('POST', `/api/sessions/${id}/cooked`, {});
  await app.req('POST', `/api/sessions/${id}/duplicate`);
  await app.req('GET', '/api/models/openai?refresh=1');
  await app.req('GET', '/api/sessions');
  assert.equal(imageCalls().length, 0);
});
