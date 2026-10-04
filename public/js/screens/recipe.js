import { api, ApiClientError, SLOW_TIMEOUT_MS, streamPost } from '../api.js';
import { closeDialog, confirmBox, openDialog } from '../components/dialog.js';
import { statusBadge } from '../components/session-card.js';
import { toast } from '../components/toast.js';
import { errorBox, formatDate, h, loadingBox, setChildren, spinner } from '../dom.js';
import { resizeImage } from '../image.js';
import { show } from '../router.js';
import { resetCook, state } from '../state.js';

const AI_HINT_KEY = 'cb-ai-photo-hint-seen';
const localGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const localSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* storage blocked: we will just ask again */ } };

const BACK_LABELS = { home: '← Back to ingredients', history: '← History', saved: '← My Recipes' };
const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);

// The Recipe screen: the recipe on the left, "Ask Chef Buddy" chat on the right.
let editing = false;

export async function renderRecipe(root, isCurrent) {
  setChildren(root, loadingBox('Opening your recipe…'));
  let session;
  try {
    session = await api('GET', `/sessions/${state.currentId}`);
  } catch (err) {
    if (isCurrent()) {
      setChildren(root, errorBox(err.message, () => renderRecipe(root, isCurrent)),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => show('history') }, '← History'));
    }
    return;
  }
  if (!isCurrent()) return;
  editing = false;
  paint(root, session, isCurrent);
}

function paint(root, session, isCurrent) {
  const repaint = (next) => paint(root, next, isCurrent);
  const reload = async () => repaint(await api('GET', `/sessions/${session.id}`));
  const run = async (work) => {
    try {
      await work();
    } catch (err) {
      toast(err.message, { error: true });
    }
  };

  const refinePanel = h('div', { class: 'card', hidden: true }, refineContent());

  setChildren(root,
    h('div', { class: 'bar' },
      h('button', { type: 'button', class: 'btn ghost sm', onclick: () => show(state.backTo) }, BACK_LABELS[state.backTo] || BACK_LABELS.home),
      h('button', { type: 'button', class: 'btn alt sm', onclick: () => { refinePanel.hidden = !refinePanel.hidden; } }, '✏️ Refine'),
      h('button', { type: 'button', class: 'btn ghost sm', onclick: () => run(duplicate) }, '⧉ Duplicate'),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn ghost sm', onclick: newSession }, '＋ New session')),
    refinePanel,
    h('div', { class: 'grid two' }, editing ? editCard() : recipeCard(), chatCard()));

  /* ---------- left card ---------- */

  function photoArea() {
    if (session.photo) {
      const mine = session.photo.kind === 'cooked';
      return h('div', { class: 'photo has' },
        h('img', {
          src: `/images/${session.photo.id}`,
          alt: mine ? `Your photo of ${session.title}` : `AI-generated picture of what ${session.title} might look like`,
        }),
        h('div', { class: 'over' },
          h('span', { class: 'badge' }, mine ? '📷 My photo' : 'AI-generated · what it might look like'),
          h('span', { class: 'row' },
            mine ? null : aiButton('🎨 Try again'),
            h('button', { type: 'button', class: 'btn alt sm', onclick: cookedDialog }, 'Change photo'))));
    }
    return h('div', { class: 'photo' },
      h('span', { class: 'badge' }, 'AI-generated · what it might look like'),
      h('span', { class: 'row' }, aiButton('🎨 AI photo'), h('button', { type: 'button', class: 'btn sm', onclick: cookedDialog }, '📷 My photo')));
  }

  function aiButton(label) {
    const button = h('button', { type: 'button', class: 'btn alt sm' }, label);
    button.addEventListener('click', () => makeAiPhoto(button, label));
    return button;
  }

  function recipeCard() {
    const r = session.recipe;
    if (!r) return h('div', { class: 'card empty' }, h('h3', null, 'No recipe yet'), h('p', null, 'This session has no recipe.'));
    const saved = session.status !== 'draft';
    return h('div', { class: 'card' },
      photoArea(),
      h('h2', { class: 'recipe-title' }, session.title),
      h('div', { class: 'meta' },
        statusBadge(session.status),
        h('span', { class: 'badge' }, `⏱ ${r.time_minutes} min`),
        h('span', { class: 'badge' }, `🍽 Serves ${r.servings}`),
        r.tags.map((t) => h('span', { class: 'badge' }, t)),
        h('span', { class: 'badge' }, `📋 ${session.listName || 'Not in a list'}`),
        h('span', { class: 'badge' }, formatDate(session.createdAt))),
      r.detected_ingredients && r.detected_ingredients.length
        ? h('div', { class: 'note-box' }, h('strong', null, 'Chef Buddy spotted in your photo: '), r.detected_ingredients.join(', '),
          h('p', { class: 'small' }, 'Not right? Tell Chef Buddy in the chat and ask for a new recipe.')) : null,
      h('h3', null, "You'll need"),
      h('ul', { class: 'ing' }, r.ingredients.map((i) => h('li', null, i))),
      r.shopping_list.length ? [h('h3', null, 'To buy'), h('ul', { class: 'ing' }, r.shopping_list.map((i) => h('li', null, i)))] : null,
      h('h3', null, 'Method'),
      h('ol', { class: 'steps' }, r.steps.map((s) => h('li', null, s))),
      r.notes ? h('div', { class: 'note-box' }, r.notes) : null,
      h('p', { class: 'small' }, 'Check labels and allergens yourself. Chef Buddy can make mistakes.'),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn sm', onclick: cookedDialog }, '🎉 I cooked it!'),
        saved ? null : h('button', { type: 'button', class: 'btn alt sm', onclick: () => run(save) }, '💾 Save recipe'),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: listDialog }, `📋 ${session.listId ? 'Change list' : 'Add to list'}`),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { editing = true; repaint(session); } }, '✏️ Edit'),
        h('button', { type: 'button', class: 'btn danger sm', onclick: remove }, '🗑 Delete')));
  }

  function editCard() {
    const r = session.recipe;
    const title = h('input', { class: 'field', id: 'eTitle', value: session.title, maxlength: '120' });
    const listSelect = h('select', { class: 'field', id: 'eList' }, h('option', { value: '' }, 'Not in a list'));
    api('GET', '/lists').then(({ lists }) => {
      for (const l of lists) listSelect.append(h('option', { value: String(l.id), selected: l.id === session.listId }, l.name));
    }).catch(() => {});
    const ingredients = h('textarea', { class: 'editbox', id: 'eIng' });
    const steps = h('textarea', { class: 'editbox', id: 'eSteps' });
    ingredients.value = r.ingredients.join('\n');
    steps.value = r.steps.join('\n');
    return h('div', { class: 'card' },
      h('h2', null, 'Edit recipe'),
      h('label', { class: 'lbl', for: 'eTitle' }, 'Name'), title,
      h('label', { class: 'lbl', for: 'eList' }, 'List'), listSelect,
      h('label', { class: 'lbl', for: 'eIng' }, 'Ingredients (one per line)'), ingredients,
      h('label', { class: 'lbl', for: 'eSteps' }, 'Method (one step per line)'), steps,
      h('div', { class: 'row stack' },
        h('button', {
          type: 'button', class: 'btn sm',
          onclick: () => run(async () => {
            const updated = await api('PATCH', `/sessions/${session.id}`, {
              title: title.value, ingredients: lines(ingredients.value), steps: lines(steps.value),
              listId: listSelect.value ? Number(listSelect.value) : null,
            });
            editing = false; // only leave edit mode once the save worked
            repaint(updated);
            toast('Changes saved');
          }),
        }, 'Save changes'),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { editing = false; repaint(session); } }, 'Cancel')));
  }

  /* ---------- right card: chat ---------- */

  function chatCard() {
    const box = h('div', { class: 'chat', id: 'chatBox', role: 'log', 'aria-live': 'polite' },
      session.messages.map((m) => (m.role === 'note'
        ? h('div', { class: 'note' }, m.content)
        : h('div', { class: `msg ${m.role}` }, m.content))));
    const input = h('input', { class: 'field', placeholder: 'Ask a question…', autocomplete: 'off', 'aria-label': 'Ask Chef Buddy', maxlength: '2000' });
    const sendBtn = h('button', { class: 'btn' }, 'Send');
    const form = h('form', { class: 'sendrow' }, input, sendBtn);
    const scrollDown = () => { box.scrollTop = box.scrollHeight; };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || sendBtn.disabled) return;
      input.value = '';
      sendBtn.disabled = true;
      box.append(h('div', { class: 'msg user' }, text));
      // The reply is added piece by piece with textContent, so AI text can never become HTML.
      const bubble = h('div', { class: 'msg assistant' }, spinner());
      box.append(bubble);
      scrollDown();
      session.messages.push({ role: 'user', content: text });
      let reply = '';
      try {
        await streamPost(`/sessions/${session.id}/messages`, { content: text }, (name, data) => {
          if (name === 'delta') {
            reply += data.text;
            bubble.textContent = reply;
            scrollDown();
          } else if (name === 'error') {
            throw new ApiClientError(data.message, data.code, 0);
          }
        });
        session.messages.push({ role: 'assistant', content: reply });
      } catch (err) {
        if (!reply) bubble.remove();
        box.append(h('div', { class: 'note' }, err.message));
        scrollDown();
        toast(err.message, { error: true });
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    });
    queueMicrotask(scrollDown);
    return h('div', { class: 'card' }, h('h2', null, 'Ask Chef Buddy'), box, form);
  }

  function refineContent() {
    const picked = new Set();
    const chips = ['Spicier', 'Quicker', 'Fewer ingredients', 'Lighter', 'Kid-friendly', 'One-pan', 'Double the servings'].map((label) => {
      const chip = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false' }, label);
      chip.addEventListener('click', () => {
        const on = chip.getAttribute('aria-pressed') !== 'true';
        chip.setAttribute('aria-pressed', String(on));
        if (on) picked.add(label); else picked.delete(label);
      });
      return chip;
    });
    const text = h('textarea', { placeholder: 'Or say it in your own words, e.g. swap the chicken for chickpeas…', 'aria-label': 'Refine in your own words', maxlength: '2000' });
    const apply = h('button', { type: 'button', class: 'btn sm' }, 'Update recipe');
    apply.addEventListener('click', async () => {
      if (!picked.size && !text.value.trim()) { toast('Pick an option or say what to change first.'); return; }
      apply.disabled = true;
      setChildren(apply, spinner(), ' Updating…');
      try {
        const updated = await api('POST', `/sessions/${session.id}/refine`, { chips: [...picked], text: text.value.trim() }, { timeout: SLOW_TIMEOUT_MS });
        repaint(updated);
        toast('Recipe refined');
      } catch (err) {
        toast(err.message, { error: true });
        apply.disabled = false;
        setChildren(apply, 'Update recipe');
      }
    });
    return [
      h('h3', null, 'Refine this recipe'),
      h('div', { class: 'chips' }, chips),
      text,
      h('div', { class: 'row stack' }, apply,
        h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { refinePanel.hidden = true; } }, 'Cancel')),
    ];
  }

  /* ---------- actions ---------- */

  async function save() {
    repaint(await api('PATCH', `/sessions/${session.id}`, { status: 'saved' }));
    toast('Saved to My Recipes');
  }

  async function duplicate() {
    const copy = await api('POST', `/sessions/${session.id}/duplicate`);
    state.currentId = copy.id;
    editing = false;
    repaint(copy);
    toast('Duplicate created, ready to edit');
  }

  function newSession() {
    confirmBox({
      title: 'Start a new session?',
      message: session.status === 'draft'
        ? 'This recipe is not saved yet. It stays in History as “Not saved” so you can come back to it.'
        : 'This recipe is saved, so you can come back to it any time.',
      okLabel: 'Start new',
    }).then((ok) => {
      if (!ok) return;
      resetCook();
      state.currentId = null;
      state.backTo = 'home';
      show('home').then(() => toast('New session started'));
    });
  }

  async function remove() {
    const ok = await confirmBox({
      title: `Delete "${session.title}"?`,
      message: "This removes the recipe, its chat and its photos from My Recipes and History. You can't undo it.",
      okLabel: 'Delete recipe', danger: true,
    });
    if (!ok) return;
    await run(async () => {
      await api('DELETE', `/sessions/${session.id}`);
      state.currentId = null;
      toast('Recipe deleted');
      await show(state.backTo === 'home' ? 'history' : state.backTo);
    });
  }

  // The AI photo costs a little of the user's OpenAI credit, so it only ever runs on a button press,
  // and the first time we say so. One picture per press.
  async function makeAiPhoto(button, label) {
    if (!localGet(AI_HINT_KEY)) {
      const ok = await confirmBox({
        title: 'Make an AI photo?',
        message: 'This uses a little of your OpenAI credit. The picture shows what the dish might look like. It is not a photo of your cooking.',
        okLabel: 'Make the photo',
      });
      if (!ok) return;
      localSet(AI_HINT_KEY, '1');
    }
    button.disabled = true;
    setChildren(button, spinner(), ' Painting…');
    try {
      repaint(await api('POST', `/sessions/${session.id}/ai-photo`, undefined, { timeout: SLOW_TIMEOUT_MS }));
      toast('AI photo ready');
    } catch (err) {
      toast(err.message, { error: true });
      button.disabled = false;
      setChildren(button, label);
    }
  }

  // "I cooked it!" and "My photo" / "Change photo". The photo is shrunk in the browser first.
  function cookedDialog() {
    let picked = null; // a shrunk JPEG as a data URL
    const hasPhoto = Boolean(session.photo && session.photo.kind === 'cooked');
    const input = h('input', { type: 'file', class: 'field', accept: 'image/*', capture: 'environment', 'aria-label': 'Photo of your finished dish' });
    const preview = h('img', { class: 'preview', alt: 'Preview of your photo', hidden: true });
    const message = h('p', { class: 'small', 'aria-live': 'polite' });
    const finish = (photo, successText) => run(async () => {
      saveBtn.disabled = true;
      const updated = await api('POST', `/sessions/${session.id}/cooked`, photo ? { photo } : {});
      closeDialog();
      repaint(updated);
      toast(successText);
    }).finally(() => { saveBtn.disabled = false; });

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      message.textContent = 'Reading your photo…';
      try {
        picked = (await resizeImage(file)).dataUrl;
        preview.src = picked;
        preview.hidden = false;
        message.textContent = '';
      } catch (err) {
        picked = null;
        preview.hidden = true;
        message.textContent = err.message;
      }
    });
    const saveBtn = h('button', {
      type: 'button', class: 'btn sm',
      onclick: () => {
        if (!picked) { message.textContent = 'Pick or take a photo first, or choose “Save without photo”.'; return; }
        finish(picked, 'Saved with your photo');
      },
    }, 'Save');

    openDialog(hasPhoto ? '📷 Change photo' : '🎉 You cooked it!', [
      h('p', null, 'Add a photo of your finished dish. It saves this recipe to My Recipes as Cooked, with your photo.'),
      input, preview, message,
      h('div', { class: 'row' },
        saveBtn,
        hasPhoto ? null : h('button', { type: 'button', class: 'btn ghost sm', onclick: () => finish(null, 'Marked as cooked and saved') }, 'Save without photo'),
        h('button', { type: 'button', class: 'btn ghost sm', onclick: closeDialog }, 'Cancel')),
    ]);
  }

  async function listDialog() {
    let lists;
    try {
      lists = (await api('GET', '/lists')).lists;
    } catch (err) {
      toast(err.message, { error: true });
      return;
    }
    const assign = (listId) => run(async () => {
      closeDialog();
      repaint(await api('PATCH', `/sessions/${session.id}`, { listId }));
      toast(listId ? 'Added to list' : 'Removed from list');
    });
    const newName = h('input', { class: 'field', placeholder: 'Or make a new list…', maxlength: '40', 'aria-label': 'New list name' });
    const createForm = h('form', { class: 'inlineform' }, newName, h('button', { class: 'btn sm' }, 'Create'));
    createForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!newName.value.trim()) return;
      run(async () => assign((await api('POST', '/lists', { name: newName.value })).id));
    });
    openDialog('Which list?', [
      h('div', { class: 'chips' },
        lists.map((l) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(l.id === session.listId), onclick: () => assign(l.id) }, l.name)),
        h('button', { type: 'button', class: 'chip', 'aria-pressed': String(session.listId === null), onclick: () => assign(null) }, 'None')),
      createForm,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn ghost sm', onclick: closeDialog }, 'Cancel')),
    ]);
  }
}
