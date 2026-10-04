// npm run backup: copies the database and images into a dated folder and keeps the newest 14.
// Safe to run while the app is running. On the server a systemd timer runs it every night.
// BACKUP_DIR picks the folder (default: backups/ in the project, which git ignores),
// BACKUP_KEEP how many to keep, DATA_DIR where the data lives (default: data/).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupData } from '../src/lib/backup.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'data');
const backupDir = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(root, 'backups');
const keep = Number(process.env.BACKUP_KEEP || 14);

if (!Number.isInteger(keep) || keep < 1) {
  console.error(`BACKUP_KEEP must be a whole number of 1 or more, but it is "${process.env.BACKUP_KEEP}".`);
  process.exit(1);
}

try {
  const { folder, removed } = backupData({ dataDir, backupDir, keep });
  console.log(`Backup written to ${folder}`);
  if (removed.length) console.log(`Removed ${removed.length} old backup(s): ${removed.join(', ')}`);
} catch (err) {
  console.error(`Backup failed: ${err.message}`);
  process.exit(1);
}
