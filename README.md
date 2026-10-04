# Chef Buddy

A fun, cartoon-style recipe helper. Pick a diet, tell it what is in your fridge (type it or snap a photo), and Chef Buddy (Claude) suggests a recipe. Chat while you cook, refine the recipe, save it, and add your own photo of the finished dish.

Status: **Phase 0 (project skeleton) is done**: the server starts, `/api/health` answers, the database opens, and the tests pass. The screens and AI features come in Phases 1 to 7 (see [docs/specs/08-build-plan.md](docs/specs/08-build-plan.md)).

- Project instructions for Claude Code: [CLAUDE.md](CLAUDE.md)
- Specs: [docs/specs/](docs/specs/)
- Clickable design mockup (open in a browser): [mockups/index.html](mockups/index.html)

## Requirements
Node.js **22.18 or newer** (check with `node -v`). Tested on 22.18.0, 22.23.3 and 24.19.0.

## Run it
```
npm install
npm start
```
Then open http://localhost:3000. (Adding API keys on the Settings page arrives in Phase 2.)

```
npm run dev     same, restarting when you change files in src/ or public/
npm test        run the tests
```

Optional: copy `.env.example` to `.env` to change `PORT` or `HOST`.

## If something goes wrong (Windows)
- **"Port 3000 is already in use"**: another Chef Buddy window is still running. Close it, or set a different `PORT` in `.env`.
- **"needs Node.js 22.18 or newer"**: install the current LTS from https://nodejs.org (or `winget install OpenJS.NodeJS.LTS`), then open a **new** terminal.
- **PowerShell says "running scripts is disabled"** when you type `npm`: run this once, then try again:
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
  (or use `npm.cmd` instead of `npm`, or use CMD).
- **Keep the project folder out of OneDrive.** The app keeps its database in `data/`, and OneDrive syncing can lock or duplicate database files. `C:\Users\<you>\Development\...` is a good place; Desktop and Documents are often synced.
- **Editing `.env` in Notepad** is fine. A hidden byte-order mark at the start of the file is handled.
