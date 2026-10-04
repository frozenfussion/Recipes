import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST, PORT } from './config.js';
import { openDb } from './db.js';
import { ApiError, sendError } from './lib/errors.js';
import { healthRouter } from './routes/health.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Building the app in a function lets tests use an in-memory database.
export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');

  app.use('/api', healthRouter(db));
  app.use('/api', (req, res) => sendError(res, 404, 'not_found', 'That API address does not exist.'));
  app.use('/api', (err, req, res, next) => {
    if (err instanceof ApiError) return sendError(res, err.status, err.code, err.message);
    console.error(err.message); // message only, never the whole request
    sendError(res, 500, 'server_error', 'Something went wrong on the server.');
  });

  app.use(express.static(path.join(root, 'public')));
  return app;
}

// Only start listening when this file is run directly (npm start), not when a test imports it.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const db = openDb(path.join(root, 'data', 'chefbuddy.db'));
  createApp(db).listen(PORT, HOST, () => {
    console.log(`Chef Buddy is running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  });
}
