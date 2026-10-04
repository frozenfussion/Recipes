let timer;

// A short message at the bottom of the screen, gone after about 2.5 seconds.
export function toast(message, { error = false } = {}) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, error ? 4500 : 2500);
}
