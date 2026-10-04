# 03 · Data model (SQLite)

File: `data/chefbuddy.db`, created on first start. Use prepared statements for every query. Turn on `PRAGMA foreign_keys = ON`. Keep a `schema_version` so tables can be changed later without losing data.

## One idea: a session holds the recipe and its chat
A **session** is one cooking conversation. It has a recipe (once generated) and messages. A session is shown in **History** always. It is also shown in **My Recipes** once it is *saved* or *cooked*. "Recipe" in the UI means a saved or cooked session.

### `settings`
| column | type | notes |
|---|---|---|
| key | TEXT PRIMARY KEY | `anthropic_api_key`, `openai_api_key`, `claude_model`, `image_model`, `image_quality`, `theme`, `models_cache_claude`, `models_cache_openai` |
| value | TEXT | |

### `lists`
| id | INTEGER PK | |
| name | TEXT NOT NULL | 1 to 40 chars, unique ignoring case |
| created_at | TEXT | ISO 8601 UTC |

### `sessions`
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| title | TEXT NOT NULL | defaults to the recipe title |
| emoji | TEXT | one emoji chosen by Claude for the dish, used as a placeholder thumbnail |
| status | TEXT NOT NULL | `draft` (not saved), `saved`, `cooked`. CHECK constraint |
| list_id | INTEGER NULL | FK to `lists(id)` ON DELETE SET NULL |
| prefs | TEXT | JSON: diets, allergies, cuisine, servings, time, spice |
| recipe | TEXT | JSON, see below. NULL until generated |
| duplicated_from | INTEGER NULL | FK to `sessions(id)` ON DELETE SET NULL |
| created_at, updated_at | TEXT | ISO 8601 UTC |
| cooked_at | TEXT NULL | set when marked cooked |

Recipe JSON (`recipe` column):
```json
{
  "title": "Garlicky Chicken & Spinach Rice",
  "emoji": "🍗",
  "time_minutes": 35,
  "servings": 2,
  "tags": ["Halal", "Nut-free"],
  "ingredients": ["400 g chicken thighs", "1 cup basmati rice"],
  "steps": ["Marinate the chicken...", "Sear..."],
  "shopping_list": ["Greek yoghurt"],
  "notes": "optional short tip or allergen note"
}
```
`shopping_list` is what the user still needs to buy (used for "I want to make X"). The UI shows it only when it is not empty.

One optional extra: `detected_ingredients` (a list of strings) is present only when Claude read fridge photos. It is kept when the recipe is refined. Limits checked by the server: title 120 characters, up to 60 ingredients (200 each), up to 60 steps (1000 each), up to 12 tags, notes 500.

### `messages`
| id | INTEGER PK | |
| session_id | INTEGER NOT NULL | FK ON DELETE CASCADE |
| role | TEXT NOT NULL | `user`, `assistant`, `note` (a system-style line such as "Duplicated from ...") |
| content | TEXT NOT NULL | plain text |
| created_at | TEXT | |

### `images`
| id | INTEGER PK | |
| session_id | INTEGER NOT NULL | FK ON DELETE CASCADE |
| kind | TEXT NOT NULL | `fridge` (input photo), `cooked` (user's finished dish), `ai` (generated) |
| file | TEXT NOT NULL | file name inside `data/images/` (never a user-supplied path) |
| mime | TEXT NOT NULL | `image/jpeg`, `image/png`, `image/webp` |
| created_at | TEXT | |

A session shows at most one dish photo: the newest `cooked` photo wins over the newest `ai` photo. To save disk space, a new `cooked` photo replaces the old `cooked` one (row and file), and a new `ai` picture replaces the old `ai` one. `fridge` photos are kept as our own copy and never shown.

## Rules
- Deleting a session deletes its messages, its image rows **and the files** on disk.
- Deleting a list sets `list_id` to NULL on its sessions. The recipes stay.
- Setting a list on a draft session also saves it (status `saved`).
- Duplicating copies the recipe JSON, sets title to "<title> (copy)", status `saved`, no photo, a fresh chat with one `note` message, and `duplicated_from`. The copy stays in the same list.
- Taking a recipe out of a list does not change its status (a saved recipe stays saved).
- Each migration runs in a transaction, so a failed one leaves nothing half-made. Version numbers: 1 bookkeeping, 2 settings, 3 lists + sessions + messages + images.
- Search (`q`) matches title and ingredients, case-insensitive.
- Image files: random file names, saved only under `data/images/`, type checked by content not just extension, size limit 8 MB.
