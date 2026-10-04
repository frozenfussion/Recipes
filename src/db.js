import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Each step runs once, in order. To change the database later, add a new step
// at the end. Never edit a step that has already shipped.
export const MIGRATIONS = [
  // Version 1 is just the bookkeeping table. Real tables arrive in later phases.
  (db) => db.exec('SELECT 1'),
  // Version 2: settings (API keys, chosen models, theme, cached model lists).
  (db) => db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)'),
  // Version 3: lists, sessions (a recipe plus its chat), messages and images.
  (db) => db.exec(`
    CREATE TABLE lists (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX lists_name_nocase ON lists (name COLLATE NOCASE);

    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      emoji TEXT,
      status TEXT NOT NULL CHECK (status IN ('draft', 'saved', 'cooked')),
      list_id INTEGER REFERENCES lists(id) ON DELETE SET NULL,
      prefs TEXT,
      recipe TEXT,
      duplicated_from INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      cooked_at TEXT
    );

    CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'note')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX messages_by_session ON messages (session_id, id);

    CREATE TABLE images (
      id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('fridge', 'cooked', 'ai')),
      file TEXT NOT NULL,
      mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX images_by_session ON images (session_id, kind, id);
  `),
];

// Runs fn inside one transaction: all of it happens, or none of it does.
export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

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
