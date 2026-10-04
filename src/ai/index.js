import { createAnthropicService } from './anthropic.js';
import { createOpenAiService } from './openai.js';

// The real AI services. Tests pass small fakes instead, so they never spend money or need keys.
export function createAi() {
  return { anthropic: createAnthropicService(), openai: createOpenAiService() };
}
