import { h } from './dom.js';
import { isDarkNow, saveTheme, syncThemeFromServer } from './theme.js';
import { registerScreen, startRouter } from './router.js';
import { renderHistory } from './screens/history.js';
import { renderRecipe } from './screens/recipe.js';
import { renderSaved } from './screens/saved.js';
import { renderSettings } from './screens/settings.js';

// The Cook screen arrives in Phase 4. Until then it is a placeholder.
function placeholder(title, text) {
  return (root) => root.append(h('div', { class: 'card empty' }, h('h2', null, title), h('p', null, text)));
}

registerScreen('home', placeholder('Cook', 'The Cook screen arrives in Phase 4.'));
registerScreen('recipe', renderRecipe);
registerScreen('history', renderHistory);
registerScreen('saved', renderSaved);
registerScreen('settings', renderSettings);

document.getElementById('themeBtn').addEventListener('click', () => {
  saveTheme(isDarkNow() ? 'light' : 'dark');
});

startRouter();
syncThemeFromServer();
