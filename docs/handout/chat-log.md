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
