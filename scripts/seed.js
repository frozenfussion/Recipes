// npm run seed: puts a small demo data set into the database so the screens have something to show.
// It does nothing if the database already has sessions, so it can never overwrite your own recipes.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db.js';
import { seedDemo } from '../src/lib/seed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');

const db = openDb(path.join(dataDir, 'chefbuddy.db'));
const { seeded } = seedDemo(db);
console.log(seeded
  ? 'Demo data added: 5 recipes and 2 lists. Start the app with npm start.'
  : 'Skipped: the database already has sessions, so nothing was changed.');
db.close();
