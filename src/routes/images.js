import { Router } from 'express';
import { ApiError } from '../lib/errors.js';

// GET /images/:id serves a stored image. The file name comes from our own database,
// never from the URL, so nobody can ask for some other file on disk.
export function imagesRouter(db, { imagesDir }) {
  const router = Router();
  router.get('/:id', (req, res, next) => {
    if (!/^\d{1,12}$/.test(req.params.id)) return next(new ApiError(404, 'not_found', 'That image could not be found.'));
    const row = db.prepare('SELECT file, mime FROM images WHERE id = ?').get(Number(req.params.id));
    if (!row) return next(new ApiError(404, 'not_found', 'That image could not be found.'));
    res.sendFile(row.file, {
      root: imagesDir,
      dotfiles: 'deny',
      cacheControl: false,
      headers: { 'Content-Type': row.mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-cache' },
    }, (err) => { if (err && !res.headersSent) next(new ApiError(404, 'not_found', 'That image could not be found.')); });
  });
  return router;
}
