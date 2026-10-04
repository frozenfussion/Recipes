import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { addSession, fakeAi, startTestApp } from './helpers.js';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 9)]);
const asUrl = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;

let app;
let ai;
beforeEach(async () => {
  ai = fakeAi();
  app = await startTestApp(ai);
  await app.req('PUT', '/api/settings', { anthropicApiKey: 'sk-ant-api03-fakefakefake-1234' });
});
afterEach(() => app.close());

const cook = (body) => app.req('POST', '/api/sessions', body);
const generateCalls = () => ai.calls.anthropic.filter((c) => c[0] === 'generateRecipe').map((c) => c[1]);
const fridgeFiles = () => app.db.prepare("SELECT file FROM images WHERE kind = 'fridge'").all().map((r) => r.file);

test('photos alone are enough, and Claude gets them labelled, before the text, as base64 image blocks', async () => {
  const { status, body } = await cook({ photos: [asUrl(JPEG, 'image/jpeg'), asUrl(PNG, 'image/png')] });
  assert.equal(status, 201);
  const [{ messages }] = generateCalls();
  const blocks = messages[0].content;
  assert.deepEqual(blocks.map((b) => b.type), ['text', 'image', 'text', 'image', 'text']);
  assert.equal(blocks[0].text, 'Image 1:');
  assert.equal(blocks[1].source.media_type, 'image/jpeg');
  assert.equal(blocks[1].source.data, JPEG.toString('base64'));
  assert.equal(blocks[3].source.media_type, 'image/png');
  assert.match(blocks[4].text, /2 photos/);
  assert.deepEqual(body.recipe.detected_ingredients, ['eggs', 'milk']);
  assert.match(body.messages[0].content, /2 photos attached/);
});

test('our own copy of each fridge photo is stored, but it is never shown as the dish photo', async () => {
  const { body } = await cook({ photos: [asUrl(JPEG, 'image/jpeg')], ingredients: ['rice'] });
  assert.equal(fridgeFiles().length, 1);
  assert.equal(readdirSync(app.imagesDir).length, 1);
  assert.equal(body.photo, null);
});

test('later chat turns do not resend the photos', async () => {
  const { body } = await cook({ photos: [asUrl(JPEG, 'image/jpeg')] });
  await fetch(`${app.base}/api/sessions/${body.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'hi' }) }).then((r) => r.text());
  const chatCall = ai.calls.anthropic.find((c) => c[0] === 'streamChat')[1];
  assert.ok(chatCall.messages.every((m) => typeof m.content === 'string'));
});

test('bad photos are refused politely and nothing is created or spent', async () => {
  const cases = [
    [{ photos: Array(5).fill(asUrl(JPEG, 'image/jpeg')) }, 'too_many_photos'],
    [{ photos: [asUrl(Buffer.from('<svg onload=alert(1)>'), 'image/jpeg')] }, 'bad_image_type'],
    [{ photos: [asUrl(Buffer.from('GIF89a'), 'image/gif')] }, 'bad_image_type'],
    [{ photos: ['%%%not base64%%%'] }, 'bad_image'],
    [{ photos: 'nope' }, 'bad_image'],
    [{ photos: [asUrl(Buffer.concat([JPEG, Buffer.alloc(9 * 1024 * 1024)]), 'image/jpeg')] }, 'image_too_large'],
  ];
  for (const [body, code] of cases) {
    const res = await cook(body);
    assert.equal(res.body.error.code, code, code);
    assert.ok(res.status === 400 || res.status === 413);
  }
  assert.equal(generateCalls().length, 0);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
  assert.equal(readdirSync(app.imagesDir).length, 0);
});

test('deleting a session removes its fridge photo files too', async () => {
  const { body } = await cook({ photos: [asUrl(JPEG, 'image/jpeg'), asUrl(PNG, 'image/png')] });
  const files = fridgeFiles();
  assert.equal(files.length, 2);
  await app.req('DELETE', `/api/sessions/${body.id}`);
  for (const file of files) assert.equal(existsSync(`${app.imagesDir}/${file}`), false);
});

/* ---------- I cooked it ---------- */

test('cooked with a photo: status cooked, the photo is stored and shown', async () => {
  const id = addSession(app.db);
  const { status, body } = await app.req('POST', `/api/sessions/${id}/cooked`, { photo: asUrl(JPEG, 'image/jpeg') });
  assert.equal(status, 200);
  assert.equal(body.status, 'cooked');
  assert.ok(body.cookedAt);
  assert.equal(body.photo.kind, 'cooked');
  const img = await fetch(`${app.base}/images/${body.photo.id}`);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.from(await img.arrayBuffer()).equals(JPEG), true);
});

test('cooked without a photo still saves it as Cooked', async () => {
  const id = addSession(app.db);
  const { body } = await app.req('POST', `/api/sessions/${id}/cooked`, {});
  assert.equal(body.status, 'cooked');
  assert.equal(body.photo, null);
});

test('a bad photo changes nothing; a new photo replaces the old one on disk', async () => {
  const id = addSession(app.db);
  const bad = await app.req('POST', `/api/sessions/${id}/cooked`, { photo: asUrl(Buffer.from('hello world, not a photo'), 'image/jpeg') });
  assert.equal(bad.status, 400);
  assert.equal((await app.req('GET', `/api/sessions/${id}`)).body.status, 'draft');

  const first = (await app.req('POST', `/api/sessions/${id}/cooked`, { photo: asUrl(JPEG, 'image/jpeg') })).body.photo;
  const second = (await app.req('POST', `/api/sessions/${id}/cooked`, { photo: asUrl(PNG, 'image/png') })).body.photo;
  assert.notEqual(first.id, second.id);
  assert.equal(readdirSync(app.imagesDir).length, 1, 'the replaced photo is gone from disk');
  assert.equal((await fetch(`${app.base}/images/${first.id}`)).status, 404);
  assert.equal((await app.req('POST', '/api/sessions/9999/cooked', {})).status, 404);
});

test('cooked photos can be bigger than the normal JSON limit but not over 8 MB', async () => {
  const id = addSession(app.db);
  const fiveMb = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
  assert.equal((await app.req('POST', `/api/sessions/${id}/cooked`, { photo: asUrl(fiveMb, 'image/jpeg') })).status, 200);
  const huge = await app.req('POST', `/api/sessions/${id}/cooked`, { photo: asUrl(Buffer.concat([JPEG, Buffer.alloc(30 * 1024 * 1024)]), 'image/jpeg') });
  assert.equal(huge.status, 413);
  assert.equal(huge.body.error.code, 'too_large');
});

test('other JSON routes keep the small 1 MB limit', async () => {
  const res = await app.req('POST', '/api/lists', { name: 'x'.repeat(2 * 1024 * 1024) });
  assert.equal(res.status, 413);
});
