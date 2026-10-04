import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAi } from './ai/index.js';
import { ConfigError, loadConfig } from './config.js';
import { openDb } from './db.js';
import { ApiError, sendError } from './lib/errors.js';
import { createRateLimiter } from './lib/rate-limit.js';
import { isLoopbackHost, requestGuard, securityHeaders } from './lib/security.js';
import { healthRouter } from './routes/health.js';
import { imagesRouter } from './routes/images.js';
import { listsRouter } from './routes/lists.js';
import { modelsRouter } from './routes/models.js';
import { sessionsRouter } from './routes/sessions.js';
import { settingsRouter } from './routes/settings.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Photos travel as base64 inside JSON, so those routes get a bigger limit than the rest.
const smallJson = express.json({ limit: '1mb' });
const photoJson = express.json({ limit: '25mb' });
const isPhotoRoute = (req) =>
  req.method === 'POST' && (req.path === '/sessions' || /^\/sessions\/\d+\/cooked$/.test(req.path));

// Building the app in a function lets tests use an in-memory database and fake AI services.
export function createApp(db, {
  ai = createAi(),
  imagesDir = path.join(root, 'data', 'images'),
  loopbackOnly = true,
  // Everything that costs money shares one gate (30 a minute), pictures get a tighter one (10 a minute).
  limiters = { ai: createRateLimiter({ limit: 30 }), image: createRateLimiter({ limit: 10 }) },
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(requestGuard({ loopbackOnly }));

  app.use('/api', (req, res, next) => (isPhotoRoute(req) ? photoJson : smallJson)(req, res, next));
  app.use('/api', healthRouter(db));
  app.use('/api', settingsRouter(db, ai, limiters.ai));
  app.use('/api', modelsRouter(db, ai));
  app.use('/api', listsRouter(db));
  app.use('/api', sessionsRouter(db, { ai, imagesDir, limiters }));
  app.use('/api', (req, res) => sendError(res, 404, 'not_found', 'That API address does not exist.'));
  app.use('/images', imagesRouter(db, { imagesDir }));

  app.use(express.static(path.join(root, 'public')));

  // One place that turns every error into the standard JSON shape.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof ApiError) return sendError(res, err.status, err.code, err.message);
    if (err.type === 'entity.too.large') return sendError(res, 413, 'too_large', 'That upload is too big. Try a smaller photo.');
    if (err.type === 'entity.parse.failed') return sendError(res, 400, 'bad_json', 'The request was not valid JSON.');
    console.error(err.message); // message only, never the whole request (it may hold a key)
    sendError(res, 500, 'server_error', 'Something went wrong on the server.');
  });
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
  // DATA_DIR lets the tests use a temporary folder instead of the real data/ folder.
  const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
  try {
    config = loadConfig(path.join(root, '.env'));
    db = openDb(path.join(dataDir, 'chefbuddy.db'));
  } catch (err) {
    fail(err instanceof ConfigError ? err.message : `Could not start: ${err.message}`);
  }
  const { port, host } = config;

  const app = createApp(db, { imagesDir: path.join(dataDir, 'images'), loopbackOnly: isLoopbackHost(host) });
  const server = app.listen(port, host);
  server.once('listening', () => {
    console.log(`Chef Buddy is running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    if (!isLoopbackHost(host)) {
      console.log('Heads up: other devices on your network can open this app. It has no login and it spends your API credit.');
    }
  });
  // Ctrl+C: stop listening and close the database cleanly.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { server.close(); db.close(); process.exit(0); });
  }
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
