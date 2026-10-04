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
