import OpenAI from 'openai';

// OpenAI calls (dish photos only). Same pattern as anthropic.js.
const newClient = (apiKey) => new OpenAI({ apiKey, maxRetries: 1 });

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
  };
}
