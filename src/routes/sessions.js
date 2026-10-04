import { Router } from 'express';
import { buildRefineRequest, buildRecipeRequest, buildSystemPrompt } from '../ai/prompts.js';
import { transaction } from '../db.js';
import {
  chatHistory, claudeSettings, generateValidRecipe, parseChatMessage, parseCookInput, parseRefine, requestSummary,
} from '../lib/chef.js';
import { ApiError, friendlyAiError } from '../lib/errors.js';
import {
  addMessage, createSession, deleteSession, duplicateSession, getSession, listSessions, setRecipe, updateSession,
} from '../lib/sessions.js';
import { parseId } from './lists.js';

const GREETING = "Here's a recipe for you! Shout if you hit a snag. 👨‍🍳";

// Sessions: History and My Recipes (list), open, edit, duplicate, delete, plus the Claude routes:
// create a session (first recipe), chat (streamed), refine.
export function sessionsRouter(db, { ai, imagesDir }) {
  const router = Router();

  router.get('/sessions', (req, res) => {
    const { status, list, q } = req.query;
    res.json({ sessions: listSessions(db, { status, list, q: typeof q === 'string' ? q.trim() : undefined }) });
  });

  // Start a session: asks Claude for the first recipe from diet choices, ingredients and free text.
  router.post('/sessions', async (req, res) => {
    const input = parseCookInput(req.body);
    if (!input.ingredients.length && !input.want) {
      throw new ApiError(400, 'nothing_to_cook', 'Add an ingredient, or tell me what you fancy, first.');
    }
    const { apiKey, model } = await claudeSettings(db, ai);
    const messages = [{ role: 'user', content: buildRecipeRequest({ ingredients: input.ingredients, want: input.want }) }];
    const { recipe, text } = await generateValidRecipe(ai, { apiKey, model, prefs: input.prefs, messages });
    const id = createSession(db, {
      prefs: input.prefs,
      recipe,
      messages: [
        { role: 'user', content: requestSummary({ ingredients: input.ingredients, want: input.want, photoCount: 0 }) },
        { role: 'assistant', content: text || GREETING },
      ],
    });
    res.status(201).json(getSession(db, id));
  });

  router.get('/sessions/:id', (req, res) => res.json(getSession(db, parseId(req.params.id))));

  router.patch('/sessions/:id', (req, res) => {
    const patch = {};
    const body = req.body || {};
    for (const field of ['title', 'ingredients', 'steps', 'notes', 'listId', 'status']) {
      if (body[field] !== undefined) patch[field] = body[field];
    }
    res.json(updateSession(db, parseId(req.params.id), patch));
  });

  router.delete('/sessions/:id', async (req, res) => {
    await deleteSession(db, imagesDir, parseId(req.params.id));
    res.json({ ok: true });
  });

  router.post('/sessions/:id/duplicate', (req, res) => {
    const id = duplicateSession(db, parseId(req.params.id));
    res.status(201).json(getSession(db, id));
  });

  // Chat. The reply streams back as Server-Sent Events: "delta" (a piece of text), then "done",
  // or "error" with a friendly message. Problems we can spot up front (no key, retired model)
  // are normal JSON errors, sent before the stream starts.
  router.post('/sessions/:id/messages', async (req, res) => {
    const id = parseId(req.params.id);
    const content = parseChatMessage(req.body);
    const session = getSession(db, id);
    const { apiKey, model } = await claudeSettings(db, ai);

    addMessage(db, id, 'user', content); // the user's message is saved first
    const history = chatHistory(getSession(db, id).messages);
    const system = buildSystemPrompt({ prefs: session.prefs, recipe: session.recipe });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    // If the browser goes away mid-answer, stop the request so nobody pays for text no one reads.
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableFinished) controller.abort(); });

    try {
      const full = await ai.anthropic.streamChat({
        apiKey, model, system, messages: history, signal: controller.signal,
        onText: (text) => send('delta', { text }),
      });
      const reply = full || 'Hmm, I had nothing to add. Could you ask that another way?';
      const messageId = addMessage(db, id, 'assistant', reply); // the full reply is saved when the stream ends
      send('done', { message: { id: messageId, role: 'assistant', content: reply } });
    } catch (err) {
      if (!controller.signal.aborted) {
        const friendly = err instanceof ApiError ? err : friendlyAiError(err, 'Claude');
        send('error', { code: friendly.code, message: friendly.message });
      }
    } finally {
      res.end();
    }
  });

  // Refine: change the recipe in place (chips and/or free text). The chat gets the request and a reply.
  router.post('/sessions/:id/refine', async (req, res) => {
    const id = parseId(req.params.id);
    const request = parseRefine(req.body);
    const session = getSession(db, id);
    if (!session.recipe) throw new ApiError(400, 'no_recipe', 'This session has no recipe to refine yet.');
    const { apiKey, model } = await claudeSettings(db, ai);

    const messages = [{ role: 'user', content: buildRefineRequest(session.recipe, request) }];
    const { recipe, text } = await generateValidRecipe(ai, { apiKey, model, prefs: session.prefs, messages });
    // What Claude saw in the fridge photos is still true after a tweak.
    if (session.recipe.detected_ingredients && !recipe.detected_ingredients) {
      recipe.detected_ingredients = session.recipe.detected_ingredients;
    }
    transaction(db, () => {
      setRecipe(db, id, recipe);
      addMessage(db, id, 'user', `Refine: ${[...request.chips, ...(request.text ? [request.text] : [])].join(', ')}`);
      addMessage(db, id, 'assistant', text || 'Done! I have updated the recipe.');
    });
    res.json(getSession(db, id));
  });

  return router;
}
