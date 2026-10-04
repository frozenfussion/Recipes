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

// Where API keys come from. Normally (your own PC) they are typed on the Settings page and kept
// in the settings table. On a server, createApp() calls useServerKeys() with the keys systemd
// handed over, and from then on the database is never asked for, or given, a key.
// The keys are tied to the database object so every part of the app that already has `db` can
// find them without passing another argument around.
const serverKeysByDb = new WeakMap();

export function useServerKeys(db, keys) {
  serverKeysByDb.set(db, keys);
}

export function keysOnServer(db) {
  return serverKeysByDb.has(db);
}

// name is 'anthropic_api_key' or 'openai_api_key'.
export function getApiKey(db, name) {
  return keysOnServer(db) ? serverKeysByDb.get(db)[name] || null : getSetting(db, name);
}

// The "no key" error, worded for where the key is supposed to come from.
export function noKeyMessage(db, label) {
  return keysOnServer(db)
    ? `No ${label} API key on the server yet. The server admin adds it with deploy/set-keys.sh.`
    : `No ${label} API key yet. Add one in Settings.`;
}
