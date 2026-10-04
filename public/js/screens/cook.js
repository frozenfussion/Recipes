import { api } from '../api.js';
import { toggleChip } from '../components/chips.js';
import { toast } from '../components/toast.js';
import { errorBox, h, setChildren, spinner } from '../dom.js';
import { resizeImage } from '../image.js';
import { show } from '../router.js';
import { state } from '../state.js';

const DIETS = ['Halal', 'Kosher', 'Vegetarian', 'Vegan', 'Pescatarian', 'Meat-heavy', 'Keto', 'Low-carb', 'Paleo', 'Mediterranean', 'High-protein', 'Low-fat'];
const ALLERGIES = ['Gluten-free', 'Nut-free', 'Peanut-free', 'Dairy-free', 'Egg-free', 'Shellfish-free', 'Soy-free', 'Sesame-free', 'Lactose-free'];
const OPTIONS = ['Low-sodium', 'Low-sugar', 'Diabetic-friendly'];
const CUISINES = ['Italian', 'Indian', 'Middle Eastern', 'Mexican', 'Chinese', 'Japanese', 'Thai', 'Mediterranean', 'French', 'American'];
const SERVINGS = ['1', '2', '4', '6', '8'];
const TIMES = ['15 minutes', '30 minutes', '60 minutes', '90 minutes'];
const SPICES = ['Mild', 'Medium', 'Hot'];

// The diet and allergy choices are remembered between visits so nobody has to retype them.
const PREFS_KEY = 'cb-prefs';

function loadPrefs() {
  const fallback = { diets: [], allergies: [], options: [], cuisine: '', servings: '2', time: '', spice: '' };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    return saved && typeof saved === 'object' ? { ...fallback, ...saved } : fallback;
  } catch {
    return fallback;
  }
}

function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage blocked: fine */ }
}

export function renderCook(root) {
  const prefs = loadPrefs();
  const cook = state.cook;
  const changed = () => savePrefs(prefs);

  const group = (items, key) => h('div', { class: 'chips' }, items.map((label) =>
    toggleChip(label, prefs[key].includes(label), (on) => {
      prefs[key] = on ? [...prefs[key], label] : prefs[key].filter((x) => x !== label);
      changed();
    })));

  const select = (key, anyLabel, values, format = (v) => v) => {
    const el = h('select', { class: 'field', 'aria-label': anyLabel },
      h('option', { value: '' }, anyLabel),
      values.map((v) => h('option', { value: v, selected: prefs[key] === v }, format(v))));
    el.addEventListener('change', () => { prefs[key] = el.value; changed(); });
    return el;
  };

  /* ---------- card 1: diet ---------- */
  const dietCard = h('div', { class: 'card' },
    h('h2', null, '1 · Pick your diet'),
    h('div', { class: 'group-title' }, 'Diets & lifestyle'),
    group(DIETS, 'diets'),
    h('details', { class: 'more', open: true },
      h('summary', null, 'Allergies & intolerances'),
      group(ALLERGIES, 'allergies')),
    h('details', { class: 'more' },
      h('summary', null, 'More options'),
      group(OPTIONS, 'options'),
      h('div', { class: 'row' },
        select('cuisine', 'Any cuisine', CUISINES),
        select('servings', 'Servings: any', SERVINGS, (v) => `Servings: ${v}`),
        select('time', 'Time: any', TIMES, (v) => `Time: ${v}`),
        select('spice', 'Spice: any', SPICES))));

  /* ---------- card 2: ingredients ---------- */
  const chips = h('div', { class: 'chips' });
  const paintChips = () => setChildren(chips, cook.ingredients.map((name, index) => {
    const chip = h('button', { type: 'button', class: 'chip rm', 'aria-label': `Remove ${name}` }, `${name} ✕`);
    chip.addEventListener('click', () => { cook.ingredients.splice(index, 1); paintChips(); });
    return chip;
  }));
  const addIngredient = () => {
    const value = ingredientInput.value.trim();
    if (value && cook.ingredients.length < 60 && !cook.ingredients.includes(value)) cook.ingredients.push(value);
    ingredientInput.value = '';
    paintChips();
  };
  const ingredientInput = h('input', { class: 'field', id: 'ing', placeholder: 'Type an ingredient and press Enter…', maxlength: '80', autocomplete: 'off' });
  ingredientInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addIngredient(); }
  });

  /* photos: shrunk in the browser first (see image.js) */
  const MAX_PHOTOS = 4;
  const thumbs = h('div', { class: 'thumbs' });
  const paintThumbs = () => setChildren(thumbs, cook.photos.map((photo, index) => {
    const remove = h('button', { type: 'button', 'aria-label': `Remove photo ${index + 1}` }, '✕');
    remove.addEventListener('click', () => { cook.photos.splice(index, 1); paintThumbs(); });
    return h('div', { class: 't' }, h('img', { src: photo.dataUrl, alt: `Photo ${index + 1} of your fridge` }), remove);
  }));
  const fileInput = h('input', {
    type: 'file', id: 'photoIn', class: 'visually-hidden', accept: 'image/*', capture: 'environment', multiple: true, 'aria-label': 'Choose photos of your fridge',
  });
  const photoNote = h('span', { class: 'small', 'aria-live': 'polite' }, 'Chef Buddy will spot the ingredients for you');
  fileInput.addEventListener('change', async () => {
    const files = [...fileInput.files];
    fileInput.value = ''; // so choosing the same photo again still triggers a change
    const room = MAX_PHOTOS - cook.photos.length;
    if (files.length > room) toast(`You can add up to ${MAX_PHOTOS} photos. I kept the first ${Math.max(room, 0)}.`);
    photoNote.textContent = 'Reading your photos…';
    for (const file of files.slice(0, Math.max(room, 0))) {
      try {
        cook.photos.push(await resizeImage(file));
      } catch (err) {
        toast(err.message, { error: true });
      }
    }
    photoNote.textContent = 'Chef Buddy will spot the ingredients for you';
    paintThumbs();
  });
  const drop = h('div', { class: 'drop' },
    '📷 ', h('b', null, 'Snap or upload a photo'), h('br'), photoNote, h('br'),
    h('button', { type: 'button', class: 'btn alt sm', onclick: () => fileInput.click() }, 'Choose photos'),
    fileInput, thumbs);

  const want = h('textarea', { id: 'want', placeholder: 'e.g. I want to make chicken biryani. What do I need to buy?', maxlength: '2000' });
  want.value = cook.want;
  want.addEventListener('input', () => { cook.want = want.value; });

  const status = h('div', { 'aria-live': 'polite' });
  const cookBtn = h('button', { type: 'button', class: 'btn big' }, '🍳 Cook something up!');

  cookBtn.addEventListener('click', async () => {
    addIngredient(); // an ingredient typed but not yet confirmed with Enter still counts
    const text = want.value.trim();
    if (!cook.ingredients.length && !text && !cook.photos.length) {
      toast('Add an ingredient, a photo, or tell me what you fancy, first.');
      ingredientInput.focus();
      return;
    }
    setChildren(status);
    cookBtn.disabled = true;
    setChildren(cookBtn, spinner(), ' Chef Buddy is cooking…');
    try {
      const session = await api('POST', '/sessions', {
        prefs, ingredients: cook.ingredients, want: text, photos: cook.photos.map((p) => p.dataUrl),
      });
      state.currentId = session.id;
      state.backTo = 'home';
      await show('recipe');
    } catch (err) {
      setChildren(status, errorBox(err.message));
      toast(err.message, { error: true });
    } finally {
      cookBtn.disabled = false;
      setChildren(cookBtn, '🍳 Cook something up!');
    }
  });

  const haveCard = h('div', { class: 'card' },
    h('h2', null, '2 · What have you got?'),
    h('label', { class: 'lbl', for: 'ing' }, 'Ingredients in the fridge'),
    chips,
    h('div', { class: 'stack' }, ingredientInput),
    h('div', { class: 'stack' }, drop),
    h('label', { class: 'lbl', for: 'want' }, '…or tell me what you fancy'),
    want,
    h('div', { class: 'stack' }, cookBtn),
    status);

  setChildren(root, h('div', { class: 'grid two' }, dietCard, haveCard));
  paintChips();
  paintThumbs();
}
