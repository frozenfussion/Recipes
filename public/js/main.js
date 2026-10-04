import { h } from './dom.js';
import { isDarkNow, saveTheme, syncThemeFromServer } from './theme.js';
import { registerScreen, startRouter } from './router.js';
import { renderSettings } from './screens/settings.js';

// The real screens arrive phase by phase. Until then a screen is a placeholder.
function placeholder(title, text) {
  return (root) => root.append(h('div', { class: 'card empty' }, h('h2', null, title), h('p', null, text)));
}

registerScreen('home', placeholder('Cook', 'The Cook screen arrives in Phase 4.'));
registerScreen('recipe', placeholder('Recipe', 'The Recipe screen arrives in Phase 3.'));
registerScreen('history', placeholder('History', 'History arrives in Phase 3.'));
registerScreen('saved', placeholder('My Recipes', 'My Recipes arrives in Phase 3.'));
registerScreen('settings', renderSettings);

document.getElementById('themeBtn').addEventListener('click', () => {
  saveTheme(isDarkNow() ? 'light' : 'dark');
});

startRouter();
syncThemeFromServer();
