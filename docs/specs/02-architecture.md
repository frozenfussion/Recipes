# 02 · Architecture

## Stack
Node.js 22.18+, Express, `node:sqlite`, plain JS frontend served statically, `@anthropic-ai/sdk`, `openai`. See `CLAUDE.md`.

## Folders
```
src/
  server.js            create the Express app (createApp), mount routes, start listening
  db.js                open the database, run numbered migrations in transactions, transaction() helper
  config.js            read PORT and HOST from the environment or .env (BOM-safe, PORT validated)
  routes/
    health.js          GET /api/health
    settings.js        keys (masked), models, quality, theme, key test, remove key
    models.js          live model lists
    lists.js           recipe lists
    sessions.js        sessions, chat (SSE), refine, cooked, duplicate, AI photo
    images.js          serve stored images
  ai/
    index.js           builds the real AI services (tests pass fakes instead)
    anthropic.js       Claude calls (models, recipe, streaming chat)
    openai.js          OpenAI calls (models, image generation)
    prompts.js         system prompt, diet rules, recipe tool, image prompt
  lib/
    chef.js            read and check Cook input, pick key + model, ask for a recipe (one retry)
    errors.js          ApiError, standard error JSON, friendly mapping of vendor errors
    images.js          type sniffing, size limit, save and delete image files
    mask.js            mask API keys for display
    models.js          cached live model lists, default model suggestions, resolveModel
    rate-limit.js      the "N requests per minute" gate for routes that cost money
    recipe.js          validate the recipe JSON (types, lengths)
    security.js        CSP and security headers, Host and Origin checks
    seed.js            demo data (npm run seed)
    sessions.js        sessions and lists logic (all the rules of 03-data-model.md)
    settings.js        read and write the settings table
public/
  index.html
  css/                 tokens.css (design tokens), app.css
  js/                  main.js, api.js, router.js, state.js, dom.js, theme.js, theme-init.js, image.js,
                       screens/*.js, components/*.js
  assets/              logo.svg, favicon.svg
scripts/
  check-node.js        runs before start/dev/test, stops with a plain message on an old Node
  seed.js              npm run seed
test/                  node:test files, helpers.js holds the fake AI services
data/                  git-ignored: chefbuddy.db, images/
```

## Run
- `PORT` (default 3000) and `HOST` (default `127.0.0.1`) from the environment or `.env`.
- `DATA_DIR` (optional) moves `data/` somewhere else. The tests use it so they never touch your real data.
- Single process. The server serves `public/` and the JSON API under `/api`.
- Frontend is a single page with screen switching (Cook, Recipe, History, My Recipes, Settings). Deep links use a bare `#screen` hash, like the mockup: `#home`, `#recipe`, `#history`, `#saved`, `#settings`.

## API (all JSON unless stated)
| Method and path | Purpose |
|---|---|
| `GET /api/health` | `{ ok, schemaVersion }` |
| `GET /api/settings` | Settings with keys **masked** and a `hasKey` flag |
| `PUT /api/settings` | Save keys, models, quality, theme. An empty key field means "leave unchanged" |
| `DELETE /api/settings/key/:provider` | The **Remove key** button (`anthropic` or `openai`) |
| `POST /api/settings/test/anthropic` and `/openai` | Check a key works (uses the posted key if there is one, else the saved key) |
| `GET /api/models/claude?refresh=1` | Live Claude model list, vision models only (cached 24h unless refresh) |
| `GET /api/models/openai?refresh=1` | Live OpenAI image model list, `gpt-image*` only (cached 24h unless refresh) |
| `GET /api/lists` (returns `{ lists }` with counts), `POST /api/lists`, `PATCH /api/lists/:id`, `DELETE /api/lists/:id` | Recipe lists. Deleting a list keeps its recipes |
| `GET /api/sessions?status=&list=&q=` | History and My Recipes. `status` is `draft`, `saved`, `cooked`, `recipes` (saved + cooked) or a comma list; `list` is an id or `none` |
| `POST /api/sessions` | Start a session from prefs, ingredients, text and up to 4 photos (base64). Generates the first recipe |
| `GET /api/sessions/:id` | One session with recipe and messages |
| `PATCH /api/sessions/:id` | Rename, change list, edit ingredients and method, change status |
| `DELETE /api/sessions/:id` | Delete session, messages and its image files |
| `POST /api/sessions/:id/messages` | Send a chat message, reply streamed as Server-Sent Events (`delta`, `done`, `error`) |
| `POST /api/sessions/:id/refine` | Apply refine chips and/or free text, returns the updated session |
| `POST /api/sessions/:id/cooked` | Upload the finished-dish photo (optional), mark Cooked and saved |
| `POST /api/sessions/:id/duplicate` | Copy the recipe into a new saved session with a fresh chat |
| `POST /api/sessions/:id/ai-photo` | Generate an AI dish photo with OpenAI (one per press) |
| `GET /images/:id` | Serve a stored image |

Errors return `{ "error": { "code": "...", "message": "..." } }` with a sensible HTTP status and a message a beginner can act on (for example "No Claude API key yet. Add one in Settings.").

## Safety layers (see `07-settings-security.md`)
Every response carries a strict Content-Security-Policy. The server refuses requests addressed to a host other than localhost (when bound to this computer only) and changes that come from another website's Origin. The routes that call Claude or OpenAI share a rate limit (30 a minute, pictures 10 a minute).

## Testing
`node:test`. Server logic is tested against an in-memory SQLite database and a temporary images folder, with the AI clients replaced by small fakes (`test/helpers.js`), so tests never spend money or need keys. `test/frontend.test.js` guards the frontend rules (no `innerHTML`, no inline styles or scripts, no raw colours in `app.css`).
