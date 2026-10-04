import { api } from '../api.js';
import { confirmBox } from '../components/dialog.js';
import { recipeLine, sessionCard } from '../components/session-card.js';
import { toast } from '../components/toast.js';
import { errorBox, h, loadingBox, setChildren } from '../dom.js';
import { show } from '../router.js';

// My Recipes: saved and cooked sessions, organised into lists. The view state is kept
// while the page stays open so coming back from a recipe lands you where you were.
const view = { list: 'all', query: '', renaming: false, adding: false };

export async function renderSaved(root, isCurrent) {
  setChildren(root, loadingBox('Loading your recipes…'));
  let lists;
  let recipes;
  try {
    [lists, recipes] = await Promise.all([
      api('GET', '/lists').then((d) => d.lists),
      api('GET', '/sessions?status=recipes').then((d) => d.sessions),
    ]);
  } catch (err) {
    if (isCurrent()) setChildren(root, errorBox(err.message, () => renderSaved(root, isCurrent)));
    return;
  }
  if (!isCurrent()) return;
  if (view.list !== 'all' && !lists.some((l) => l.id === view.list)) view.list = 'all';

  const reload = () => renderSaved(root, isCurrent);
  const results = h('div');
  let searchTimer;

  async function paintResults() {
    let shown = recipes;
    if (view.query) {
      try {
        shown = (await api('GET', `/sessions?status=recipes&q=${encodeURIComponent(view.query)}`)).sessions;
      } catch (err) {
        setChildren(results, errorBox(err.message));
        return;
      }
    }
    if (view.list !== 'all') shown = shown.filter((r) => r.listId === view.list);
    if (!shown.length) {
      setChildren(results, h('div', { class: 'card empty' },
        h('h3', null, 'Nothing here yet'),
        h('p', null, view.query ? 'No recipes match your search.' : 'Cook something and tap Save, or add recipes to this list.'),
        h('button', { type: 'button', class: 'btn sm', onclick: () => show('home') }, '🍳 Start cooking')));
      return;
    }
    setChildren(results, h('div', { class: 'grid two' }, shown.map((r) => sessionCard(r, 'saved', recipeLine(r)))));
  }

  const pickList = (value) => { view.list = value; view.renaming = false; view.adding = false; reload(); };
  const chip = (label, value) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(view.list === value), onclick: () => pickList(value),
  }, label);

  const current = lists.find((l) => l.id === view.list);
  const search = h('input', { class: 'field', type: 'search', placeholder: '🔍 Search recipes…', 'aria-label': 'Search recipes', value: view.query });
  search.addEventListener('input', () => {
    view.query = search.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(paintResults, 200);
  });

  setChildren(root,
    h('div', { class: 'card' },
      h('div', { class: 'row between' },
        h('h2', null, 'My Recipes'),
        h('button', { type: 'button', class: 'btn alt sm', onclick: () => { view.adding = true; view.renaming = false; reload(); } }, '＋ New list')),
      view.adding ? newListForm() : null,
      h('div', { class: 'chips' }, chip(`All (${recipes.length})`, 'all'), lists.map((l) => chip(`${l.name} (${l.count})`, l.id))),
      current ? listPanel(current) : null,
      h('div', { class: 'stack' }, search)),
    results);
  paintResults();

  function newListForm() {
    const input = h('input', { class: 'field', placeholder: 'Name your new list…', maxlength: '40', 'aria-label': 'New list name' });
    const form = h('form', { class: 'inlineform' }, input,
      h('button', { class: 'btn sm' }, 'Create'),
      h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { view.adding = false; reload(); } }, 'Cancel'));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!input.value.trim()) return;
      try {
        const created = await api('POST', '/lists', { name: input.value });
        view.list = created.id; view.adding = false;
        toast('List created');
        reload();
      } catch (err) {
        toast(err.message, { error: true });
      }
    });
    queueMicrotask(() => input.focus());
    return form;
  }

  function listPanel(list) {
    if (view.renaming) {
      const input = h('input', { class: 'field', value: list.name, maxlength: '40', 'aria-label': 'List name' });
      const form = h('form', { class: 'inlineform mgmt' }, input,
        h('button', { class: 'btn sm' }, 'Save name'),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { view.renaming = false; reload(); } }, 'Cancel'));
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          await api('PATCH', `/lists/${list.id}`, { name: input.value });
          view.renaming = false;
          toast('List renamed');
          reload();
        } catch (err) {
          toast(err.message, { error: true });
        }
      });
      queueMicrotask(() => { input.focus(); input.select(); });
      return form;
    }
    return h('div', { class: 'mgmt row between' },
      h('span', null, 'List: ', h('strong', null, list.name)),
      h('span', { class: 'row' },
        h('button', { type: 'button', class: 'btn alt sm', onclick: () => { view.renaming = true; reload(); } }, '✏️ Rename'),
        h('button', {
          type: 'button', class: 'btn danger sm',
          onclick: async () => {
            const ok = await confirmBox({
              title: `Delete "${list.name}"?`, message: 'The recipes stay in My Recipes. Only the list is removed.',
              okLabel: 'Delete list', danger: true,
            });
            if (!ok) return;
            try {
              await api('DELETE', `/lists/${list.id}`);
              view.list = 'all';
              toast('List deleted');
              reload();
            } catch (err) {
              toast(err.message, { error: true });
            }
          },
        }, '🗑 Delete list')));
  }
}
