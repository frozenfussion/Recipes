import { toast } from './components/toast.js';
import { state } from './state.js';

// A bare #screen hash (#home, #recipe, ...) like the mockup.
const screens = new Map();
let rendering = 0;

export function registerScreen(name, render) {
  screens.set(name, render);
}

export function currentScreen() {
  const name = location.hash.slice(1);
  return screens.has(name) ? name : 'home';
}

export async function show(name) {
  if (!screens.has(name)) name = 'home';
  if (name === 'recipe' && !state.currentId) {
    name = 'home';
    toast('Start a session first');
  }
  if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);

  for (const button of document.querySelectorAll('nav.tabs button')) {
    if (button.dataset.screen === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }

  const root = document.getElementById('screen');
  const ticket = ++rendering; // ignore a slow screen if the user already moved on
  root.replaceChildren();
  await screens.get(name)(root, () => ticket === rendering);
  window.scrollTo(0, 0);
}

export function startRouter() {
  document.querySelector('nav.tabs').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-screen]');
    if (button) show(button.dataset.screen);
  });
  window.addEventListener('hashchange', () => show(currentScreen()));
  return show(currentScreen());
}
