import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeImage, detectImageType, MAX_IMAGE_BYTES } from '../src/lib/images.js';
import { validateRecipe } from '../src/lib/recipe.js';
import { sampleRecipe } from './helpers.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(4)]);

test('the type is decided by the first bytes, not by what the browser says', () => {
  assert.equal(detectImageType(JPEG), 'image/jpeg');
  assert.equal(detectImageType(PNG), 'image/png');
  assert.equal(detectImageType(WEBP), 'image/webp');
  assert.equal(detectImageType(Buffer.from('<svg onload=alert(1)>')), null);
  assert.equal(detectImageType(Buffer.from('GIF89a')), null);
  assert.equal(detectImageType(Buffer.alloc(0)), null);
});

test('decodeImage accepts base64 and data URLs, and refuses the rest politely', () => {
  assert.equal(decodeImage(JPEG.toString('base64')).mime, 'image/jpeg');
  assert.equal(decodeImage(`data:image/png;base64,${PNG.toString('base64')}`).mime, 'image/png');
  // A text file renamed to .jpg: right label, wrong bytes.
  assert.throws(() => decodeImage(`data:image/jpeg;base64,${Buffer.from('hello world, not a photo').toString('base64')}`), (e) => e.code === 'bad_image_type');
  assert.throws(() => decodeImage('not base64 !!!'), (e) => e.code === 'bad_image');
  assert.throws(() => decodeImage(''), (e) => e.code === 'bad_image');
  assert.throws(() => decodeImage(undefined), (e) => e.code === 'bad_image');
});

test('an image over 8 MB is refused with a friendly message', () => {
  const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
  assert.throws(() => decodeImage(big.toString('base64')), (e) => e.code === 'image_too_large' && /8 MB/.test(e.message));
});

test('validateRecipe cleans good recipes and rejects bad ones with plain messages', () => {
  const clean = validateRecipe({ ...sampleRecipe(), ingredients: [' a ', '', 'b'], time_minutes: '45', emoji: '' });
  assert.deepEqual(clean.ingredients, ['a', 'b']);
  assert.equal(clean.time_minutes, 45);
  assert.equal(clean.emoji, '🍽️');
  assert.equal(clean.detected_ingredients, undefined);
  assert.deepEqual(validateRecipe({ ...sampleRecipe(), detected_ingredients: ['egg'] }).detected_ingredients, ['egg']);
  for (const broken of [null, [], 'x', { ...sampleRecipe(), title: '' }, { ...sampleRecipe(), steps: [] },
    { ...sampleRecipe(), ingredients: [1, 2] }, { ...sampleRecipe(), title: 'x'.repeat(200) },
    { ...sampleRecipe(), tags: 'Halal' }, { ...sampleRecipe(), servings: 'lots' },
    { ...sampleRecipe(), steps: Array(70).fill('step') }]) {
    assert.throws(() => validateRecipe(broken), (e) => e.code === 'bad_recipe' && e.message.length > 5);
  }
});
