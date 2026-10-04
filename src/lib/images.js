import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from './errors.js';

// Image files live only in data/images/ under random names. We decide the name and the
// type ourselves, the browser never supplies a path.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Look at the first bytes of the file, not at what the browser claims it is.
export function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// Accepts raw base64 or a data: URL. Returns { buffer, mime } or throws a polite ApiError.
export function decodeImage(value) {
  if (typeof value !== 'string' || !value) throw new ApiError(400, 'bad_image', 'That photo could not be read. Try another one.');
  const base64 = value.replace(/^data:[^;,]+;base64,/, '');
  if (base64.length * 0.75 > MAX_IMAGE_BYTES * 1.01) {
    throw new ApiError(413, 'image_too_large', 'That photo is too big (the limit is 8 MB). Try a smaller one.');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new ApiError(400, 'bad_image', 'That photo could not be read. Try another one.');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) throw new ApiError(413, 'image_too_large', 'That photo is too big (the limit is 8 MB). Try a smaller one.');
  const mime = detectImageType(buffer);
  if (!mime) throw new ApiError(400, 'bad_image_type', 'Only JPEG, PNG or WebP photos are allowed.');
  return { buffer, mime };
}

export const MAX_PHOTOS = 4;

// A list of photos from the browser (up to 4). Returns [{ buffer, mime }]. The browser has already
// shrunk them, but we never trust that: every photo is checked here too.
export function decodePhotos(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError(400, 'bad_image', 'The photos could not be read. Try again.');
  if (value.length > MAX_PHOTOS) throw new ApiError(400, 'too_many_photos', `You can add up to ${MAX_PHOTOS} photos at a time.`);
  return value.map(decodeImage);
}

// Writes the file and records it in the images table. Returns { id, mime }.
export function saveImage(db, imagesDir, sessionId, kind, buffer, mime) {
  mkdirSync(imagesDir, { recursive: true });
  const file = `${randomUUID()}${EXTENSIONS[mime]}`;
  writeFileSync(path.join(imagesDir, file), buffer);
  const info = db.prepare(
    'INSERT INTO images (session_id, kind, file, mime, created_at) VALUES (?, ?, ?, ?, ?)',
  ).run(sessionId, kind, file, mime, new Date().toISOString());
  return { id: Number(info.lastInsertRowid), mime, file };
}

// Best effort: a file that is already gone is not an error.
export async function deleteImageFiles(imagesDir, files) {
  await Promise.all(files.map((file) => unlink(path.join(imagesDir, file)).catch(() => {})));
}
