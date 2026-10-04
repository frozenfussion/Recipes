import { DatabaseSync } from 'node:sqlite';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

// One backup = one folder named after the time, holding a copy of the database and the images.
// Folder names sort by time (2026-10-04T03-30-00), so the oldest ones are easy to find and delete.
const NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

export function backupName(now) {
  return new Date(now).toISOString().slice(0, 19).replaceAll(':', '-');
}

// Copies data/ into backupDir/<time>/ and keeps only the newest `keep` backups.
// Returns { folder, removed }.
export function backupData({ dataDir, backupDir, keep = 14, now = Date.now() }) {
  const dbFile = path.join(dataDir, 'chefbuddy.db');
  if (!existsSync(dbFile)) throw new Error(`No database at ${dbFile}, so there is nothing to back up.`);

  const folder = path.join(backupDir, backupName(now));
  if (existsSync(folder)) throw new Error(`A backup called ${folder} already exists.`);
  mkdirSync(folder, { recursive: true });

  // VACUUM INTO writes a complete, consistent copy even while the app is running and writing.
  // Copying the .db file by hand could catch it halfway through a write.
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    db.prepare('VACUUM INTO ?').run(path.join(folder, 'chefbuddy.db'));
  } finally {
    db.close();
  }

  const imagesDir = path.join(dataDir, 'images');
  if (existsSync(imagesDir)) cpSync(imagesDir, path.join(folder, 'images'), { recursive: true });

  const old = readdirSync(backupDir).filter((name) => NAME.test(name)).sort().slice(0, -keep);
  for (const name of old) rmSync(path.join(backupDir, name), { recursive: true, force: true });
  return { folder, removed: old };
}
