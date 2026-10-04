// Phone photos are huge (12 megapixels and up). We shrink them in the browser before upload:
// at most 1568 px on the long edge, saved as JPEG at about 85% quality. That keeps requests small,
// makes Claude cheaper (images are billed by size) and is plenty to recognise ingredients.
// Re-drawing the picture also drops hidden data such as the GPS location in the photo's EXIF.
const MAX_EDGE = 1568;
const QUALITY = 0.85;

export async function resizeImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not a photo. Choose a JPEG, PNG or WebP picture.');
  }
  let bitmap;
  try {
    // imageOrientation keeps phone photos the right way up.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('That photo could not be read. Try a JPEG or PNG picture.');
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = 'white'; // JPEG has no transparency
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();
  return { dataUrl: canvas.toDataURL('image/jpeg', QUALITY), width, height };
}
