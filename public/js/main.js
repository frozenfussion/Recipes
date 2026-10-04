import { toast } from './components/toast.js';
import { isDarkNow, saveTheme, syncThemeFromServer } from './theme.js';
import { registerScreen, startRouter } from './router.js';
import { renderCook } from './screens/cook.js';
import { renderHistory } from './screens/history.js';
import { renderRecipe } from './screens/recipe.js';
import { renderSaved } from './screens/saved.js';
import { renderSettings } from './screens/settings.js';

registerScreen('home', renderCook);
registerScreen('recipe', renderRecipe);
registerScreen('history', renderHistory);
registerScreen('saved', renderSaved);
registerScreen('settings', renderSettings);

// A safety net: if something unexpected goes wrong, say so in plain words instead of failing silently.
window.addEventListener('unhandledrejection', () => {
  toast('Something went wrong. Please try again.', { error: true });
});

document.getElementById('themeBtn').addEventListener('click', () => {
  saveTheme(isDarkNow() ? 'light' : 'dark');
});

startRouter();
syncThemeFromServer();
