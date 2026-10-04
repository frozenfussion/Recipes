// Theme: 'light', 'dark' or 'device' (no data-theme attribute, the CSS follows the device).
// The database is the source of truth (see settings.js), localStorage is a mirror so
// theme-init.js can apply it before the first paint.
const KEY = 'cb-theme';

export function getTheme() {
  const attr = document.documentElement.dataset.theme;
  return attr === 'light' || attr === 'dark' ? attr : 'device';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
  try {
    if (theme === 'device') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}

export function isDarkNow() {
  const theme = getTheme();
  if (theme !== 'device') return theme === 'dark';
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
}
