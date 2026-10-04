import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MIGRATIONS, openDb, schemaVersion } from '../src/db.js';

function withTempDbFile(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'chefbuddy-'));
  try {
    return fn(path.join(dir, 'nested', 'test.db'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const tableExists = (db, name) =>
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;

test('a new database is brought up to the latest schema version', () => {
  const db = openDb(':memory:');
  assert.equal(schemaVersion(db), MIGRATIONS.length);
});

test('foreign keys are switched on', () => {
  const db = openDb(':memory:');
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
});

test('opening the same file twice does not repeat migrations', () => {
  withTempDbFile((file) => {
    openDb(file).close();
    const again = openDb(file);
    const rows = again.prepare('SELECT COUNT(*) AS n FROM schema_version').get();
    assert.equal(rows.n, MIGRATIONS.length);
    again.close();
  });
});

test('a migration that fails halfway is rolled back, so a restart does not hit "table already exists"', () => {
  withTempDbFile((file) => {
    const step1 = (db) => db.exec('CREATE TABLE first_table (id INTEGER)');
    const step2 = (db) => {
      db.exec('CREATE TABLE half_made (id INTEGER)');
      throw new Error('boom');
    };
    assert.throws(() => openDb(file, [step1, step2]), /boom/);

    // Look at what was kept: step 1 stays, the half-made table of step 2 is gone.
    const db = openDb(file, [step1]);
    assert.equal(schemaVersion(db), 1);
    assert.equal(tableExists(db, 'first_table'), true);
    assert.equal(tableExists(db, 'half_made'), false);
    db.close();
  });
});

test('a fixed migration succeeds on the next start', () => {
  withTempDbFile((file) => {
    const step1 = (db) => db.exec('CREATE TABLE first_table (id INTEGER)');
    const broken = (db) => {
      db.exec('CREATE TABLE second_table (id INTEGER)');
      throw new Error('boom');
    };
    const fixed = (db) => db.exec('CREATE TABLE second_table (id INTEGER)');
    assert.throws(() => openDb(file, [step1, broken]), /boom/);
    const db = openDb(file, [step1, fixed]);
    assert.equal(schemaVersion(db), 2);
    db.close();
  });
});

test('a database from a newer app is refused with a clear message', () => {
  withTempDbFile((file) => {
    const step = (db) => db.exec('SELECT 1');
    openDb(file, [step, step]).close();
    assert.throws(() => openDb(file, [step]), /newer Chef Buddy/);
  });
});
