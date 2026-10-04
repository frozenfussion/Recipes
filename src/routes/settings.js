import { Router } from 'express';
import { ApiError, friendlyAiError, logAiFailure } from '../lib/errors.js';
import { maskKey } from '../lib/mask.js';
import {
  deleteSetting, getApiKey, getSetting, keysOnServer, noKeyMessage, setSetting,
} from '../lib/settings.js';
import { providerConfig } from '../lib/models.js';

const THEMES = ['light', 'dark', 'device'];
const QUALITIES = ['low', 'medium', 'high'];
const MODEL_ID = /^[A-Za-z0-9._:/-]{1,200}$/;

// On your own computer keys are plain text in the database on purpose (single user, see
// docs/specs/07-settings-security.md). On a server they come from a protected file instead and
// cannot be changed here. Either way the browser only ever sees a masked form.
function refuseOnServer(db) {
  if (keysOnServer(db)) {
    throw new ApiError(400, 'keys_on_server', 'API keys are set on the server, not on this page. The server admin changes them.');
  }
}

function readKey(value, label) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ApiError(400, 'bad_key_format', `The ${label} key must be text.`);
  const key = value.trim();
  if (key === '') return null; // an empty field means "leave it unchanged"
  if (key.length < 10 || key.length > 300 || /\s/.test(key)) {
    throw new ApiError(400, 'bad_key_format', `That does not look like a ${label} key. Copy it again from the vendor's website.`);
  }
  return key;
}

function publicSettings(db) {
  const anthropicKey = getApiKey(db, 'anthropic_api_key');
  const openaiKey = getApiKey(db, 'openai_api_key');
  return {
    keysOnServer: keysOnServer(db),
    claude: {
      hasKey: Boolean(anthropicKey),
      maskedKey: maskKey(anthropicKey),
      model: getSetting(db, 'claude_model'),
    },
    openai: {
      hasKey: Boolean(openaiKey),
      maskedKey: maskKey(openaiKey),
      model: getSetting(db, 'image_model'),
      quality: getSetting(db, 'image_quality') || 'low',
    },
    theme: getSetting(db, 'theme') || 'device',
  };
}

export function settingsRouter(db, ai, limiter) {
  const router = Router();

  router.get('/settings', (req, res) => res.json(publicSettings(db)));

  router.put('/settings', (req, res) => {
    const body = req.body || {};
    // Validate everything first so a bad field cannot leave a half-saved update.
    const anthropicKey = readKey(body.anthropicApiKey, 'Claude');
    const openaiKey = readKey(body.openaiApiKey, 'OpenAI');
    if (anthropicKey || openaiKey) refuseOnServer(db);
    for (const [field, label] of [['claudeModel', 'Claude model'], ['imageModel', 'image model']]) {
      if (body[field] !== undefined && !MODEL_ID.test(String(body[field]))) {
        throw new ApiError(400, 'bad_model', `The ${label} id has characters that are not allowed.`);
      }
    }
    if (body.imageQuality !== undefined && !QUALITIES.includes(body.imageQuality)) {
      throw new ApiError(400, 'bad_quality', 'Image quality must be low, medium or high.');
    }
    if (body.theme !== undefined && !THEMES.includes(body.theme)) {
      throw new ApiError(400, 'bad_theme', 'Theme must be light, dark or device.');
    }

    if (anthropicKey) setSetting(db, 'anthropic_api_key', anthropicKey);
    if (openaiKey) setSetting(db, 'openai_api_key', openaiKey);
    if (body.claudeModel !== undefined) setSetting(db, 'claude_model', body.claudeModel);
    if (body.imageModel !== undefined) setSetting(db, 'image_model', body.imageModel);
    if (body.imageQuality !== undefined) setSetting(db, 'image_quality', body.imageQuality);
    if (body.theme !== undefined) setSetting(db, 'theme', body.theme);
    // A new key means the old model list may no longer apply.
    if (anthropicKey) deleteSetting(db, 'models_cache_claude');
    if (openaiKey) deleteSetting(db, 'models_cache_openai');
    res.json(publicSettings(db));
  });

  // The separate "Remove key" button. Saving an empty field never erases a key.
  router.delete('/settings/key/:provider', (req, res) => {
    const names = { anthropic: ['anthropic_api_key', 'models_cache_claude'], openai: ['openai_api_key', 'models_cache_openai'] };
    const entry = names[req.params.provider];
    if (!entry) throw new ApiError(404, 'not_found', 'Unknown service.');
    refuseOnServer(db);
    for (const key of entry) deleteSetting(db, key);
    res.json(publicSettings(db));
  });

  // Checks a key works. Uses the key in the request if there is one (not saved), else the saved key.
  router.post('/settings/test/:provider', limiter, async (req, res, next) => {
    try {
      const service = { anthropic: 'claude', openai: 'openai' }[req.params.provider];
      if (!service) throw new ApiError(404, 'not_found', 'Unknown service.');
      const cfg = providerConfig(service);
      const posted = readKey((req.body || {}).apiKey, cfg.label);
      if (posted) refuseOnServer(db);
      const apiKey = posted || getApiKey(db, cfg.keySetting);
      if (!apiKey) throw new ApiError(400, 'no_key', noKeyMessage(db, cfg.label));
      try {
        await ai[cfg.service].checkKey(apiKey);
      } catch (err) {
        logAiFailure(cfg.label, 'key test', err);
        throw friendlyAiError(err, cfg.label);
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
