import { Router } from 'express';
import { getSetting } from '../lib/settings.js';
import { loadModels, providerConfig, suggestClaudeModel, suggestImageModel } from '../lib/models.js';

// GET /api/models/claude and /api/models/openai (add ?refresh=1 to skip the 24h cache)
export function modelsRouter(db, ai) {
  const router = Router();

  router.get('/models/claude', async (req, res, next) => {
    try {
      const { models, fetchedAt } = await loadModels(db, ai, 'claude', { refresh: req.query.refresh === '1' });
      const saved = getSetting(db, providerConfig('claude').modelSetting);
      res.json({
        models: models.map((m) => ({ id: m.id, label: m.display_name || m.id })),
        fetchedAt,
        saved,
        savedMissing: Boolean(saved) && !models.some((m) => m.id === saved),
        suggested: suggestClaudeModel(models),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/models/openai', async (req, res, next) => {
    try {
      const { models, fetchedAt } = await loadModels(db, ai, 'openai', { refresh: req.query.refresh === '1' });
      const saved = getSetting(db, providerConfig('openai').modelSetting);
      res.json({
        models: models.map((m) => ({ id: m.id, label: m.id, shutdownDate: m.shutdown_date })),
        fetchedAt,
        saved,
        savedMissing: Boolean(saved) && !models.some((m) => m.id === saved),
        suggested: suggestImageModel(models),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
