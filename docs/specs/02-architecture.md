# 02 · Architecture

## Stack
Node.js 22.18+, Express, `node:sqlite`, plain JS frontend served statically, `@anthropic-ai/sdk`, `openai`. See `CLAUDE.md`.

## Folders
```
src/
  server.js            create the Express app, mount routes, start listening
  db.js                open the database, create tables, tiny migration helper
  config.js            read PORT and HOST from the environment or .env (BOM-safe, PORT validated)
  routes/
    settings.js        keys, models, theme
    models.js          live model lists
    lists.js           recipe lists
    sessions.js        sessions, messages, refine, cooked, duplicate, AI photo
    images.js          serve stored images
  ai/
    anthropic.js       Claude calls (models, recipe, chat stream, vision)
    openai.js          OpenAI calls (models, image generation)
    prompts.js         system prompts and the diet rules text
  lib/
    errors.js          friendly error mapping
    mask.js            mask API keys for display
public/
  index.html
  css/                 tokens.css (design tokens), app.css
  js/                  main.js, api.js, router.js, screens/*.js, components/*.js
  assets/              logo.svg, favicon.svg
scripts/
  check-node.js        runs before start/dev/test, stops with a plain message on an old Node
test/
data/                  git-ignored: chefbuddy.db, images/
```

## Run
- `PORT` (default 3000) and `HOST` (default `127.0.0.1`) from the environment or `.env`.
- Single process. The server serves `public/` and the JSON API under `/api`.
- Frontend is a single page with screen switching (Cook, Recipe, History, My Recipes, Settings). Deep links use a bare `#screen` hash, like the mockup.

## API (all JSON unless stated)
| Method and path | Purpose |
|---|---|
| `GET /api/settings` | Settings with keys **masked** and a `hasKey` flag |
| `PUT /api/settings` | Save keys, models, quality, theme. An empty key field means "leave unchanged" |
| `POST /api/settings/test/anthropic` and `/openai` | Check a key works (uses the saved key unless one is posted) |
| `GET /api/models/claude?refresh=1` | Live Claude model list (cached 24h unless refresh) |
| `GET /api/models/openai?refresh=1` | Live OpenAI image model list (cached 24h unless refresh) |
| `GET /api/lists`, `POST /api/lists`, `PATCH /api/lists/:id`, `DELETE /api/lists/:id` | Recipe lists. Deleting a list keeps its recipes |
| `GET /api/sessions?status=&list=&q=` | History and My Recipes |
| `POST /api/sessions` | Start a session from prefs, ingredients, text and photos. Generates the first recipe |
| `GET /api/sessions/:id` | One session with recipe and messages |
| `PATCH /api/sessions/:id` | Rename, change list, edit recipe fields, change status |
| `DELETE /api/sessions/:id` | Delete session, messages and its image files |
| `POST /api/sessions/:id/messages` | Send a chat message, reply streamed as Server-Sent Events |
| `POST /api/sessions/:id/refine` | Apply refine chips and/or free text, returns the updated recipe |
| `POST /api/sessions/:id/cooked` | Upload the finished-dish photo (optional), mark Cooked and saved |
| `POST /api/sessions/:id/duplicate` | Copy the recipe into a new saved session with a fresh chat |
| `POST /api/sessions/:id/ai-photo` | Generate an AI dish photo with OpenAI |
| `GET /images/:id` | Serve a stored image |

Errors return `{ "error": { "code": "...", "message": "..." } }` with a sensible HTTP status and a message a beginner can act on (for example "No Claude API key yet. Add one in Settings.").

## Testing
`node:test`. Server logic is tested against an in-memory SQLite database with the AI clients replaced by small fakes, so tests never spend money or need keys.
