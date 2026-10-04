import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb, schemaVersion } from '../src/db.js';

test('a new database gets schema version 1', () => {
  const db = openDb(':memory:');
  assert.equal(schemaVersion(db), 1);
});

test('foreign keys are switched on', () => {
  const db = openDb(':memory:');
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
});

test('opening the same file twice does not repeat migrations', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'chefbuddy-'));
  try {
    const file = path.join(dir, 'nested', 'test.db');
    openDb(file).close();
    const again = openDb(file);
    const rows = again.prepare('SELECT COUNT(*) AS n FROM schema_version').get();
    assert.equal(rows.n, 1);
    again.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
