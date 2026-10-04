# 08 · Build plan

Work **one phase at a time**. At the start of each phase: say what you will build and which files you will touch, wait for approval. At the end: run it, run `npm test`, report what you checked, commit, and stop for review. The trainer reviews each phase and may ask for changes. That is intended. Do not rush ahead.

## Phase 0 · Skeleton
Build: `package.json` (scripts `start`, `dev`, `test`), folders from `02-architecture.md`, Express serving `public/`, `GET /api/health`, SQLite opened at `data/chefbuddy.db` with a `schema_version` and transactional migrations, `.env` handling for `PORT` and `HOST` (BOM-safe, `PORT` validated), a Node version check (`scripts/check-node.js`), clear messages for a busy port, a first test.
Status: done, plus a hardening follow-up (startup errors, `.env` BOM, migration rollback, Node 22.18 minimum, `.gitattributes`).
Check: `npm install && npm start` works on Windows; `http://localhost:3000` shows a placeholder page; `/api/health` returns ok; `npm test` passes; no ExperimentalWarning noise; `data/` is git-ignored.

## Phase 1 · Design system and app shell
Build: `public/css/tokens.css` and `app.css` from the mockup, header, bottom nav with 5 screens (empty placeholders), theme toggle with light/dark/device and persistence, toast and dialog helpers, mascot and favicon.
Check: matches `mockups/screens/` in light and dark at desktop and 390px; no horizontal scroll; keyboard focus visible; theme persists after refresh with no flash.

## Phase 2 · Settings, keys and live model lists
Build: Settings screen; `settings` table; masked key handling; **Test** buttons; `GET /api/models/claude` and `/openai` with 24h cache and **Refresh**; vision filter for Claude; `gpt-image*` filter and shutdown warning for OpenAI; manual model id field; image quality select.
Check: with fake clients in tests the lists, caching, filtering and masking work; with a real key the lists load; wrong key shows a friendly error; the key never appears in any API response, log or the page source.

## Phase 3 · Data layer and My Recipes, History, lists
Build: `lists`, `sessions`, `messages`, `images` tables; all `/api/lists` and `/api/sessions` routes except the AI ones; History, My Recipes (lists, search, rename, delete), the Recipe screen in view and edit mode, duplicate, delete, status rules. Seed a small demo dataset behind a `npm run seed` script (not run automatically).
Check: tests for every route and the rules in `03-data-model.md` (delete cascades, list deletion keeps recipes, duplicate behaviour); the screens behave like the mockup using seeded data.

## Phase 4 · Recipe generation, chat and refine (Claude)
Build: `src/ai/anthropic.js` and `prompts.js`; `POST /api/sessions` (text and ingredients only first); recipe via forced `submit_recipe` tool with validation and one retry; streaming chat over SSE; refine; friendly error mapping; the Cook screen wired up.
Check: with a fake client, tests cover validation, retry and error mapping; with a real key a real recipe appears, chat streams, refine changes the recipe; diet and allergy rules visibly respected (try halal, vegan, nut-free); nothing renders unescaped HTML.

## Phase 5 · Photos in and "I cooked it"
Build: browser-side resize; fridge photo upload to Claude with the detected-ingredients list shown for correction; `images` storage with file checks; **I cooked it!** flow with the user's photo; photo shown on Recipe, History and My Recipes.
Check: a 12-megapixel phone photo is resized to 1568px or less before upload; a wrong file type or an 8 MB+ file is rejected politely; deleting a session deletes its image files; works from a phone-sized window using the file input.

## Phase 6 · AI photo (OpenAI)
Build: `src/ai/openai.js`; `POST /api/sessions/:id/ai-photo`; the **AI photo** button, spinner, first-use cost hint, "AI-generated" label; image saved as kind `ai`.
Check: one image per press; default quality low; policy refusal and missing key give friendly messages; the user's own photo takes priority over the AI photo.

## Phase 7 · Polish and hand-over
Build: empty, loading and error states everywhere; accessibility pass; rate limit and CSP; README with install and run steps for Windows (Node 22.18 or newer, `npm install`, `npm start`, adding keys, optional phone testing with `HOST=0.0.0.0` and the firewall note); update specs where reality differs from them.
Check: full run-through of the user journey in `01-overview.md` on desktop and phone width, light and dark; `npm test` green; fresh clone to working app in under 10 minutes following only the README.

## Later (not part of this build)
Deploy to a DigitalOcean droplet with login, HTTPS and keys in environment variables (see `07-settings-security.md`).

## Working agreement for every phase
- Plan, then build, then verify, then explain, then stop.
- Prefer the smallest change that meets the check.
- If a spec is unclear or wrong, say so and propose a fix instead of silently deviating.
