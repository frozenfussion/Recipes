# Chef Buddy

A fun, cartoon-style recipe helper. Pick a diet, tell it what is in your fridge (type it or snap a photo), or name a dish you want to make, and Chef Buddy (Claude) suggests a recipe. Chat while you cook, refine the recipe, save it, organise recipes into lists, and add your own photo of the finished dish. Optionally ask OpenAI for an AI picture of the dish.

It is also a teaching project, so the code is plain JavaScript with no framework and no build step.

- Project instructions for Claude Code: [CLAUDE.md](CLAUDE.md)
- Specs: [docs/specs/](docs/specs/)
- Clickable design mockup (open in a browser): [mockups/index.html](mockups/index.html)

## Requirements
- **Node.js 22.18 or newer** (check with `node -v`). Tested on 22.18.0, 22.23.3 and 24.19.0.
- An **Anthropic API key** (for recipes and chat) and, only if you want AI dish pictures, an **OpenAI API key**. You paste them into the app's Settings page. They are never put in files you commit.

## Install and run (Windows, PowerShell or CMD)
```
git clone -b main https://github.com/frozenfussion/Recipes .
npm install
npm start
```
Then open <http://localhost:3000>.

1. Open **Settings**, paste your Claude key, press **Save key**, then **Test**.
2. Pick a model from the list (the app suggests one and says so). The list is loaded live from Anthropic and only shows models that can read photos.
3. Go to **Cook**, choose your diet, add ingredients (or a photo, or just say what you fancy) and press **Cook something up!**

Other commands:
```
npm run dev     same as start, restarting when you change files in src/ or public/
npm test        run the tests (they use fake AI services: no keys, no cost)
npm run seed    add 5 demo recipes and 2 lists, so the screens have something to show
npm run check:network   test whether this computer can reach Claude and OpenAI (sends no key)
npm run backup  copy data/ into backups/<date-time>/ (keeps the newest 14)
```
Optional: copy `.env.example` to `.env` to change `PORT` or `HOST`.

## What you can do
| Screen | What it does |
|---|---|
| **Cook** | Diet and allergy chips (remembered), ingredients, up to 4 fridge photos, or free text like "I want to make chicken biryani. What do I need to buy?" |
| **Recipe** | The recipe next to a streaming chat. Refine, duplicate, edit, save, add to a list, mark **I cooked it!** with your own photo, make an AI photo, delete |
| **History** | Every session you ever started, newest first, filterable. Open one to carry on chatting |
| **My Recipes** | Saved and cooked recipes, lists (create, rename, delete), search |
| **Settings** | Keys, models, image quality, theme (light, dark or match your device) |

## Keeping your money and data safe
- **Keys** are stored as plain text in `data/chefbuddy.db` on your computer (the `data/` folder is never committed). The browser only ever sees a masked version like `sk-ant-…a1b2`. This is fine for a single-user app on your own PC. On a server, keys come from a protected file instead (see below).
- **AI photos cost money** and only happen when you press the button: one picture per press, quality Low by default.
- A built-in limit (30 AI requests a minute) stops a bug or a loop from burning your credit.
- Chef Buddy can make mistakes. Check labels and allergens yourself. Halal, kosher and allergy handling is a best effort, not a guarantee.
- Your recipes stay on this computer. Text and photos you send are processed by Anthropic (Claude) and, for AI photos, OpenAI, under their terms.

## Trying it on your phone (same Wi-Fi)
1. Create a `.env` file (copy `.env.example`) and set `HOST=0.0.0.0`.
2. Restart with `npm start`. Windows Firewall asks whether to allow Node: allow it on your **private** network.
3. On the phone open `http://<your-PC-IP>:3000` (find the IP with `ipconfig`).
4. The photo button opens the camera on a phone.

**The app has no login and spends your API credit, so only do this on a network you trust, and set `HOST` back to `127.0.0.1` afterwards.**

## If something goes wrong (Windows)
- **"Port 3000 is already in use"**: another Chef Buddy window is still running. Close it, or set a different `PORT` in `.env`.
- **"needs Node.js 22.18 or newer"**: install the current LTS from <https://nodejs.org> (or `winget install OpenJS.NodeJS.LTS`), then open a **new** terminal.
- **PowerShell says "running scripts is disabled"** when you type `npm`: run this once, then try again:
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
  (or use `npm.cmd` instead of `npm`, or use CMD).
- **Refresh, Test or a recipe says "did not answer in time" or "Could not reach"**: this computer cannot reach Claude or OpenAI right now. Run `npm run check:network`. It tests DNS, the connection and a request for each service and shows where it stops. The usual causes are a VPN, a proxy, a firewall or antivirus blocking Node.js, or the internet being down. The server window also prints one line saying what failed (never your key). Model lists and key tests give up after 15 seconds; recipes after 3 minutes.
- **"No Claude API key yet"**: add one on the Settings page.
- **"This model is no longer available"**: the model you picked was retired. Pick another on Settings (press **Refresh** first).
- **Keep the project folder out of OneDrive.** The app keeps its database in `data/`, and OneDrive syncing can lock or duplicate database files. `C:\Users\<you>\Development\...` is a good place; Desktop and Documents are often synced.
- **Editing `.env` in Notepad** is fine. A hidden byte-order mark at the start of the file is handled.
- **Start over** with a clean slate: stop the app and delete the `data/` folder (this deletes your recipes, photos and saved keys).

## How it is built
Express serves a JSON API and the static frontend. SQLite (Node's built-in `node:sqlite`) stores everything in `data/chefbuddy.db`. The frontend is plain ES modules; text from the AI or the user is only ever shown with `textContent`, never as HTML (a test enforces this). The server talks to Claude and OpenAI through their official SDKs, so the browser never holds a key. See [docs/specs/02-architecture.md](docs/specs/02-architecture.md) for the folder map and the API list.

## Deploying to a server
Chef Buddy runs at https://recipes.faysalaziz.com on an Ubuntu server: a systemd service on 127.0.0.1:3000, Caddy in front with automatic HTTPS and a login, a firewall that only lets in SSH, 80 and 443, API keys in a root-only file, and a nightly backup. The config files and the setup scripts are in [deploy/](deploy/). What we did and why, step by step: [docs/deploy-security.md](docs/deploy-security.md).

Settings for a server (all optional; without them the app behaves as described above):
| Setting | What it does |
|---|---|
| `ALLOWED_HOSTS` | Extra host names the app answers to, comma-separated, e.g. `recipes.faysalaziz.com` |
| `KEY_SOURCE=server` | Keys only from `CHEF_BUDDY_ANTHROPIC_KEY` and `CHEF_BUDDY_OPENAI_KEY` in the environment, never from the database. The Settings page shows them as "Set on the server" |

Updating the server: `git pull`, `npm ci --omit=dev`, `sudo systemctl restart chef-buddy`.
