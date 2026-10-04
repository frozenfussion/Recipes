import Anthropic from '@anthropic-ai/sdk';
import { ApiError } from '../lib/errors.js';
import { SUBMIT_RECIPE_TOOL } from './prompts.js';

// Claude calls. A client is created per request from the key saved in Settings,
// so changing the key takes effect straight away and nothing is kept in memory.
// Routes receive this object (see ai/index.js) so tests can swap in a fake.
const newClient = (apiKey) => new Anthropic({ apiKey, maxRetries: 1 });

// Claude can decline (stop_reason "refusal") without any error being raised.
function checkStopReason(message) {
  if (message.stop_reason === 'refusal') {
    throw new ApiError(422, 'refused', 'Claude would not help with that one. Try asking in a different way.');
  }
}

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

    // Asks for a recipe. Returns { recipe, text }: recipe is the raw tool input (validated by the
    // caller) or null if Claude did not call the tool, text is any sentence it said alongside.
    // tool_choice is "auto" with an instruction in the prompt: the newest models reject a forced
    // tool_choice, so we ask nicely and check (and retry once) instead.
    async generateRecipe({ apiKey, model, system, messages }) {
      const message = await newClient(apiKey).messages.create({
        model,
        max_tokens: 16000,
        system,
        messages,
        tools: [SUBMIT_RECIPE_TOOL],
        tool_choice: { type: 'auto' },
      });
      checkStopReason(message);
      const toolUse = message.content.find((b) => b.type === 'tool_use' && b.name === SUBMIT_RECIPE_TOOL.name);
      const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return { recipe: toolUse ? toolUse.input : null, text };
    },

    // Streams a chat answer. onText gets each piece as it arrives. Returns the full text.
    // signal lets the caller stop paying for a reply nobody is waiting for any more.
    async streamChat({ apiKey, model, system, messages, onText, signal }) {
      const stream = newClient(apiKey).messages.stream({ model, max_tokens: 8000, system, messages });
      if (signal) signal.addEventListener('abort', () => stream.abort(), { once: true });
      stream.on('text', (delta) => onText(delta));
      const message = await stream.finalMessage();
      checkStopReason(message);
      return message.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    },
  };
}
