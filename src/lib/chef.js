import { buildSystemPrompt } from '../ai/prompts.js';
import { ApiError, friendlyAiError, logAiFailure } from './errors.js';
import { validateRecipe } from './recipe.js';
import { getApiKey, noKeyMessage } from './settings.js';
import { resolveModel } from './models.js';

// The glue between our routes and Claude: reading the user's input safely, picking the key and
// model, asking for a recipe (with one retry) and shaping the chat history.
const MAX_TEXT = 2000;
const clean = (value) => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();

function textField(value, name, max = MAX_TEXT) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw new ApiError(400, 'bad_input', `${name} must be text.`);
  const text = clean(value);
  if (text.length > max) throw new ApiError(400, 'too_long', `${name} is too long (the limit is ${max} characters).`);
  return text;
}

function listField(value, name, { maxItems, maxLength }) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError(400, 'bad_input', `${name} must be a list.`);
  if (value.length > maxItems) throw new ApiError(400, 'too_long', `Too many items in ${name} (the limit is ${maxItems}).`);
  return value.map((item) => {
    if (typeof item !== 'string') throw new ApiError(400, 'bad_input', `Every item in ${name} must be text.`);
    const text = clean(item);
    if (text.length > maxLength) throw new ApiError(400, 'too_long', `An item in ${name} is too long.`);
    return text;
  }).filter(Boolean);
}

// What the Cook screen sends. Everything is untrusted, so check types and sizes.
export function parseCookInput(body = {}) {
  const p = body.prefs || {};
  if (typeof p !== 'object' || Array.isArray(p)) throw new ApiError(400, 'bad_input', 'Your diet choices could not be read.');
  const prefs = {
    diets: listField(p.diets, 'diets', { maxItems: 20, maxLength: 40 }),
    allergies: listField(p.allergies, 'allergies', { maxItems: 20, maxLength: 40 }),
    options: listField(p.options, 'options', { maxItems: 20, maxLength: 40 }),
    cuisine: textField(p.cuisine, 'Cuisine', 40),
    servings: textField(p.servings, 'Servings', 40),
    time: textField(p.time, 'Time', 40),
    spice: textField(p.spice, 'Spice level', 40),
  };
  return {
    prefs,
    ingredients: listField(body.ingredients, 'ingredients', { maxItems: 60, maxLength: 80 }),
    want: textField(body.want, 'Your request'),
    photos: body.photos === undefined ? [] : body.photos,
  };
}

export function parseChatMessage(body = {}) {
  const content = textField(body.content, 'Your message');
  if (!content) throw new ApiError(400, 'empty_message', 'Type a message first.');
  return content;
}

export function parseRefine(body = {}) {
  const chips = listField(body.chips, 'refine options', { maxItems: 10, maxLength: 40 });
  const text = textField(body.text, 'Your change request');
  if (!chips.length && !text) throw new ApiError(400, 'nothing_to_refine', 'Pick a refine option or say what you would like changed.');
  return { chips, text };
}

// Key and model for a Claude request, with beginner-friendly errors.
export async function claudeSettings(db, ai) {
  const apiKey = getApiKey(db, 'anthropic_api_key');
  if (!apiKey) throw new ApiError(400, 'no_key', noKeyMessage(db, 'Claude'));
  const model = await resolveModel(db, ai, 'claude');
  return { apiKey, model };
}

// Asks Claude for a recipe and checks it. If the answer is not a valid recipe, asks once more,
// telling Claude what was wrong. Returns { recipe, text }.
export async function generateValidRecipe(ai, { apiKey, model, prefs, messages, recipe = null }) {
  let problem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    let system = buildSystemPrompt({ prefs, forRecipe: true, recipe });
    if (problem) system += `\n\nYour previous answer could not be used (${problem}). Call submit_recipe now with a complete, valid recipe.`;
    let result;
    try {
      result = await ai.anthropic.generateRecipe({ apiKey, model, system, messages });
    } catch (err) {
      logAiFailure('Claude', 'recipe request', err);
      throw friendlyAiError(err, 'Claude');
    }
    if (!result.recipe) {
      problem = 'you did not call submit_recipe';
      continue;
    }
    try {
      return { recipe: validateRecipe(result.recipe), text: result.text || '' };
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      problem = err.message;
    }
  }
  throw new ApiError(502, 'bad_ai_recipe', 'Chef Buddy could not write a proper recipe this time. Please try again.');
}

// The last 30 chat messages as Claude expects them: only user and assistant turns, starting with a user turn.
export function chatHistory(messages, limit = 30) {
  const turns = messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-limit);
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns.map((m) => ({ role: m.role, content: m.content }));
}

// A short readable version of the request, saved as the first chat message.
export function requestSummary({ ingredients, want, photoCount }) {
  const parts = [];
  if (ingredients.length) parts.push(`I have: ${ingredients.join(', ')}.`);
  if (photoCount) parts.push(`(${photoCount} photo${photoCount === 1 ? '' : 's'} attached)`);
  if (want) parts.push(want);
  return parts.join(' ');
}
