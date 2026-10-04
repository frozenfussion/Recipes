# 06 · Design system (design A, "Stone Age Diner")

Decision: design **A** is final. Design B ("Space Age Kitchen") is not used. The full working CSS is in the `<style>` block of `mockups/index.html`. Port it into `public/css/tokens.css` (the variables below) and `public/css/app.css` (components). Do not copy the mockup's design switcher or its control bar.

## Look
Retro cartoon, flat bold colours, thick dark outlines, hard offset shadows, chunky pills, a comic headline font. Fun, but only the shell is loud (buttons, cards, headings, mascot). Recipe text stays plain and easy to read.

## Tokens
Define every token on `:root` (light) and redefine for dark. Apply dark with `[data-theme="dark"]`, and when the theme is "match my device" use `@media (prefers-color-scheme: dark)`.

| Token | Light | Dark |
|---|---|---|
| `--bg` page | `#ffe3a3` | `#1f140d` |
| `--card` | `#fff6dc` | `#35231a` |
| `--ink` text | `#2b1a0f` | `#ffe9c7` |
| `--muted` | `#7a5a3a` | `#c9a67c` |
| `--primary` | `#e8541e` | `#ff7a3d` |
| `--on-primary` | `#ffffff` | `#1f140d` |
| `--accent` | `#2f9e9a` | `#4fd1c5` |
| `--on-accent` | `#ffffff` | `#10231f` |
| `--pop` highlight | `#ffc93c` | `#ffc93c` |
| `--line` outlines | `#2b1a0f` | `#0c0705` |
| `--radius` | `18px` | `18px` |
| `--shadow` | `6px 6px 0 var(--line)` | same |
| `--danger` (delete) | `#d6342c` | `#d6342c` |

## Type
- Headings and buttons: **Bangers** (Google Fonts), letter-spacing about 1.5px, weight 400.
- Body: **Nunito** 500/700/800.
- Both from Google Fonts with `display=swap` and fallbacks (`Impact, sans-serif` and `system-ui, sans-serif`). Optional later: download the font files into `public/fonts/` so the app works offline.
- Scale: h1 2.2rem, h2 1.7rem, h3 1.25rem, body 1rem, small 0.85rem. Body text max about 65 characters wide where it is long-form (method steps).

## Components (all in the mockup CSS)
- **Card:** 4px solid `--line` border, `--radius`, `--shadow`, `--card` fill, 16px padding.
- **Button:** 4px border, pill, heading font, hard 4px shadow; on press it moves down-right and the shadow shrinks. Variants: primary (orange), alt (teal), ghost (card colour), danger (red), small (`sm`), big (full width).
- **Chip:** 3px border, pill, bold. Selected (`aria-pressed="true"`) = accent fill. Ingredient chips use the yellow `--pop` fill with ✕.
- **Fields and textareas:** 3px border, rounded, `--bg` fill, a yellow focus ring.
- **Chat bubbles:** user = teal accent on the right; assistant = `--bg` on the left; notes centred and small.
- **Status badges:** Cooked (accent), Saved (yellow), Not saved (plain).
- **Photo area:** 16:10 box, striped yellow placeholder, rounded with a thick border.
- **Bottom nav:** fixed, card colour, thick top border; the current item is an orange pill.
- **Toast, dialog (with dark scrim), switch/toggle for theme.**
- **Mascot:** `assets/logo.svg` (chef-hat blob). Also the favicon.

## Layout
- Max content width about 980px, centred, 16px side gutters at every width.
- Two-column grids collapse to one column below about 760px.
- Leave bottom padding so the fixed nav never covers content, and add the phone safe-area inset.
- Nothing may scroll sideways at 390px wide.

## Motion
Small and quick (about 0.2s). Respect `prefers-reduced-motion`.

## Rules
- Colours come from tokens only, never raw hex in components.
- Every interactive element has a visible keyboard focus state.
- Test every screen in light and dark, desktop and about 390px wide.
