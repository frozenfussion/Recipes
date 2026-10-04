import { h } from './dom.js';
import { applyTheme, isDarkNow } from './theme.js';
import { registerScreen, startRouter } from './router.js';

// Phase 1: the shell. The real screens arrive in later phases, for now each is a placeholder.
function placeholder(title, text) {
  return (root) => root.append(h('div', { class: 'card empty' }, h('h2', null, title), h('p', null, text)));
}

registerScreen('home', placeholder('Cook', 'The Cook screen arrives in Phase 4.'));
registerScreen('recipe', placeholder('Recipe', 'The Recipe screen arrives in Phase 3.'));
registerScreen('history', placeholder('History', 'History arrives in Phase 3.'));
registerScreen('saved', placeholder('My Recipes', 'My Recipes arrives in Phase 3.'));
registerScreen('settings', placeholder('Settings', 'Settings arrives in Phase 2.'));

document.getElementById('themeBtn').addEventListener('click', () => {
  applyTheme(isDarkNow() ? 'light' : 'dark');
});

startRouter();
