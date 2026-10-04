// Loaded as a normal (blocking) script in <head>, before the page is painted.
// "Match my device" means no data-theme attribute at all (the CSS handles it).
try {
  var saved = localStorage.getItem('cb-theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch (e) {
  // Storage can be blocked, the device setting is a fine fallback.
}
