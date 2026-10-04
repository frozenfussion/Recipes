import Anthropic from '@anthropic-ai/sdk';

// Claude calls. A client is created per request from the key saved in Settings,
// so changing the key takes effect straight away and nothing is kept in memory.
// Routes receive this object (see ai/index.js) so tests can swap in a fake.
const newClient = (apiKey) => new Anthropic({ apiKey, maxRetries: 1 });

export function createAnthropicService() {
  return {
    // Every model the key can use. `vision` says whether it can read photos.
    async listModels(apiKey) {
      const models = [];
      for await (const model of newClient(apiKey).models.list({ limit: 1000 })) {
        models.push({
          id: model.id,
          display_name: model.display_name,
          created_at: model.created_at,
          vision: model.capabilities?.image_input?.supported === true,
        });
      }
      return models;
    },

    // The cheapest call that proves the key works.
    async checkKey(apiKey) {
      await newClient(apiKey).models.list({ limit: 1 });
    },
  };
}
