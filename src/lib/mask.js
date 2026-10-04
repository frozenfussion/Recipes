// Shows enough of a key to recognise it, never enough to use it:
// the first 7 characters and the last 4, e.g. "sk-ant-…a1b2".
export function maskKey(key) {
  if (!key) return '';
  if (key.length < 16) return '••••'; // too short to show any part safely
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
