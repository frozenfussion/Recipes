import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.js';
import { backupData, backupName } from '../src/lib/backup.js';
import { addSession } from './helpers.js';

let dir;
let dataDir;
let backupDir;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'chefbuddy-backup-'));
  dataDir = path.join(dir, 'data');
  backupDir = path.join(dir, 'backups');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-10-04T03:30:00Z');

test('backup names sort by time and are safe on Windows (no colons)', () => {
  assert.equal(backupName(START), '2026-10-04T03-30-00');
});

test('a backup holds a working copy of the database and the images, even while the app has it open', () => {
  const db = openDb(path.join(dataDir, 'chefbuddy.db'));
  addSession(db);
  mkdirSync(path.join(dataDir, 'images'));
  writeFileSync(path.join(dataDir, 'images', 'a.png'), 'png bytes');
  try {
    const { folder } = backupData({ dataDir, backupDir, now: START });
    const copy = new DatabaseSync(path.join(folder, 'chefbuddy.db'), { readOnly: true });
    assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1);
    copy.close();
    assert.equal(readFileSync(path.join(folder, 'images', 'a.png'), 'utf8'), 'png bytes');
  } finally {
    db.close();
  }
});

test('only the newest backups are kept, and other folders are never touched', () => {
  openDb(path.join(dataDir, 'chefbuddy.db')).close();
  mkdirSync(path.join(backupDir, 'keep-me'), { recursive: true });
  for (let i = 0; i < 5; i++) backupData({ dataDir, backupDir, keep: 3, now: START + i * DAY });
  assert.deepEqual(readdirSync(backupDir).sort(), [
    '2026-10-06T03-30-00', '2026-10-07T03-30-00', '2026-10-08T03-30-00', 'keep-me',
  ]);
});

test('no database means a clear error, not an empty backup', () => {
  assert.throws(() => backupData({ dataDir, backupDir, now: START }), /nothing to back up/);
  assert.equal(existsSync(backupDir), false);
});
