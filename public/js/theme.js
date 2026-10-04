import { api } from './api.js';

// Theme: 'light', 'dark' or 'device' (no data-theme attribute, the CSS follows the device).
// The database is the source of truth, localStorage is a mirror so theme-init.js can
// apply it before the first paint (no flash).
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

// Apply now and remember it in the database. A failed save is not worth interrupting the user.
export function saveTheme(theme) {
  applyTheme(theme);
  return api('PUT', '/settings', { theme }).catch(() => {});
}

export function isDarkNow() {
  const theme = getTheme();
  if (theme !== 'device') return theme === 'dark';
  return Boolean(window.matchMedia) && matchMedia('(prefers-color-scheme: dark)').matches;
}

// On start-up, trust the database if it disagrees with this browser.
export async function syncThemeFromServer() {
  try {
    const settings = await api('GET', '/settings');
    if (settings.theme !== getTheme()) applyTheme(settings.theme);
  } catch {
    // Server not reachable yet: keep whatever the browser has.
  }
}
