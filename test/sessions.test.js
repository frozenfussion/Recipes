import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { saveImage } from '../src/lib/images.js';
import { addSession, fakeAi, sampleRecipe, startTestApp } from './helpers.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

let app;
beforeEach(async () => { app = await startTestApp(fakeAi()); });
afterEach(() => app.close());

const ids = (body) => body.sessions.map((s) => s.id);

test('History lists every session newest first, with a message count', async () => {
  const a = addSession(app.db, { now: '2026-10-01T10:00:00.000Z' });
  const b = addSession(app.db, { now: '2026-10-03T10:00:00.000Z' });
  const c = addSession(app.db, { now: '2026-10-02T10:00:00.000Z' });
  const { body } = await app.req('GET', '/api/sessions');
  assert.deepEqual(ids(body), [b, c, a]);
  assert.equal(body.sessions[0].messageCount, 1);
  assert.equal(body.sessions[0].status, 'draft');
  assert.deepEqual(body.sessions[0].tags, ['Halal', 'Nut-free']);
});

test('filters by status, "recipes" means saved + cooked, and by list', async () => {
  const list = (await app.req('POST', '/api/lists', { name: 'Weeknight' })).body;
  const draft = addSession(app.db);
  const saved = addSession(app.db, { status: 'saved', listId: list.id });
  const cooked = addSession(app.db, { status: 'cooked' });
  assert.deepEqual(ids((await app.req('GET', '/api/sessions?status=draft')).body), [draft]);
  assert.deepEqual(ids((await app.req('GET', '/api/sessions?status=recipes')).body).sort(), [saved, cooked].sort());
  assert.deepEqual(ids((await app.req('GET', `/api/sessions?status=recipes&list=${list.id}`)).body), [saved]);
  assert.deepEqual(ids((await app.req('GET', '/api/sessions?status=recipes&list=none')).body), [cooked]);
});

test('search matches the title and the ingredients, ignoring case', async () => {
  const biryani = addSession(app.db, { recipe: sampleRecipe({ title: 'Chicken Biryani', ingredients: ['500 g chicken', 'Saffron'] }) });
  const salad = addSession(app.db, { recipe: sampleRecipe({ title: 'Chickpea Salad', ingredients: ['1 can chickpeas', 'Lemon'] }) });
  assert.deepEqual(ids((await app.req('GET', '/api/sessions?q=BIRYANI')).body), [biryani]);
  assert.deepEqual(ids((await app.req('GET', '/api/sessions?q=saffron')).body), [biryani]);
  assert.deepEqual(ids((await app.req('GET', '/api/sessions?q=lemon')).body), [salad]);
  assert.deepEqual(ids((await app.req('GET', '/api/sessions?q=chick')).body).sort(), [biryani, salad].sort());
});

test('open one session: recipe, prefs and the whole chat', async () => {
  const id = addSession(app.db);
  const { status, body } = await app.req('GET', `/api/sessions/${id}`);
  assert.equal(status, 200);
  assert.equal(body.recipe.title, 'Garlicky Chicken & Spinach Rice');
  assert.equal(body.messages[0].content, 'Here is a recipe!');
  assert.equal((await app.req('GET', '/api/sessions/9999')).status, 404);
  assert.equal((await app.req('GET', '/api/sessions/abc')).status, 404);
});

test('editing changes the recipe and the title together, and rejects bad recipes', async () => {
  const id = addSession(app.db);
  const ok = await app.req('PATCH', `/api/sessions/${id}`, { title: 'New name', ingredients: ['a', '  b  ', ''], steps: ['one'] });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.title, 'New name');
  assert.deepEqual(ok.body.recipe.ingredients, ['a', 'b']);
  assert.equal((await app.req('PATCH', `/api/sessions/${id}`, { title: '   ' })).status, 400);
  assert.equal((await app.req('PATCH', `/api/sessions/${id}`, { ingredients: [] })).status, 400);
  assert.equal((await app.req('PATCH', `/api/sessions/${id}`, { steps: 'not a list' })).status, 400);
  assert.equal((await app.req('GET', `/api/sessions/${id}`)).body.title, 'New name');
});

test('putting a draft in a list also saves it; removing the list keeps it saved', async () => {
  const list = (await app.req('POST', '/api/lists', { name: 'Favs' })).body;
  const id = addSession(app.db);
  const inList = await app.req('PATCH', `/api/sessions/${id}`, { listId: list.id });
  assert.equal(inList.body.status, 'saved');
  assert.equal(inList.body.listName, 'Favs');
  const removed = await app.req('PATCH', `/api/sessions/${id}`, { listId: null });
  assert.equal(removed.body.status, 'saved');
  assert.equal(removed.body.listId, null);
  assert.equal((await app.req('PATCH', `/api/sessions/${id}`, { listId: 4242 })).status, 404);
});

test('status changes: cooked sets cooked_at once, bad statuses are refused', async () => {
  const id = addSession(app.db);
  const first = await app.req('PATCH', `/api/sessions/${id}`, { status: 'cooked' });
  assert.equal(first.body.status, 'cooked');
  assert.ok(first.body.cookedAt);
  const again = await app.req('PATCH', `/api/sessions/${id}`, { status: 'cooked' });
  assert.equal(again.body.cookedAt, first.body.cookedAt);
  assert.equal((await app.req('PATCH', `/api/sessions/${id}`, { status: 'frozen' })).status, 400);
});

test('duplicate: copy of the recipe, "(copy)" title, saved, no photo, fresh chat with one note', async () => {
  const id = addSession(app.db, { status: 'cooked' });
  saveImage(app.db, app.imagesDir, id, 'cooked', PNG, 'image/png');
  const { status, body } = await app.req('POST', `/api/sessions/${id}/duplicate`);
  assert.equal(status, 201);
  assert.notEqual(body.id, id);
  assert.equal(body.title, 'Garlicky Chicken & Spinach Rice (copy)');
  assert.equal(body.recipe.title, body.title);
  assert.equal(body.status, 'saved');
  assert.equal(body.photo, null);
  assert.equal(body.duplicatedFrom, id);
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].role, 'note');
  assert.deepEqual(body.recipe.ingredients, sampleRecipe().ingredients);
  assert.equal((await app.req('GET', `/api/sessions/${id}`)).body.title, 'Garlicky Chicken & Spinach Rice');
});

test('deleting a session removes its messages, image rows and image FILES', async () => {
  const id = addSession(app.db);
  const other = addSession(app.db);
  const mine = saveImage(app.db, app.imagesDir, id, 'cooked', PNG, 'image/png');
  const theirs = saveImage(app.db, app.imagesDir, other, 'cooked', PNG, 'image/png');
  assert.equal(readdirSync(app.imagesDir).length, 2);
  const res = await app.req('DELETE', `/api/sessions/${id}`);
  assert.equal(res.status, 200);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE session_id = ?').get(id).n, 0);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM images WHERE session_id = ?').get(id).n, 0);
  assert.equal(existsSync(`${app.imagesDir}/${mine.file}`), false);
  assert.equal(existsSync(`${app.imagesDir}/${theirs.file}`), true, 'someone else\'s photo must stay');
  assert.equal((await app.req('DELETE', `/api/sessions/${id}`)).status, 404);
});

test('a session shows one photo: the user\'s own beats the AI one', async () => {
  const id = addSession(app.db);
  const ai = saveImage(app.db, app.imagesDir, id, 'ai', PNG, 'image/png');
  assert.deepEqual((await app.req('GET', `/api/sessions/${id}`)).body.photo, { id: ai.id, kind: 'ai' });
  const mine = saveImage(app.db, app.imagesDir, id, 'cooked', PNG, 'image/png');
  saveImage(app.db, app.imagesDir, id, 'ai', PNG, 'image/png');
  assert.deepEqual((await app.req('GET', `/api/sessions/${id}`)).body.photo, { id: mine.id, kind: 'cooked' });
  assert.deepEqual((await app.req('GET', '/api/sessions')).body.sessions[0].photo, { id: mine.id, kind: 'cooked' });
});

test('stored images are served with the right type and nosniff; unknown ids are 404', async () => {
  const id = addSession(app.db);
  const img = saveImage(app.db, app.imagesDir, id, 'cooked', PNG, 'image/png');
  const res = await fetch(`${app.base}/images/${img.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal((await fetch(`${app.base}/images/9999`)).status, 404);
  assert.equal((await fetch(`${app.base}/images/..%2F..%2Fpackage.json`)).status, 404);
});

/* ---------- lists ---------- */

test('lists: create, rename, names are unique ignoring case, counts count saved recipes only', async () => {
  const a = await app.req('POST', '/api/lists', { name: '  Weeknight  ' });
  assert.equal(a.status, 201);
  assert.equal(a.body.name, 'Weeknight');
  assert.equal((await app.req('POST', '/api/lists', { name: 'WEEKNIGHT' })).status, 409);
  assert.equal((await app.req('POST', '/api/lists', { name: '' })).status, 400);
  assert.equal((await app.req('POST', '/api/lists', { name: 'x'.repeat(41) })).status, 400);
  const b = (await app.req('POST', '/api/lists', { name: 'Family' })).body;
  assert.equal((await app.req('PATCH', `/api/lists/${b.id}`, { name: 'weeknight' })).status, 409);
  const renamed = await app.req('PATCH', `/api/lists/${b.id}`, { name: 'Family favourites' });
  assert.equal(renamed.body.name, 'Family favourites');
  addSession(app.db, { status: 'saved', listId: a.body.id });
  addSession(app.db, { status: 'draft', listId: a.body.id });
  const lists = (await app.req('GET', '/api/lists')).body.lists;
  assert.deepEqual(lists.map((l) => [l.name, l.count]), [['Family favourites', 0], ['Weeknight', 1]]);
});

test('deleting a list keeps its recipes', async () => {
  const list = (await app.req('POST', '/api/lists', { name: 'Temp' })).body;
  const id = addSession(app.db, { status: 'saved', listId: list.id });
  assert.equal((await app.req('DELETE', `/api/lists/${list.id}`)).status, 200);
  const session = (await app.req('GET', `/api/sessions/${id}`)).body;
  assert.equal(session.status, 'saved');
  assert.equal(session.listId, null);
  assert.equal((await app.req('DELETE', `/api/lists/${list.id}`)).status, 404);
});

/* ---------- safety ---------- */

test('SQL and HTML in user text are stored as plain text, never run', async () => {
  const evil = `x'); DROP TABLE sessions; --`;
  const id = addSession(app.db);
  await app.req('PATCH', `/api/sessions/${id}`, { title: evil, ingredients: ['<img src=x onerror=alert(1)>'] });
  const { body } = await app.req('GET', `/api/sessions/${id}`);
  assert.equal(body.title, evil);
  assert.equal(body.recipe.ingredients[0], '<img src=x onerror=alert(1)>');
  assert.equal((await app.req('GET', '/api/sessions?q=' + encodeURIComponent(evil))).status, 200);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1);
});
