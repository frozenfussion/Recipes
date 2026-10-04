# 05 · Screens and flows

Source of truth for look and behaviour: `mockups/index.html` and `mockups/screens/`. This file lists what each screen must do. If this file and the mockup disagree on behaviour, ask.

## Shell (all screens)
- Header: logo, "Chef Buddy" title, tagline "What's in your fridge today?", theme toggle.
- Bottom navigation, always visible, 5 items: **Cook**, **Recipe**, **History**, **My Recipes**, **Settings**. The current item is highlighted. At phone width labels must not wrap.
- Toasts for short confirmations (2 to 3 seconds). Confirm dialogs for destructive actions are **in-page dialogs**, not the browser's `confirm()`.
- Theme: light, dark, or "match my device" (default). Remember the choice in the database (`settings.theme`) and apply it before first paint to avoid a flash.
- The **Recipe** tab opens the current session. If there is none, go to Cook with a toast "Start a session first".

## Cook (home)
Two cards (stacked on phone).
1. **Pick your diet.** Chips you can toggle on/off.
   - Diets and lifestyle: Halal, Kosher, Vegetarian, Vegan, Pescatarian, Meat-heavy, Keto, Low-carb, Paleo, Mediterranean, High-protein, Low-fat.
   - Allergies and intolerances (collapsible, open by default): Gluten-free, Nut-free, Peanut-free, Dairy-free, Egg-free, Shellfish-free, Soy-free, Sesame-free, Lactose-free.
   - More options (collapsible): Low-sodium, Low-sugar, Diabetic-friendly, plus selects for cuisine, servings, time available, spice level. (Skill level and budget are optional extras.)
   - Remember the last diet and allergy choices in `localStorage` so the user does not retype them.
2. **What have you got?**
   - Ingredient chips with ✕ to remove; text box where Enter adds a chip.
   - Photo area: "Snap or upload a photo". Uses `<input type="file" accept="image/*" capture="environment" multiple>`. On a phone this opens the camera. Show thumbnails with remove buttons. Resize in the browser (see `04-ai-integration.md`).
   - Free-text box: "...or tell me what you fancy".
   - Button **Cook something up!**: needs at least one of ingredients, photo or text, otherwise show a gentle message. Shows a loading state, then opens the Recipe screen.

## Recipe (with chat)
Top bar: **← Back** (label depends on where you came from: ingredients, History or My Recipes), **✏️ Refine**, **⧉ Duplicate**, spacer, **＋ New session**.
- **Refine panel** (toggle): chips (Spicier, Quicker, Fewer ingredients, Lighter, Kid-friendly, One-pan, Double the servings) + free text + **Update recipe**. Result: recipe updates in place, chat gets the "Refine: ..." message and a reply.
- **New session** asks for confirmation. An unsaved recipe is **not lost**: it stays in History as "Not saved". Clears the Cook inputs and goes to Cook.
- **Left card:** photo area, title, badges (status, time, diet tags, list, date), "You'll need" list, shopping list when present, "Method" numbered steps, buttons.
  - Photo area: with no photo, a striped placeholder with "AI-generated · what it might look like" and two buttons, **🎨 AI photo** and **📷 My photo**. With a photo, show it with a "📷 My photo" or "AI-generated" label and **Change photo** (your own photo). An AI picture also gets **🎨 Try again** (a new picture, replacing the old one). The first AI photo asks once, in a dialog, that it uses OpenAI credit. The fridge photos and the detected ingredients ("Chef Buddy spotted in your photo: ...") are shown on the Cook and Recipe screens.
  - Buttons: **🎉 I cooked it!**, **💾 Save recipe** (only when not saved), **📋 Add to list / Change list**, **✏️ Edit**, **🗑 Delete**.
  - **Edit mode** replaces the card content with fields: name, list, ingredients (one per line), method (one step per line), **Save changes** / **Cancel**.
- **Right card:** "Ask Chef Buddy" chat. Messages from the user on the right, Claude on the left, notes centred. The box scrolls to the newest message. Send with the button or Enter. Reply streams in.
- A short, quiet note under the recipe: "Check labels and allergens yourself. Chef Buddy can make mistakes."
- **🎉 I cooked it! dialog:** file input (camera on phone) with preview, buttons **Save**, **Save without photo**, **Cancel**. Result: status `cooked`, recipe saved, the user's photo shown. Photo is resized in the browser first.
- **Delete** confirms, then removes the session everywhere and returns to the screen you came from.

## History
- Heading, hint text, filter chips: All, 🎉 Cooked, ⭐ Saved, 📝 Not saved.
- Cards (two columns on desktop, one on phone), newest first: thumbnail (user photo, else AI photo, else emoji), title, date, message count, status badge, "Open →". Opening goes to the Recipe screen with the full chat, ready to continue.
- Empty state with a button to start cooking.

## My Recipes
- Card with title, **＋ New list**, list chips with counts (All, then each list), search box.
- New list: inline name field with Create / Cancel. Creating selects the new list.
- When a list is selected: a panel "List: <name>" with **✏️ Rename** (inline field, Save name / Cancel) and **🗑 Delete list** (confirm; recipes stay in All).
- Recipe cards: thumbnail, title, tags, time, list name, status badge. Open goes to the Recipe screen.
- Empty state: "Nothing here yet. Cook something and tap Save, or add recipes to this list."

## Settings
- **Claude (the chef brain):** API key (password field, masked value shown, empty means unchanged), **Test**, model dropdown, **↻ Refresh**, status line ("Live list from Anthropic · only models that can read photos · updated <time>"), "Key OK" badge.
- **OpenAI (the photographer):** API key, **Test**, image model dropdown, **↻ Refresh**, image quality (Low (cheapest), Medium, High), warning box when the chosen model has a shutdown date or is gone.
- **Look & feel:** Light / Dark / Match my device.
- Short help text under each key field saying where to get it and that it is stored only on this computer.

## States every screen needs
Loading (spinner or skeleton), empty, error with a plain-language message and a way to fix it, and offline/server-down message.

## Accessibility basics
Buttons are real `<button>`s with visible focus; images have alt text; dialogs trap focus and close on Esc; colour contrast is readable in both themes; respects `prefers-reduced-motion`.
