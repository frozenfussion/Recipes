import { Router } from 'express';
import { ApiError } from '../lib/errors.js';
import { createList, deleteList, listLists, renameList } from '../lib/sessions.js';

export function parseId(value) {
  if (!/^\d{1,12}$/.test(String(value))) throw new ApiError(404, 'not_found', 'That item could not be found.');
  return Number(value);
}

export function listsRouter(db) {
  const router = Router();
  router.get('/lists', (req, res) => res.json({ lists: listLists(db) }));
  router.post('/lists', (req, res) => res.status(201).json(createList(db, (req.body || {}).name)));
  router.patch('/lists/:id', (req, res) => res.json(renameList(db, parseId(req.params.id), (req.body || {}).name)));
  router.delete('/lists/:id', (req, res) => {
    deleteList(db, parseId(req.params.id));
    res.json({ ok: true });
  });
  return router;
}
