# 01 · Overview

## What it is
**Chef Buddy** is a local web app that helps someone cook. It talks to Claude (Anthropic) for recipes, chat and reading photos, and to OpenAI for optional AI pictures of a dish.

## Who uses it
- The trainer (Aziz) on a Windows PC at `http://localhost:3000`, also checked at phone width. Later it may move to a DigitalOcean droplet.
- Students, each with their own copy and their own API keys, supplied by the trainer.
- Single user per copy. No accounts and no login in version 1.

## Core user journey
1. **Cook screen:** choose diet options and allergies, add ingredients (type them, or snap/upload photos of the fridge), or just type "I want to make chicken biryani. What do I need to buy?". Press **Cook something up!**
2. **Recipe screen:** Chef Buddy shows a recipe (title, time, servings, diet tags, ingredients, method) next to a chat. The user can chat ("the shop only had Greek yoghurt, is that OK?", "the rice is sticking"), **Refine** the recipe (spicier, quicker, own words), **Duplicate** it, **Edit** it by hand, **Save** it, add it to a list.
3. **I cooked it!:** the user takes or uploads a photo of the finished dish. The recipe is saved as *Cooked* with that photo.
4. **History:** every session ever started, saved or not, newest first. Open one to continue the chat.
5. **My Recipes:** saved and cooked recipes. Organise into lists (create, rename, delete). Search. Open, edit, delete.
6. **Settings:** Claude API key and model, OpenAI API key, image model and quality, theme.

## Feature list
- Diet and allergy options (see `05-screens.md` for the full list), cuisine, servings, time, spice level.
- Ingredients typed or read from photos (Claude vision).
- "I want to make X": returns the recipe plus a shopping list of what is missing.
- Streaming chat with the recipe as context.
- Refine, duplicate, edit, delete.
- Cooked flow with the user's own photo.
- AI-generated dish photo on request (OpenAI), clearly labelled as AI.
- Sessions history, saved recipes, recipe lists.
- Live model lists from both vendors, with a refresh button and warnings for retiring models.
- Cartoon design (design A "Stone Age Diner"), light and dark theme.
- Works at phone width and desktop width.

## Out of scope for version 1
- Accounts, login, multi-user, sharing recipes.
- Web search, nutrition calculations, meal planning, grocery-store integrations.
- Offline mode, native apps, push notifications.
- Deployment (planned later as its own phase: DigitalOcean droplet, HTTPS, login).

## Honest limits to show in the UI
- AI photos show what a dish *might* look like. Label them "AI-generated".
- Claude's recipes should be reviewed by a human. Allergen and halal/kosher handling is a best effort, not a guarantee. Show a short note on the Recipe screen.
