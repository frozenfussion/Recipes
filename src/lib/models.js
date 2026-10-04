import { ApiError, friendlyAiError } from './errors.js';
import { getSetting, setSetting } from './settings.js';

// Live model lists from the vendors, cached in the settings table for 24 hours.
// No model name is ever written into the code: the lists decide.
const DAY_MS = 24 * 60 * 60 * 1000;

const PROVIDERS = {
  claude: {
    label: 'Claude',
    keySetting: 'anthropic_api_key',
    cacheSetting: 'models_cache_claude',
    modelSetting: 'claude_model',
    service: 'anthropic',
    // The app reads fridge photos, so only models that accept images are useful.
    keep: (m) => m.vision === true,
    newestFirst: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
  },
  openai: {
    label: 'OpenAI',
    keySetting: 'openai_api_key',
    cacheSetting: 'models_cache_openai',
    modelSetting: 'image_model',
    service: 'openai',
    // OpenAI's list has no "makes images" flag, so go by the id prefix.
    keep: (m) => m.id.startsWith('gpt-image'),
    newestFirst: (a, b) => (b.created || 0) - (a.created || 0),
  },
};

export function providerConfig(provider) {
  return PROVIDERS[provider];
}

function readCache(db, cfg) {
  const raw = getSetting(db, cfg.cacheSetting);
  if (!raw) return null;
  try {
    const cache = JSON.parse(raw);
    return Array.isArray(cache.models) && cache.fetchedAt ? cache : null;
  } catch {
    return null;
  }
}

// Returns { models, fetchedAt }, newest first.
export async function loadModels(db, ai, provider, { refresh = false, now = Date.now() } = {}) {
  const cfg = PROVIDERS[provider];
  const apiKey = getSetting(db, cfg.keySetting);
  if (!apiKey) {
    throw new ApiError(400, 'no_key', `No ${cfg.label} API key yet. Add one in Settings.`);
  }

  const cache = readCache(db, cfg);
  const fresh = cache && now - Date.parse(cache.fetchedAt) < DAY_MS;
  if (fresh && !refresh) return cache;

  try {
    const models = (await ai[cfg.service].listModels(apiKey)).filter(cfg.keep).sort(cfg.newestFirst);
    const result = { models, fetchedAt: new Date(now).toISOString() };
    setSetting(db, cfg.cacheSetting, JSON.stringify(result));
    return result;
  } catch (err) {
    // A stale list is better than no list when the network is down, unless the user asked to refresh.
    if (cache && !refresh) return cache;
    throw friendlyAiError(err, cfg.label);
  }
}

// When nothing is saved yet: the newest model that can read photos, skipping the
// priciest tiers if there is anything else. The user can change it on Settings.
const PRICIEST_HINTS = ['opus', 'fable', 'mythos'];
export function suggestClaudeModel(models) {
  if (!models.length) return null;
  const everyday = models.filter((m) => !PRICIEST_HINTS.some((hint) => m.id.includes(hint)));
  const sonnets = everyday.filter((m) => m.id.includes('sonnet'));
  return (sonnets[0] || everyday[0] || models[0]).id;
}

// Image models: "flare" is the fast everyday one (docs/specs/04-ai-integration.md), else the newest.
const PREFERRED_IMAGE_HINT = 'flare';
export function suggestImageModel(models) {
  if (!models.length) return null;
  return (models.find((m) => m.id.includes(PREFERRED_IMAGE_HINT)) || models[0]).id;
}

// Which model a request should use: the saved one, or the suggestion if none is saved.
export async function resolveModel(db, ai, provider) {
  const cfg = PROVIDERS[provider];
  const saved = getSetting(db, cfg.modelSetting);
  if (saved) {
    try {
      const { models } = await loadModels(db, ai, provider);
      if (!models.some((m) => m.id === saved)) {
        throw new ApiError(400, 'model_gone', `The model "${saved}" is no longer available. Pick another one on the Settings page.`);
      }
    } catch (err) {
      // If the list cannot be loaded (offline), just try the saved model.
      if (err.code === 'model_gone') throw err;
    }
    return saved;
  }
  const { models } = await loadModels(db, ai, provider);
  const suggested = provider === 'claude' ? suggestClaudeModel(models) : suggestImageModel(models);
  if (!suggested) {
    throw new ApiError(400, 'no_model', `${cfg.label} has no usable model for this key. Check the Settings page.`);
  }
  return suggested;
}
