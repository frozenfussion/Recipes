# Chat log & decisions (handout source)

Running record of the planning chat. Screenshots live in `screenshots/`.

## Session 1 – Setup check (2026-10-04)
- Screenshots: `01-claude-code-environment-settings.png` (environment: name "Full Access", network access Full, setup script, env vars), `02-claude-code-repo-picker.png` (repo picker: frozenfussion/Recipes).
- Checked: network OK (npm, CDN), Node 22.22.0, npm 10.9.4, git 2.43.0. Repo `frozenfussion/Recipes` was empty. Push untested at that point.
- Local Windows folder: `C:\Users\User\Development\web\recipes` (empty, not yet linked to Git).

## Session 1 – Planning decisions
| Topic | Decision |
|---|---|
| App | "Chef Buddy": recipe helper. Diet filters + fridge ingredients (typed or photo) + "I want to make X" + chat + saved recipes and recipe lists |
| Stack | Node.js backend, web frontend (works in desktop browser and phone-sized screens) |
| Storage | SQLite via built-in `node:sqlite` (Node 22; prints an "experimental" warning, harmless) |
| AI (text + vision) | Claude API. Key + model chosen on a Settings page |
| Images | Claude cannot generate images. Use OpenAI image models (`gpt-image-2.5-flare` default, `gpt-image-2.5-sunburst`). Own key + model + quality in Settings. Generated on demand only. Pexels rejected (not issuing new keys) |
| Live model lists | Claude `GET /v1/models` (has `image_input` capability flag); OpenAI `GET /v1/models` (has `shutdown_date`, no image flag, so filter by name `gpt-image*`). Refresh button, 1-day cache, retiring-model warning, manual model ID field |
| Diets | Halal, kosher, vegetarian, vegan, pescatarian, meat-heavy, keto, low-carb, paleo, Mediterranean, high-protein, low-fat; allergies: gluten, dairy, nut, peanut, egg, shellfish, soy, sesame, lactose; extras: low-sodium, low-sugar, diabetic-friendly, cuisine, servings, time, spice, skill, budget |
| Look | Retro cartoon (Hanna-Barbera-style), light + dark theme, fun but not overwhelming |
| Hosting | Localhost on Windows PC now; DigitalOcean droplet later |
| Students | Aziz supplies API keys; keys never go in the repo |
| Handout | Must include Windows install instructions (Node, Git, clone, keys, run) |

## Session 1 – Mockups
- File: `mockups/index.html` (open directly in a browser; toggle design A/B and light/dark at the top).
- A = "Stone Age Diner" (warm oranges, chunky, comic headings). B = "Space Age Kitchen" (teal/pink, rounder, softer).
- Screens: Cook, Recipe + chat, My Recipes, Settings.
- Screenshots: `screenshots/mockup-{a|b}-{light|dark}-{home|recipe|saved|settings}.png`, plus phone-width `mockup-{a|b}-dark-phone-home.png`.
- Pending: Aziz picks A or B (or a mix).

## Session 1 – Mockup feedback round 1
- Aziz asked: where are Back / Refine, how do I see and manage all saved recipes (edit, delete, rename lists) and how do I start a new session? Answer: they were missing; added.
- Added to `mockups/index.html` (all clickable, demo data only, nothing stored):
  - Recipe screen: **← Back to ingredients**, **✏️ Refine** (quick-tweak chips + free text), **＋ New session** (confirm dialog clears ingredients and chat), **Save recipe** and **Add to list**.
  - My Recipes: filter by list, search, **New list**, **Rename list**, **Delete list** (recipes stay in All), click a recipe to open it.
  - Recipe detail: **Edit** (name, list, ingredients, method), **Delete** (confirm dialog), **Cook it again**, **← My Recipes**.
- Screenshots: `mockup-a-light-recipe-refine.png`, `mockup-a-light-saved-manage.png`, `mockup-a-light-recipe-detail.png`, `mockup-a-light-confirm-delete.png`.
- Note: a mid-turn "two theme buttons" request was withdrawn by Aziz (he was looking at the wrong button) and reverted.

## Session 1 – Mockup feedback round 2
- Aziz asked for: a **history of all sessions/recipes**, an **"I cooked it" success flow with a photo of the finished dish** that saves it as a recipe, and the ability to **continue the chat**, **duplicate** and **update** a recipe.
- Design decision: one model. Every session lives in **History** (even unsaved ones, shown as "Not saved"). Saved/cooked sessions also appear in **My Recipes**. Opening any of them shows the recipe plus its chat, so you can carry on.
- Added to `mockups/index.html`:
  - New **History** tab (filter All / Cooked / Saved / Not saved).
  - **🎉 I cooked it!**: take or upload a photo (camera on a phone), saves the recipe as Cooked with your photo. Can skip the photo.
  - **⧉ Duplicate**: makes a copy ("… (copy)") with its own fresh chat, ready to refine.
  - Working chat box, Refine messages go into the chat, **New session** no longer loses unsaved work (it stays in History).
  - Recipe view/edit/delete is now one screen shared by History and My Recipes.
- Screenshots: `mockup-a-light-history.png`, `mockup-a-light-cooked-dialog.png`, `mockup-a-light-recipe-cooked-photo.png`, `mockup-a-light-duplicate.png`, `mockup-a-light-saved-with-photo.png`, `mockup-a-light-phone-history.png`.

## Session 1 – Mockup approved
- Screenshot `03-claude-code-session-mockup-artifact.png`: the Claude Code web session (chat on the left) with the Chef Buddy mockup artifact open on the right (design A, dark theme).
- Aziz: the design "looks good" (design A shown).
- **Handout must teach recursive refinement:** do not accept the first thing the AI generates. Review it, understand all of it, ask for changes, and repeat.
- Next: write CLAUDE.md, the spec files and a downloadable starter package. No app code yet.

## Session 1 – Starter package written
- Aziz confirmed: **design A is final**; the work must live on **main**; give Git CLI commands.
- Written and committed: `CLAUDE.md`, `START-HERE.md` (Windows install, clone/sync commands, first prompt, phase routine, everyday Git), `README.md`, `.gitignore`, `.env.example`, `assets/` (logo, favicon), `docs/specs/01..08`, `mockups/` (+ `screens/`).
- Specs verified against vendor docs on 2026-10-04: Claude `/v1/models` (capabilities.image_input), image input rules (base64, 10 MB, resize to 1568px), streaming SDK helper, Claude Code Windows install, OpenAI image models (`gpt-image-2.5-*`, base64 response, sizes, quality).
- Build plan: Phase 0 skeleton, 1 design system and shell, 2 settings and live model lists, 3 data layer and lists, 4 recipes/chat/refine, 5 photos and "I cooked it", 6 AI photo, 7 polish. Each phase: plan, build, run, explain, challenge, commit.
- Deliverable zip: `chef-buddy-starter.zip` (sent to Aziz in chat).

## Session 1 – Aziz set up his PC
- `04-github-default-branch-main.png`: GitHub Settings, default branch changed to `main`.
- `05-git-clone-into-folder.png`: `git clone -b main https://github.com/frozenfussion/Recipes .` into the empty Windows folder, then `dir` showing the project files.
- `06-claude-code-first-start.png`: Claude Code v2.1.289 started in the project folder (Sonnet 5.5, auto mode on, effort medium).
- Handout tip: before the first prompt, press Shift+Tab until it says plan mode, so Claude Code plans before it changes anything.
- The first prompt is in `START-HERE.md` (section 3) and was pasted into the chat as copyable text.

## Session 1 – Plan mode vs auto mode (IMPORTANT handout section)
- Screenshot `07-claude-code-plan-mode-first-prompt.png`: first prompt pasted in **plan mode** (status bar: "plan mode on"). Claude Code is reading the specs and the mockup screenshots.
- Source: Claude Code docs, "Choose a permission mode" (checked 2026-10-04). Switch modes with **Shift+Tab**. From auto the cycle is: auto → manual → accept edits → plan → auto.

| Mode | What runs without asking | Best for (per the docs) |
|---|---|---|
| Manual (`default`) | Reads only; asks before edits and commands | Reviewing every action, sensitive work |
| Accept edits | Reads, file edits, simple file commands | Iterating on code you are reviewing |
| **Plan** | Reads only. Claude researches and proposes, does not edit your code | Exploring before changing |
| **Auto** | Everything, with a second model (a classifier) checking each action in the background | Long tasks, fewer prompts |
| Bypass permissions | Everything, no checks | Isolated containers and VMs only |

- When you approve a plan, Claude Code asks which mode to continue in, then starts editing.
- Aziz's session started in **auto** by default (Claude Code 2.1.289), so he switched to plan mode on purpose for the first prompt.

### Suggested rule of thumb for students (trainer's call, not an official rule)
1. **Start every phase in plan mode.** Read the plan, challenge it, refine it. Nothing changes on disk yet.
2. **After you approve the plan, switch to auto or accept edits** for the build, because the work is now defined and routine. Keep Git committed before you start, so you can undo with `git restore .` or `git log`.
3. **Use manual mode** when the task touches secrets, deleting things, or anything you do not fully understand.
4. **Never use bypass permissions on your own PC.**
5. Auto mode is not a reason to stop reviewing. Run the app, read the diff (`git diff`), and ask Claude to explain.

## Session 1 – Claude Code's first plan (Phase 0)
- Screenshot `08-claude-code-phase0-plan-approval.png`: Claude Code asks to proceed: 1. Yes and use auto mode, 2. Yes, manually approve edits, 3. Tell Claude what to change. (The full plan is saved on Aziz's PC under `~\.claude\plans\`.)
- What the plan did well (teaching points): it summarised the project in its own words; it found a real blocker (Node.js not installed or not on PATH); it listed 19 gaps and risks in the specs instead of guessing; it listed exactly which files Phase 0 creates and how each will be verified; it asked 3 questions before starting.
- Gaps worth noting in the handout: the mockup's JavaScript is not safe to port (it builds HTML from strings), so only its CSS is reused; theme without flicker needs a localStorage mirror; the spec's upload size limits contradicted each other (4 photos x 8 MB x 1.33 > 25 MB), to be fixed in Phase 5.
- Lesson: this is recursive refinement in action. Read the plan, answer its questions, challenge it, then approve.

## Session 1 – Letting Claude Code install Node.js
- Aziz's question: why install Node by hand? Claude Code can run `winget` itself. Correct: it can run commands on the PC. The one thing it cannot do is approve Windows' own security prompt.
- Instruction given to Claude Code (approved plan with option 1, auto mode): confirm the package id with `winget search`, install Node.js LTS (22 or newer) with the agreements accepted, write a script if admin rights are needed, refresh PATH in its own shell (or call node by its full path), confirm `node -v` and `npm -v`, then continue Phase 0.
- **Windows showed a permission prompt (User Account Control, "Do you want to allow this app to make changes?") during the install. Aziz clicked Yes.** Handout note: this is normal and expected when installing software. Read what is asking, and click Yes only if you started the install. Claude Code cannot click it for you.
- Handout tip: let Claude Code do setup chores (installing tools, creating folders) and keep the human for approvals and review.

## Session 1 – Phase 0 built (screenshot 09)
- `09-claude-code-phase0-report.png`: Claude Code's Phase 0 report. Built, tested (6 of 6 tests pass), committed locally as `d2ea01b`, then stopped for review.
- Node.js installed by Claude Code with `winget install OpenJS.NodeJS.LTS`: **v24.19.0**, npm 11.17.0 (the specs say "22 or newer", so this is fine). No admin script was needed. It refreshed PATH in its own shell; **terminals that were already open must be reopened** before they can see `node`.
- Files: `src/server.js`, `src/db.js` (ordered migrations recorded in `schema_version`), `src/routes/health.js`, `src/lib/errors.js`, `src/config.js`, `public/index.html`, `test/db.test.js`, `test/health.test.js`. Only dependency: `express` (v5).
- Verified by Claude Code: `npm install` 0 vulnerabilities; `/api/health` OK; unknown API path returns the standard error JSON; server listens on 127.0.0.1 only; `data/chefbuddy.db` is git-ignored.
- **Honest "what I did not check" list** (teaching point: a good assistant tells you what it did not test): ran `node` directly, not `npm start` or `npm run dev`; did not open a real browser; did not test `HOST=0.0.0.0`; README not updated.
- Git printed harmless LF/CRLF line-ending warnings; a `.gitattributes` file would silence them.
- Aziz's review steps for the handout: reopen terminal, `node -v`; `npm start` and open http://localhost:3000 and /api/health; `npm test`; `npm run dev` and edit a file to see the restart; ask Claude Code to explain and to challenge its own work; `git pull --rebase` then `git push`.

## Session 1 – Claude Code reviews its own Phase 0 (recursive refinement in action)
- Aziz asked Claude Code to explain `server.js` and `db.js` and to challenge its own work. It found **two real bugs** by testing, not by guessing:
  1. **False success message:** starting a second copy while port 3000 was busy printed "Chef Buddy is running" and exited with code 0. Cause: the `listen` callback ignored the startup error.
  2. **Invisible BOM in `.env`:** some Windows tools save a hidden marker at the start of the file, so `PORT` was read as `"﻿PORT"` and the default silently won.
- It also named the weakest parts: startup code is untested; migrations were not wrapped in a transaction (a failing step could leave half-made tables); an old Node would crash with a cryptic error; PowerShell script policy and OneDrive-synced folders can break student setups.
- It proposed 7 small fixes (about 30 lines): handle the listen error, safer "run directly" check, safer `.env` reading, transactional migrations and a "database is newer than the code" guard, a clear Node version check, startup tests, and README notes.
- Lessons for students: (1) always ask the AI to explain and then to attack its own work; (2) a "done" report is not proof, so ask what is untested; (3) the best fixes are small, tested, and explained.

## Session 1 – Phase 0 fixes done (screenshot 10)
- `10-claude-code-phase0-fixes-report.png`: all 7 follow-up changes in one commit (`7e8b29f`), rebased onto the remote and pushed. 22 of 22 tests pass (up from 6).
- Node versions tried without installing anything extra, using `npx node@22`: 22.18.0, 22.23.3 and 24.19.0 pass; 22.17.0 is refused with a plain message. **Minimum is now Node 22.18** (needed for `import.meta.main`). Teaching point: the AI tested the claim instead of trusting memory, and the docs, README and specs were updated to match.
- New: `scripts/check-node.js`, `.gitattributes` (`* text=auto eol=lf`), README troubleshooting section (busy port, old Node, PowerShell script policy, OneDrive, Notepad BOM).
- Still unchecked by Claude Code: `npm run dev` and a real browser. Aziz checks these himself.
- Open issue it flagged itself: startup tests use the real `data/chefbuddy.db`. Fix before Phase 2, when API keys will live in that database: tests must use a temporary folder.

## Session 1 – Tests use a temporary folder (screenshot 11)
- `11-claude-code-tests-use-temp-folder.png`: commit `80bbb89`. `npm test` now uses a temporary data folder (`DATA_DIR`), deleted afterwards, so it never touches `data/chefbuddy.db`. 22 of 22 tests pass. Claude Code proved it by comparing file timestamps in `data/` before and after, and by renaming `data/` away and re-running the tests.
- Aziz's decision: speed up. Keep API keys in plain text (revisit only at deployment), stop the plan-and-check rounds, and build Phases 1 to 7 in one go in auto mode, then review the finished app. Handout lesson: the trainer decides how much ceremony a project needs. For a small local app, fewer approval rounds is fine; review at the end.

## Session 1 – Phases 1 to 7 built in one go (screenshot 12)
- `12-claude-code-phases-1-to-7-report.png`: Claude Code built all of Phases 1 to 7 in one auto-mode run (about 31 minutes), one commit per phase, pushed. `main` at `56beaff`.
- Run it: `npm install`, `npm start`, open http://localhost:3000, on Settings paste the Claude key, Save key, Test, pick a model, then go to Cook. `npm run seed` adds 5 demo recipes and 2 lists. `npm test` runs 112 tests with fake AI services (no keys, no cost).
- Built: design system and shell; Settings with masked keys and live model lists; History, My Recipes and lists; Recipe screen; Claude recipe generation, streaming chat and refine; fridge photos (shrunk in the browser) and "I cooked it!"; OpenAI AI photo; rate limits, strict Content-Security-Policy, full README.
- One change from the spec: the newest Claude models reject a forced `tool_choice` (HTTP 400), so the app now asks for the recipe tool, validates the result and retries once. Recorded in `04-ai-integration.md`. Lesson: specs are a starting point; the AI found the real behaviour and updated the docs.
- Extra protections it added: Host-header check and Origin check, so other websites cannot drive the running app and spend the user's credit.
- **Checked:** 112 tests; headless Chrome click-through on all screens, light and dark, desktop and 390px, no console errors, accessibility scan clean; a 12-megapixel photo shrunk to 1568x1176; fresh clone to working app in about 13 seconds.
- **Not checked (important):** the real Claude and OpenAI APIs were never called (no keys), so everything AI-related ran against fakes. Not tested on a real phone, with `HOST=0.0.0.0`, `npm run dev`, Safari/Firefox, or iPhone HEIC photos. Browser click-through scripts are not in the repo.
- Lesson: "all tests pass" with fake services does not prove the real thing works. The first real recipe, chat and AI photo are the true test.

### Handout section: follow the install instructions exactly
- Aziz's instruction: tell students to follow the setup instructions step by step because of administrator rights and similar Windows gotchas.
- Points to include: installing Node.js and Git makes Windows show a "Do you want to allow this app to make changes?" prompt (click Yes only for installs you started); open a **new** terminal after installing so it can see the new tools; run `npm install` and `npm start` from the project folder, in a normal (not administrator) terminal; if PowerShell says running scripts is disabled, follow the README's script-policy fix; keep the project folder outside OneDrive-synced folders; never paste API keys into chat or files, only into the app's Settings page.

## Session 1 – First run of the real app (screenshot 13)
- `13-chef-buddy-cook-screen-running.png`: the finished app running on Aziz's PC, Cook screen in dark theme at a narrow (phone-like) width: diet chips (Halal selected), allergies, more options (cuisine, servings, time, spice), ingredient box, photo upload, free-text box and the Cook something up! button.
- Problem found on first real use: on Settings, the Claude model **Refresh** button spun for a very long time (this was the first call to the real Claude API, which Claude Code could not test). Lesson for the handout: fake-service tests cannot catch real-world problems, so the first real run is where bugs appear. Report the symptom to Claude Code in plain words and let it reproduce and fix it.

## Session 1 – First real recipe, and the "spinner" mystery solved (screenshots 14, 15)
- `14-first-real-recipe-garlicky-paprika-chickpeas.png`: the first real recipe from the real Claude API. Input: halal, Middle Eastern, "a can of chickpeas, black sesame seed paste, garlic and paprika powder". Output: Garlicky Paprika Chickpeas with tags (Halal, Vegan, Vegetarian, Dairy-free, Egg-free, Nut-free), ingredients, a "To buy" list, six method steps and a tip. The app works end to end.
- `15-claude-code-timeout-fix-and-save-key-cause.png`: Aziz reported that Refresh spun forever for both Claude and OpenAI models. Claude Code investigated (DNS, IPv4, proxy, VPN, our own Host/Origin check and rate limiter: all fine), found the SDK waited 10 minutes with retries, and added 15-second timeouts, clear error messages, one safe log line per failure and `npm run check:network` (commit `76ffa84`, 119 tests pass).
- **Real cause: Aziz had not clicked "Save key".** Typing a key is not enough; the key must be saved first. Claude Code then offered a small UX fix: when a key is typed but not saved, Refresh and Test should say "Press Save key first".
- Lessons: (1) many "bugs" are a missed step, so check the simple thing first; (2) report symptoms to the AI in plain words and let it investigate; (3) the investigation still left the app better (timeouts, clear messages, a network checker).
- Placeholder note: the striped yellow/black box on a recipe is the "no photo yet" placeholder. Press **AI photo** (needs a saved OpenAI key and image model) or **My photo**.

## Session 1 – AI photo works (screenshots 16, 17)
- `16-ai-photo-generated.png`: the OpenAI image on the recipe, labelled "AI-generated · what it might look like", with **Try again** and **Change photo** buttons.
- `17-recipe-actions-and-chat.png`: the lower half of the recipe screen: method, a cooking tip, the "Check labels and allergens yourself" note, buttons (I cooked it!, Add to list, Edit, Delete) and the chat ("Ask Chef Buddy") with the user's message and Claude's reply.
- Aziz: "looks absolutely beautiful." The full journey now works with real keys: diet and ingredients, recipe, chat, AI photo.

## Session 1 – "Press Save key first" fix and repo check (screenshots 18, 19, 20)
- `18-claude-code-save-key-fix.png`: commit `f08c5df`. Typing a key shows "Not saved yet"; Refresh and Test with an unsaved key say "Press Save key first"; with no key they say "Add your Anthropic key and press Save key first". 119 tests pass, and Claude Code checked it in a real browser.
- `19-history-screen-real.png` and `20-my-recipes-screen-real.png`: the real History and My Recipes screens after the first recipe was saved (photo thumbnail, "Saved" badge, tags).
- **Independent repo check** (fresh clone of `main` into an empty folder, `npm install`, `npm test`): 119 of 119 tests pass on Node 22.22.0; no `.env`, database, `data/` or `node_modules` tracked; the only key-looking strings are obviously fake test keys. Handout tip: a fresh clone is the best test that a repo is complete.

## Session 1 – Deployment demo: DigitalOcean droplet (screenshot 21)
- Aziz dropped the home-server idea and created a **DigitalOcean droplet** (Ubuntu 24.04, hostname `recipes`, folder `~/projects/recipes`) and a DNS **A record**: `recipes.faysalaziz.com` points to the droplet's IP (TTL 3600). Screenshot: `21-digitalocean-dns-a-record.png`.
- Plan for the demo: install Claude Code on the droplet, log in, clone the repo, let Claude Code deploy it, and then **fix the security items on purpose** (the point for students: a public deployment needs a little security thinking). Known items from the specs: API keys are plain text in the database, there is no login, and the app needs HTTPS.

## Session 1 – Droplet: code changes written, Script 0 run (screenshots 26, 27)
- `26-droplet-code-changes-and-script0.png`: Claude Code on the droplet wrote the deployment code changes first (not yet tested because Node was missing): `ALLOWED_HOSTS` setting, keys read from server environment variables (`CHEF_BUDDY_ANTHROPIC_KEY`, `CHEF_BUDDY_OPENAI_KEY`) with `KEY_SOURCE=server` so keys are never saved in the database, a Settings page that shows "Set on the server", `scripts/backup.js`, and new tests. It then wrote `deploy/install-packages.sh` (Node 24 LTS and Caddy from their official apt repos, plus a read-only report) for Aziz to run with sudo.
- `27-droplet-install-report.png`: the report after running it. Node v24.21.0, npm 11.19.0, Caddy v2.11.7. **Firewall (ufw): inactive. SSH: root login allowed (`permitrootlogin yes`) and password login ON (`passwordauthentication yes`, set in `50-cloud-init.conf`); keys authorised for root: 0. Automatic security updates: enabled.**
- Teaching point: a brand-new server is open by default. Here: no firewall, password logins on, root login on. This is exactly what the security steps fix. Also: the AI's earlier assumption ("password login is off, root has a key") was wrong until the report proved otherwise, so SSH hardening must be re-planned (add a key for the normal user first, test it from a second terminal, only then switch passwords off).
