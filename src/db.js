import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Each step runs once, in order. To change the database later, add a new step
// at the end. Never edit a step that has already shipped.
export const MIGRATIONS = [
  // Version 1 is just the bookkeeping table. Real tables arrive in later phases.
  (db) => db.exec('SELECT 1'),
];

export function openDb(file, migrations = MIGRATIONS) {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');

  const current = schemaVersion(db) ?? 0;
  if (current > migrations.length) {
    db.close();
    throw new Error(
      `This database is from a newer Chef Buddy (version ${current}, this one knows ${migrations.length}). ` +
      'Update the app, or move data/chefbuddy.db out of the way to start fresh.'
    );
  }

  for (let v = current; v < migrations.length; v++) {
    // One step = one transaction. If it fails halfway, nothing is kept and the
    // version number is not recorded, so a restart will not hit "table already exists".
    db.exec('BEGIN');
    try {
      migrations[v](db);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(v + 1);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      db.close();
      throw err;
    }
  }
  return db;
}

export function schemaVersion(db) {
  return db.prepare('SELECT MAX(version) AS v FROM schema_version').get().v;
}
