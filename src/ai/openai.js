import OpenAI from 'openai';
import { ApiError } from '../lib/errors.js';

// OpenAI calls (dish photos only). Same pattern as anthropic.js.
const newClient = (apiKey) => new OpenAI({ apiKey, maxRetries: 1 });

// Landscape, which suits the photo area on the recipe card.
const IMAGE_SIZE = '1536x1024';

export function createOpenAiService() {
  return {
    async listModels(apiKey) {
      const models = [];
      for await (const model of newClient(apiKey).models.list()) {
        models.push({ id: model.id, created: model.created, shutdown_date: model.shutdown_date ?? null });
      }
      return models;
    },

    async checkKey(apiKey) {
      await newClient(apiKey).models.list();
    },

    // One picture per call. GPT Image models return the picture as base64 (never a link), so
    // we decode it here and the caller stores it as our own file.
    async generateImage({ apiKey, model, quality, prompt }) {
      const result = await newClient(apiKey).images.generate({ model, prompt, size: IMAGE_SIZE, quality, n: 1 });
      const base64 = result.data && result.data[0] && result.data[0].b64_json;
      if (!base64) throw new ApiError(502, 'no_image', 'The image service did not send a picture back. Try again.');
      return { buffer: Buffer.from(base64, 'base64') };
    },
  };
}
