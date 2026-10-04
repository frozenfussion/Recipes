import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Each step runs once, in order. To change the database later, add a new step
// at the end. Never edit a step that has already shipped.
const MIGRATIONS = [
  // Version 1 is just the bookkeeping table. Real tables arrive in later phases.
  (db) => db.exec('SELECT 1'),
];

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');

  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get();
  const current = row.v ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    MIGRATIONS[v](db);
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(v + 1);
  }
  return db;
}

export function schemaVersion(db) {
  return db.prepare('SELECT MAX(version) AS v FROM schema_version').get().v;
}
