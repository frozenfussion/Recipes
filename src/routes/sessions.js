import { Router } from 'express';
import { deleteSession, duplicateSession, getSession, listSessions, updateSession } from '../lib/sessions.js';
import { parseId } from './lists.js';

// Sessions: History and My Recipes (list), open, edit, duplicate, delete.
// The AI routes (create, chat, refine, photos) are added in later phases.
export function sessionsRouter(db, { imagesDir }) {
  const router = Router();

  router.get('/sessions', (req, res) => {
    const { status, list, q } = req.query;
    res.json({ sessions: listSessions(db, { status, list, q: typeof q === 'string' ? q.trim() : undefined }) });
  });

  router.get('/sessions/:id', (req, res) => res.json(getSession(db, parseId(req.params.id))));

  router.patch('/sessions/:id', (req, res) => {
    const patch = {};
    const body = req.body || {};
    for (const field of ['title', 'ingredients', 'steps', 'notes', 'listId', 'status']) {
      if (body[field] !== undefined) patch[field] = body[field];
    }
    res.json(updateSession(db, parseId(req.params.id), patch));
  });

  router.delete('/sessions/:id', async (req, res) => {
    await deleteSession(db, imagesDir, parseId(req.params.id));
    res.json({ ok: true });
  });

  router.post('/sessions/:id/duplicate', (req, res) => {
    const id = duplicateSession(db, parseId(req.params.id));
    res.status(201).json(getSession(db, id));
  });

  return router;
}
