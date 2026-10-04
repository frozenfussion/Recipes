# Chef Buddy

A cartoon-style recipe helper web app. The user picks diet options, says what is in the fridge (typed, or a photo), or names a dish they want to make. Claude suggests a recipe, the user chats with Claude while cooking, refines the recipe, saves it, and attaches their own photo of the finished dish. All sessions are kept in a History, and saved recipes can be organised into lists.

This is also a **teaching project**: the person using you is a trainer who will show this build to students. Read "How to work" below before doing anything.

## Read first
Specs are the source of truth. Read the ones relevant to the phase you are working on, and all of them before Phase 0.

| File | What it covers |
|---|---|
| `docs/specs/01-overview.md` | Goals, features, scope, out of scope |
| `docs/specs/02-architecture.md` | Stack, folders, run commands, API endpoint list |
| `docs/specs/03-data-model.md` | SQLite tables and rules |
| `docs/specs/04-ai-integration.md` | Claude and OpenAI usage, model lists, prompts, photos |
| `docs/specs/05-screens.md` | Every screen and flow |
| `docs/specs/06-design-system.md` | Colours, fonts, components, light and dark |
| `docs/specs/07-settings-security.md` | API keys, safety rules |
| `docs/specs/08-build-plan.md` | Build phases with acceptance checks |

Visual reference: open `mockups/index.html` in a browser (clickable, design A) and look at the PNGs in `mockups/screens/`. The look and behaviour in the mockup is the approved design. Match it.

Ignore `docs/handout/`. It is the trainer's teaching material, not part of the app.

## Stack (decided, do not change without asking)
- Node.js 22 or newer (developed on 22.22.0), plain JavaScript, ES modules.
- Express for the server. No frontend framework, no bundler: plain HTML, CSS and ES-module JavaScript served from `public/`.
- SQLite through Node's built-in `node:sqlite` (no native build step, important on Windows). It prints an "experimental" warning; hide it with the `--disable-warning=ExperimentalWarning` flag in the npm scripts.
- Official SDKs: `@anthropic-ai/sdk` for Claude and `openai` for image generation.
- Tests with Node's built-in `node:test`.
- Ask before adding any other dependency, and say why it is needed.

## Commands
These are created in Phase 0. Keep them working at all times.
```
npm install      # install dependencies
npm start        # run the app at http://localhost:3000
npm run dev      # same, restarting on file changes (node --watch)
npm test         # run the tests
```
The user runs Windows 10/11 (PowerShell or CMD). Every script, path and command must work there. Use `node:path`, no Bash-only scripts, no `rm -rf` in npm scripts.

## Folder layout
```
CLAUDE.md
README.md
package.json
.env.example
assets/             logo.svg, favicon.svg (copy into public/ as needed)
docs/specs/         the specs
mockups/            design reference, do not edit
src/                server code (server.js, db.js, routes/, ai/, lib/)
public/             frontend (index.html, css/, js/)
test/               tests
data/               git-ignored: SQLite database and image files
```

## How to work (important)
1. **Plan first.** At the start of a phase, say what you will build and which files you will touch. Wait for approval before large changes.
2. **One phase at a time**, in the order of `docs/specs/08-build-plan.md`. Do not jump ahead. Stop at the end of each phase.
3. **Explain in plain language** what you built and why, as if teaching a beginner. Point out the 2 or 3 most important files or ideas.
4. **Run it and prove it works.** Start the app, exercise the feature, run `npm test`, and report what you checked and what you could not check. If something fails, say so plainly with the output.
5. **Expect refinement.** The trainer reviews everything and will ask for changes. Do not treat your first draft as final. Revise on request, and say what changed.
6. **Ask when unsure** about behaviour or design. Do not guess silently.
7. **Small commits** at the end of each phase with a clear message. Never commit `data/`, `.env`, `node_modules/` or anything containing a key.

## Rules
- API keys are entered on the Settings page and live only on the server (see `docs/specs/07-settings-security.md`). Never put a key in code, in the repo, in a log, in a URL, or in a response to the browser (return only a masked form such as `sk-ant-…a1b2`).
- Never hard-code model names. Load model lists live from the vendors' models endpoints and let the user pick (see `docs/specs/04-ai-integration.md`). Defaults come from the list, with a clear message if the saved model has been retired.
- Treat everything from the AI and from the user as untrusted text. Render it with `textContent` or proper escaping, never raw `innerHTML`. Use prepared statements for every SQL query.
- Bind the server to `127.0.0.1` by default. Binding to other devices must be an explicit choice (`HOST` in `.env`).
- Generate images only when the user taps the button. Never in the background. It costs money.
- Before writing code that calls Claude or OpenAI, check the current vendor docs (platform.claude.com/docs, developers.openai.com) and follow them. APIs and model names change.
- Keep it simple. Readable beats clever. Comments explain why, not what. Match the existing style.
- The UI must work on a phone-sized screen (about 390px wide) and on desktop, in both light and dark theme, with no horizontal page scroll.

## Definition of done for any feature
Works on desktop and phone width, in light and dark; handles loading, empty and error states; no secrets exposed; tests added for the server logic; README and specs updated if behaviour changed; committed.
