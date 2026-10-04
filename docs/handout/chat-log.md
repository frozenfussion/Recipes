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
