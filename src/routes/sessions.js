import { Router } from 'express';
import { buildImagePrompt, buildRecipeContent, buildRefineRequest, buildSystemPrompt } from '../ai/prompts.js';
import { transaction } from '../db.js';
import {
  chatHistory, claudeSettings, generateValidRecipe, parseChatMessage, parseCookInput, parseRefine, requestSummary,
} from '../lib/chef.js';
import { ApiError, friendlyAiError } from '../lib/errors.js';
import { decodeImage, decodePhotos, deleteImageFiles, detectImageType, saveImage } from '../lib/images.js';
import { resolveModel } from '../lib/models.js';
import { getSetting } from '../lib/settings.js';
import {
  addMessage, createSession, deleteSession, duplicateSession, getSession, listSessions, setRecipe, updateSession,
} from '../lib/sessions.js';
import { parseId } from './lists.js';

const GREETING = "Here's a recipe for you! Shout if you hit a snag. 👨‍🍳";

// Sessions: History and My Recipes (list), open, edit, duplicate, delete, plus the Claude routes:
// create a session (first recipe), chat (streamed), refine.
export function sessionsRouter(db, { ai, imagesDir, limiters }) {
  const router = Router();

  router.get('/sessions', (req, res) => {
    const { status, list, q } = req.query;
    res.json({ sessions: listSessions(db, { status, list, q: typeof q === 'string' ? q.trim() : undefined }) });
  });

  // Start a session: asks Claude for the first recipe from diet choices, ingredients, free text
  // and up to four fridge photos. The photos are checked, sent to Claude once, and kept as our own copy.
  router.post('/sessions', limiters.ai, async (req, res) => {
    const input = parseCookInput(req.body);
    const photos = decodePhotos(input.photos);
    if (!input.ingredients.length && !input.want && !photos.length) {
      throw new ApiError(400, 'nothing_to_cook', 'Add an ingredient, a photo, or tell me what you fancy, first.');
    }
    const { apiKey, model } = await claudeSettings(db, ai);
    const messages = [{ role: 'user', content: buildRecipeContent({ ingredients: input.ingredients, want: input.want, photos }) }];
    const { recipe, text } = await generateValidRecipe(ai, { apiKey, model, prefs: input.prefs, messages });
    const id = createSession(db, {
      prefs: input.prefs,
      recipe,
      messages: [
        { role: 'user', content: requestSummary({ ingredients: input.ingredients, want: input.want, photoCount: photos.length }) },
        { role: 'assistant', content: text || GREETING },
      ],
    });
    for (const photo of photos) saveImage(db, imagesDir, id, 'fridge', photo.buffer, photo.mime);
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

  // "I cooked it!": mark the session Cooked (which also saves it) and keep the user's own photo, if any.
  // The photo is checked first, so a bad photo changes nothing. A new photo replaces the old one.
  router.post('/sessions/:id/cooked', async (req, res) => {
    const id = parseId(req.params.id);
    getSession(db, id);
    const photo = (req.body || {}).photo;
    const decoded = photo === undefined || photo === null ? null : decodeImage(photo);
    let replaced = [];
    if (decoded) {
      replaced = db.prepare("SELECT id, file FROM images WHERE session_id = ? AND kind = 'cooked'").all(id);
      saveImage(db, imagesDir, id, 'cooked', decoded.buffer, decoded.mime);
      for (const old of replaced) db.prepare('DELETE FROM images WHERE id = ?').run(old.id);
    }
    const session = updateSession(db, id, { status: 'cooked' });
    await deleteImageFiles(imagesDir, replaced.map((r) => r.file));
    res.json(session);
  });

  // The AI dish photo. Only ever runs because the user pressed the button (it costs money):
  // one picture per press, at the quality chosen in Settings (low unless changed).
  router.post('/sessions/:id/ai-photo', limiters.ai, limiters.image, async (req, res) => {
    const id = parseId(req.params.id);
    const session = getSession(db, id);
    if (!session.recipe) throw new ApiError(400, 'no_recipe', 'This session has no recipe to make a picture of yet.');
    const apiKey = getSetting(db, 'openai_api_key');
    if (!apiKey) throw new ApiError(400, 'no_key', 'No OpenAI API key yet. Add one in Settings.');
    const model = await resolveModel(db, ai, 'openai');
    const quality = getSetting(db, 'image_quality') || 'low';

    let image;
    try {
      image = await ai.openai.generateImage({ apiKey, model, quality, prompt: buildImagePrompt(session.recipe) });
    } catch (err) {
      throw friendlyAiError(err, 'OpenAI');
    }
    const mime = detectImageType(image.buffer);
    if (!mime) throw new ApiError(502, 'no_image', 'The image service sent something that is not a picture. Try again.');

    const older = db.prepare("SELECT id, file FROM images WHERE session_id = ? AND kind = 'ai'").all(id);
    saveImage(db, imagesDir, id, 'ai', image.buffer, mime);
    for (const old of older) db.prepare('DELETE FROM images WHERE id = ?').run(old.id); // keep only the newest
    await deleteImageFiles(imagesDir, older.map((o) => o.file));
    res.json(getSession(db, id));
  });

  router.post('/sessions/:id/duplicate', (req, res) => {
    const id = duplicateSession(db, parseId(req.params.id));
    res.status(201).json(getSession(db, id));
  });

  // Chat. The reply streams back as Server-Sent Events: "delta" (a piece of text), then "done",
  // or "error" with a friendly message. Problems we can spot up front (no key, retired model)
  // are normal JSON errors, sent before the stream starts.
  router.post('/sessions/:id/messages', limiters.ai, async (req, res) => {
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
  router.post('/sessions/:id/refine', limiters.ai, async (req, res) => {
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
