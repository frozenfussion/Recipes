import OpenAI from 'openai';
import { ApiError } from '../lib/errors.js';
import { IMAGE_TIMEOUT_MS, LIST_TIMEOUT_MS } from './timeouts.js';

// Landscape, which suits the photo area on the recipe card.
const IMAGE_SIZE = '1536x1024';

// OpenAI calls (dish photos only). Same pattern as anthropic.js.
// baseURL and listTimeoutMs exist so tests can point at a local pretend server.
export function createOpenAiService({ baseURL, listTimeoutMs = LIST_TIMEOUT_MS } = {}) {
  const newClient = (apiKey, options = {}) => new OpenAI({ apiKey, baseURL, maxRetries: 1, ...options });
  // Short calls get a short timeout and no retry: if it is going to fail, say so quickly.
  const quick = (apiKey) => newClient(apiKey, { timeout: listTimeoutMs, maxRetries: 0 });

  return {
    async listModels(apiKey) {
      const models = [];
      for await (const model of quick(apiKey).models.list()) {
        models.push({ id: model.id, created: model.created, shutdown_date: model.shutdown_date ?? null });
      }
      return models;
    },

    async checkKey(apiKey) {
      await quick(apiKey).models.list();
    },

    // One picture per call. GPT Image models return the picture as base64 (never a link), so
    // we decode it here and the caller stores it as our own file.
    async generateImage({ apiKey, model, quality, prompt }) {
      const result = await newClient(apiKey, { timeout: IMAGE_TIMEOUT_MS }).images.generate({
        model, prompt, size: IMAGE_SIZE, quality, n: 1,
      });
      const base64 = result.data && result.data[0] && result.data[0].b64_json;
      if (!base64) throw new ApiError(502, 'no_image', 'The image service did not send a picture back. Try again.');
      return { buffer: Buffer.from(base64, 'base64') };
    },
  };
}
