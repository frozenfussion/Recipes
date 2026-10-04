import { Router } from 'express';
import { schemaVersion } from '../db.js';

export function healthRouter(db) {
  const router = Router();
  router.get('/health', (req, res) => {
    res.json({ ok: true, schemaVersion: schemaVersion(db) });
  });
  return router;
}
