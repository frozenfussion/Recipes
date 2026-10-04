import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig } from './config.js';
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

// Print a plain message and stop, instead of a stack trace or a false "running".
function fail(message) {
  console.error(message);
  process.exit(1);
}

function start() {
  let config;
  let db;
  try {
    config = loadConfig(path.join(root, '.env'));
    db = openDb(path.join(root, 'data', 'chefbuddy.db'));
  } catch (err) {
    fail(err instanceof ConfigError ? err.message : `Could not start: ${err.message}`);
  }
  const { port, host } = config;

  const server = createApp(db).listen(port, host);
  server.once('listening', () => {
    console.log(`Chef Buddy is running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  });
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      fail(`Port ${port} is already in use. Close the other Chef Buddy window, or set PORT in your .env file.`);
    }
    if (err.code === 'EACCES') {
      fail(`Windows would not let Chef Buddy use port ${port}. Try a different PORT in your .env file.`);
    }
    fail(`Could not start the server: ${err.message}`);
  });
}

// Only start listening when this file is run directly (npm start), not when a test imports it.
if (import.meta.main) start();
