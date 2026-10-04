# 04 · AI integration

Verified against the vendors' docs on 2026-10-04. APIs change: **re-check the current docs before coding** (platform.claude.com/docs, developers.openai.com).

## Claude (Anthropic)

### Auth and client
Official `@anthropic-ai/sdk`, created per request from the key saved in Settings. REST equivalents send headers `x-api-key` and `anthropic-version: 2023-06-01`.

### Live model list
- `GET /v1/models` (SDK: `client.models.list()`). Newest first. Page with `limit` (up to 1000) and `after_id`.
- Each item has `id`, `display_name`, `created_at`, `max_input_tokens`, `max_tokens`, and `capabilities`, including `capabilities.image_input.supported`.
- The app needs vision for fridge photos, so show only models where `image_input.supported` is true. If a model lacks it, hide it.
- Dropdown label = `display_name`; value = `id`. Never hard-code an id.
- Cache the list in `settings` for 24 hours. The Settings page has a **Refresh** button and refreshes when opened if the cache is older than a day. A free-text "enter model id" field is the escape hatch.
- If the saved model is not in the fresh list, show a warning on Settings ("This model is no longer available. Pick another.") and fail requests with a friendly message, not a stack trace.
- First run with no saved model: preselect the newest model that supports images and is not obviously the most expensive tier. Let the user change it. Say in the UI which one was auto-picked.

### Recipe generation (structured output)
Use **tool use** to get reliable JSON: define a tool `submit_recipe` whose `input_schema` matches the recipe JSON in `03-data-model.md`, and force it with `tool_choice: { "type": "tool", "name": "submit_recipe" }`. Validate the result on the server (types, array lengths, string lengths) before saving. If validation fails, retry once, then show a friendly error.

The user message contains: diets, allergies, cuisine, servings, time, spice, typed ingredients, free text ("I want to make..."), and zero to four photos.

### Photos in (fridge)
- Content block: `{ "type": "image", "source": { "type": "base64", "media_type": "image/jpeg", "data": "..." } }`, placed **before** the text.
- Formats: JPEG, PNG, GIF, WebP. Max 10 MB per image (base64) on the direct API; request size limit 32 MB.
- Phone photos are huge. **Resize in the browser** with a canvas to at most 1568 px on the long edge, export JPEG at about 0.85 quality, before upload. This keeps requests small and cheap and is plenty for ingredients.
- Max 4 photos per request. Label them in text ("Image 1:", "Image 2:").
- When photos are present, the prompt asks Claude to list the ingredients it can see, say how sure it is, and use only what is reasonable. The UI should show the detected ingredient list so the user can correct it (Claude can misidentify items).
- Images are not stored by Anthropic after the request; we store our own copy in `data/images/` with kind `fridge`.

### Chat (streaming)
- `POST /api/sessions/:id/messages` returns Server-Sent Events. Server side uses the SDK stream helper, e.g. `client.messages.stream({...}).on('text', ...)`, forwarding text deltas to the browser as SSE events (`event: delta`, then `event: done`, or `event: error` with a friendly message).
- Context sent each turn: the system prompt, the current recipe as text, and the message history (cap to the last 30 messages to control cost). Do not resend fridge photos on every turn.
- The browser appends deltas as plain text (never `innerHTML`).
- Save the user message first, the full assistant message when the stream finishes.

### Refine
`POST /api/sessions/:id/refine` takes chip names and/or free text, adds a `user` message ("Refine: Spicier, Quicker"), calls the same `submit_recipe` tool with the current recipe and the requested changes, saves the updated recipe, and adds a short assistant message describing what changed.

### System prompt (put in `src/ai/prompts.js`)
Persona: a friendly, practical home-cooking assistant called Chef Buddy. Rules to include:
- Use only the user's stated diets and allergies as hard constraints. If an ingredient conflicts, replace it and say so.
- **Halal:** no pork or pork derivatives (gelatine, lard), no alcohol or alcohol-based extracts (vanilla extract, wine, mirin), meat assumed to be halal-certified; say when something should be checked on the label.
- **Kosher:** no pork or shellfish, no mixing meat and dairy in one dish, check labels.
- **Vegetarian / vegan / pescatarian:** the usual meanings; watch hidden animal products (stock, gelatine, honey for vegan, fish sauce).
- **Allergies:** treat as absolute. Mention cross-contamination risk and "check labels" when relevant. Never claim a recipe is guaranteed safe.
- Keep recipes realistic for a home kitchen, with metric amounts and times.
- For "I want to make X": give the recipe and a `shopping_list` of items the user did not say they already have.
- Keep chat answers short and practical. Offer substitutions when the user cannot find an ingredient.
- Never invent that a photo shows something it does not. Say when unsure.

### Errors to map to friendly messages
Missing key, 401 (bad key), 429 (rate limit, try again shortly), 529 or 5xx (service busy), model not found (go to Settings), request too large (photo too big), network failure.

### Cost notes (show in the handout, not the UI)
Tokens cost money. Vision tokens are about `ceil(width/28) × ceil(height/28)` per image, so resizing saves money. Web search is **not** used in this app (it is billed per search).

## OpenAI (images only)

### Live model list
`GET /v1/models`. Items have `id`, `created`, `owned_by` and sometimes `shutdown_date`. There is **no field saying which models make images**, so keep ids that start with `gpt-image`. Show a "retiring on <date>" warning when `shutdown_date` is set. Same cache, refresh and manual-entry rules as Claude.
At the time of writing, the docs list `gpt-image-2.5-flare` (fast, everyday) and `gpt-image-2.5-sunburst` (best for precise edits). Use `flare` as the default if present. Do not hard-code these names.

### Generation
- `POST /v1/images/generations` (SDK: `client.images.generate`). Body: `model`, `prompt`, `size`, `quality`, `n: 1`.
- Recommended sizes: `1024x1024`, `1536x1024` (landscape, use this for the recipe photo), `1024x1536`.
- Quality: `low`, `medium`, `high`, `xhigh`, `max`, `auto`. Default setting is `low` (cheapest). Let the user change it in Settings.
- The response is base64 (`data[0].b64_json`). Decode, save as a file in `data/images/` with kind `ai`, never hot-link.
- Prompt template (built in code, not by the user): "A natural, appetising photo of <title>, home-cooked, served on a plate, soft daylight, no text, no people." Keep the dish name and main ingredients; avoid brand names.
- Only on button press (**AI photo**). Show a spinner and a "this uses your OpenAI credit" hint the first time. One image per press.
- Label every generated image "AI-generated · what it might look like".
- Errors: missing key, 401, 429, content policy refusal (say "The image service declined this one, try again or add your own photo."), network.

## Never
- Never send or log API keys. Never send the whole database to any API.
- Never call either API from the browser. All calls go through our server.
