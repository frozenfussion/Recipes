import { ApiError } from './errors.js';

// The recipe JSON stored in sessions.recipe (docs/specs/03-data-model.md).
// Used for edits from the browser and for what Claude sends back. Both are untrusted.
const LIMITS = {
  title: 120,
  emoji: 16,
  tag: 40,
  ingredient: 200,
  step: 1000,
  shopping: 200,
  notes: 500,
  detected: 80,
};

const bad = (message) => new ApiError(400, 'bad_recipe', message);

function text(value, name, max, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw bad(`The recipe needs a ${name}.`);
    return '';
  }
  if (typeof value !== 'string') throw bad(`The recipe ${name} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw bad(`The recipe needs a ${name}.`);
  if (trimmed.length > max) throw bad(`The recipe ${name} is too long (the limit is ${max} characters).`);
  return trimmed;
}

function list(value, name, { max, itemMax, min = 0 }) {
  if (value === undefined || value === null) value = [];
  if (!Array.isArray(value)) throw bad(`The recipe ${name} must be a list.`);
  const items = value.map((item) => {
    if (typeof item !== 'string') throw bad(`Every item in the recipe ${name} must be text.`);
    return item.trim();
  }).filter(Boolean);
  if (items.length < min) throw bad(`The recipe needs at least ${min} item in ${name}.`);
  if (items.length > max) throw bad(`The recipe ${name} has too many items (the limit is ${max}).`);
  for (const item of items) {
    if (item.length > itemMax) throw bad(`An item in the recipe ${name} is too long (the limit is ${itemMax} characters).`);
  }
  return items;
}

function whole(value, name, min, max, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw bad(`The recipe ${name} must be a number.`);
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Returns a clean recipe object, or throws ApiError(400, 'bad_recipe', ...).
export function validateRecipe(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad('The recipe is missing.');
  const recipe = {
    title: text(input.title, 'title', LIMITS.title, { required: true }),
    emoji: text(input.emoji, 'emoji', LIMITS.emoji) || '🍽️',
    time_minutes: whole(input.time_minutes, 'time', 1, 1440, 30),
    servings: whole(input.servings, 'servings', 1, 100, 2),
    tags: list(input.tags, 'tags', { max: 12, itemMax: LIMITS.tag }),
    ingredients: list(input.ingredients, 'ingredients', { max: 60, itemMax: LIMITS.ingredient, min: 1 }),
    steps: list(input.steps, 'method', { max: 60, itemMax: LIMITS.step, min: 1 }),
    shopping_list: list(input.shopping_list, 'shopping list', { max: 60, itemMax: LIMITS.shopping }),
    notes: text(input.notes, 'notes', LIMITS.notes),
  };
  // Only present when Claude read a fridge photo: what it thinks it saw.
  const detected = list(input.detected_ingredients, 'detected ingredients', { max: 40, itemMax: LIMITS.detected });
  if (detected.length) recipe.detected_ingredients = detected;
  return recipe;
}
