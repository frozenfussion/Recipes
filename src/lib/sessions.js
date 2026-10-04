import { transaction } from '../db.js';
import { ApiError } from './errors.js';
import { deleteImageFiles } from './images.js';
import { validateRecipe } from './recipe.js';

// A session is one cooking conversation: a recipe (once generated) plus its chat.
// See docs/specs/03-data-model.md for the rules this file implements.
const STATUSES = ['draft', 'saved', 'cooked'];
const nowIso = () => new Date().toISOString();

function parseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

const notFound = () => new ApiError(404, 'not_found', 'That recipe could not be found. It may have been deleted.');

const SUMMARY_SQL = `
  SELECT s.id, s.title, s.emoji, s.status, s.list_id, l.name AS list_name, s.recipe,
         s.created_at, s.updated_at, s.cooked_at,
         (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS message_count,
         (SELECT i.id FROM images i WHERE i.session_id = s.id AND i.kind = 'cooked' ORDER BY i.id DESC LIMIT 1) AS cooked_photo,
         (SELECT i.id FROM images i WHERE i.session_id = s.id AND i.kind = 'ai' ORDER BY i.id DESC LIMIT 1) AS ai_photo
  FROM sessions s LEFT JOIN lists l ON l.id = s.list_id`;

function toSummary(row) {
  const recipe = parseJson(row.recipe);
  // A session shows at most one dish photo: the user's own photo beats the AI one.
  let photo = null;
  if (row.cooked_photo) photo = { id: row.cooked_photo, kind: 'cooked' };
  else if (row.ai_photo) photo = { id: row.ai_photo, kind: 'ai' };
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji || '🍽️',
    status: row.status,
    listId: row.list_id,
    listName: row.list_name,
    tags: recipe ? recipe.tags : [],
    timeMinutes: recipe ? recipe.time_minutes : null,
    messageCount: row.message_count,
    photo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cookedAt: row.cooked_at,
    _ingredients: recipe ? recipe.ingredients : [],
  };
}

// status: 'draft' | 'saved' | 'cooked' | 'recipes' (= saved and cooked), or several separated by commas.
// list: a list id, or 'none'. q: matches the title and the ingredients, ignoring case.
export function listSessions(db, { status, list, q } = {}) {
  let rows = db.prepare(`${SUMMARY_SQL} ORDER BY s.created_at DESC, s.id DESC`).all().map(toSummary);

  if (status) {
    const wanted = new Set(status.split(',').flatMap((s) => (s === 'recipes' ? ['saved', 'cooked'] : [s])));
    rows = rows.filter((r) => wanted.has(r.status));
  }
  if (list === 'none') rows = rows.filter((r) => r.listId === null);
  else if (list) rows = rows.filter((r) => String(r.listId) === String(list));
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) => r.title.toLowerCase().includes(needle) || r._ingredients.some((i) => i.toLowerCase().includes(needle)));
  }
  return rows.map(({ _ingredients, ...rest }) => rest);
}

export function getSession(db, id) {
  const row = db.prepare(`${SUMMARY_SQL} WHERE s.id = ?`).get(id);
  if (!row) throw notFound();
  const { _ingredients, ...summary } = toSummary(row);
  const extra = db.prepare('SELECT prefs, duplicated_from FROM sessions WHERE id = ?').get(id);
  const messages = db.prepare('SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY id').all(id)
    .map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.created_at }));
  return {
    ...summary,
    prefs: parseJson(extra.prefs) || {},
    recipe: parseJson(row.recipe),
    duplicatedFrom: extra.duplicated_from,
    messages,
  };
}

// Rows without parsing, for code that needs the stored values.
export function getSessionRow(db, id) {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!row) throw notFound();
  return row;
}

export function addMessage(db, sessionId, role, content, now = nowIso()) {
  const info = db.prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)')
    .run(sessionId, role, content, now);
  db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);
  return Number(info.lastInsertRowid);
}

// Makes a session. Used by the AI routes, the duplicate button and the seed script.
export function createSession(db, { prefs = {}, recipe = null, status = 'draft', listId = null, duplicatedFrom = null, messages = [], now = nowIso() } = {}) {
  const clean = recipe ? validateRecipe(recipe) : null;
  if (!STATUSES.includes(status)) throw new ApiError(400, 'bad_status', 'Status must be draft, saved or cooked.');
  return transaction(db, () => {
    const info = db.prepare(`INSERT INTO sessions
      (title, emoji, status, list_id, prefs, recipe, duplicated_from, created_at, updated_at, cooked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      clean ? clean.title : 'New session', clean ? clean.emoji : null, status, listId,
      JSON.stringify(prefs), clean ? JSON.stringify(clean) : null, duplicatedFrom, now, now,
      status === 'cooked' ? now : null,
    );
    const id = Number(info.lastInsertRowid);
    for (const m of messages) addMessage(db, id, m.role, m.content, m.createdAt || now);
    return id;
  });
}

export function setRecipe(db, id, recipe) {
  const clean = validateRecipe(recipe);
  db.prepare('UPDATE sessions SET recipe = ?, title = ?, emoji = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(clean), clean.title, clean.emoji, nowIso(), id);
  return clean;
}

// Edit fields from the Recipe screen: title, ingredients, steps, notes (changes the recipe),
// listId (null = no list) and status. Setting a list on a draft also saves it.
export function updateSession(db, id, patch) {
  const row = getSessionRow(db, id);
  const now = nowIso();
  let status = row.status;
  let listId = row.list_id;

  const recipeFields = ['title', 'ingredients', 'steps', 'notes'].filter((f) => patch[f] !== undefined);
  if (recipeFields.length) {
    const current = parseJson(row.recipe);
    if (!current) throw new ApiError(400, 'no_recipe', 'This session has no recipe yet.');
    const merged = { ...current };
    for (const field of recipeFields) merged[field] = patch[field];
    setRecipe(db, id, merged);
  }

  if (patch.listId !== undefined) {
    if (patch.listId !== null) {
      if (!Number.isInteger(patch.listId) || !db.prepare('SELECT 1 FROM lists WHERE id = ?').get(patch.listId)) {
        throw new ApiError(404, 'list_not_found', 'That list could not be found.');
      }
      if (status === 'draft' && patch.status === undefined) status = 'saved';
    }
    listId = patch.listId;
  }

  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) throw new ApiError(400, 'bad_status', 'Status must be draft, saved or cooked.');
    status = patch.status;
  }

  const cookedAt = status === 'cooked' ? (row.cooked_at || now) : row.cooked_at;
  db.prepare('UPDATE sessions SET status = ?, list_id = ?, cooked_at = ?, updated_at = ? WHERE id = ?')
    .run(status, listId, cookedAt, now, id);
  return getSession(db, id);
}

// Copies the recipe into a new saved session with a fresh chat and no photo.
export function duplicateSession(db, id) {
  const row = getSessionRow(db, id);
  const recipe = parseJson(row.recipe);
  if (!recipe) throw new ApiError(400, 'no_recipe', 'This session has no recipe to duplicate yet.');
  const copy = { ...recipe, title: `${recipe.title} (copy)` };
  return createSession(db, {
    prefs: parseJson(row.prefs) || {},
    recipe: copy,
    status: 'saved',
    listId: row.list_id,
    duplicatedFrom: id,
    messages: [{ role: 'note', content: `Duplicated from “${recipe.title}”. Tell me what to change and I will update this copy.` }],
  });
}

// Deletes the session, its messages and image rows (cascade) and the image files on disk.
export async function deleteSession(db, imagesDir, id) {
  getSessionRow(db, id);
  const files = db.prepare('SELECT file FROM images WHERE session_id = ?').all(id).map((r) => r.file);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  await deleteImageFiles(imagesDir, files);
}

/* ---------- Lists ---------- */

const listName = (value) => {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(400, 'bad_list_name', 'Give the list a name.');
  const name = value.trim();
  if (name.length > 40) throw new ApiError(400, 'bad_list_name', 'List names can be up to 40 characters.');
  return name;
};

function duplicateNameError(err) {
  return /UNIQUE/i.test(err.message) ? new ApiError(409, 'duplicate_list', 'You already have a list with that name.') : err;
}

export function listLists(db) {
  return db.prepare(`
    SELECT l.id, l.name, l.created_at,
           (SELECT COUNT(*) FROM sessions s WHERE s.list_id = l.id AND s.status IN ('saved', 'cooked')) AS count
    FROM lists l ORDER BY l.name COLLATE NOCASE`).all()
    .map((l) => ({ id: l.id, name: l.name, count: l.count, createdAt: l.created_at }));
}

export function createList(db, name) {
  const clean = listName(name);
  try {
    const info = db.prepare('INSERT INTO lists (name, created_at) VALUES (?, ?)').run(clean, nowIso());
    return { id: Number(info.lastInsertRowid), name: clean, count: 0 };
  } catch (err) {
    throw duplicateNameError(err);
  }
}

export function renameList(db, id, name) {
  const clean = listName(name);
  if (!db.prepare('SELECT 1 FROM lists WHERE id = ?').get(id)) throw new ApiError(404, 'not_found', 'That list could not be found.');
  try {
    db.prepare('UPDATE lists SET name = ? WHERE id = ?').run(clean, id);
  } catch (err) {
    throw duplicateNameError(err);
  }
  return listLists(db).find((l) => l.id === id);
}

// The recipes stay: the foreign key sets their list_id to NULL.
export function deleteList(db, id) {
  const info = db.prepare('DELETE FROM lists WHERE id = ?').run(id);
  if (info.changes === 0) throw new ApiError(404, 'not_found', 'That list could not be found.');
}
