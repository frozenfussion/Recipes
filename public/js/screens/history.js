import { api } from '../api.js';
import { chipChoice } from '../components/chips.js';
import { historyLine, sessionCard } from '../components/session-card.js';
import { errorBox, h, loadingBox, setChildren } from '../dom.js';
import { show } from '../router.js';

const FILTERS = [['all', 'All'], ['cooked', '🎉 Cooked'], ['saved', '⭐ Saved'], ['draft', '📝 Not saved']];
let filter = 'all'; // remembered while the page stays open

export async function renderHistory(root, isCurrent) {
  setChildren(root, loadingBox('Loading your history…'));
  let sessions;
  try {
    sessions = (await api('GET', '/sessions')).sessions;
  } catch (err) {
    if (isCurrent()) setChildren(root, errorBox(err.message, () => renderHistory(root, isCurrent)));
    return;
  }
  if (!isCurrent()) return;

  const results = h('div');
  const paint = () => {
    const visible = sessions.filter((s) => filter === 'all' || s.status === filter);
    if (!visible.length) {
      setChildren(results, h('div', { class: 'card empty' },
        h('h3', null, 'Nothing here yet'),
        h('p', null, filter === 'all' ? 'Every session you start will show up here.' : 'No sessions match this filter.'),
        h('button', { type: 'button', class: 'btn sm', onclick: () => show('home') }, '🍳 Start cooking')));
      return;
    }
    setChildren(results, h('div', { class: 'grid two' }, visible.map((s) => sessionCard(s, 'history', historyLine(s)))));
  };

  setChildren(root,
    h('div', { class: 'card' },
      h('h2', null, 'History'),
      h('p', { class: 'small' }, 'Every session you have started, newest first. Open one to carry on chatting.'),
      chipChoice(FILTERS, filter, (value) => { filter = value; paint(); })),
    results);
  paint();
}
