import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { seedDemo } from '../src/lib/seed.js';
import { listLists, listSessions } from '../src/lib/sessions.js';

test('seeding fills an empty database once and never touches existing data', () => {
  const db = openDb(':memory:');
  assert.deepEqual(seedDemo(db), { seeded: true });
  assert.equal(listSessions(db).length, 5);
  assert.equal(listSessions(db, { status: 'recipes' }).length, 3);
  assert.equal(listLists(db).length, 2);
  assert.deepEqual(seedDemo(db), { seeded: false });
  assert.equal(listSessions(db).length, 5);
});
