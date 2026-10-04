// Key/value settings stored in the `settings` table (see docs/specs/03-data-model.md).
export function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(db, key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}

export function deleteSetting(db, key) {
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}
