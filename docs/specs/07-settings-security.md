# 07 · Settings and security

## Where keys live
- The user types the Claude key and the OpenAI key on the Settings page.
- The server stores them in the `settings` table of `data/chefbuddy.db`. The whole `data/` folder is git-ignored. (On a server they come from a protected file instead; see the last section.)
- Keys are stored as plain text in version 1 because the app runs on the user's own computer. This is a known trade-off. For a shared server (the later DigitalOcean phase) move keys to environment variables or an encrypted store, and add a login first.

## What the browser may see
- `GET /api/settings` returns only `hasKey: true/false` and a masked form (first 7 characters and the last 4, e.g. `sk-ant-…a1b2`). Never the full key.
- `PUT /api/settings` accepts a new key. An empty key field means "keep the current key", never "erase it". There is a separate **Remove key** button.
- Keys never appear in logs, error messages, URLs, HTML or tests. Redact them in any logged object.

## Network exposure
- Default `HOST=127.0.0.1`: only the same computer can open the app.
- To test from a phone on the same Wi-Fi, set `HOST=0.0.0.0` in `.env` and open `http://<PC-IP>:3000`. Windows Firewall will ask to allow Node. **The app has no login** and spends API credit, so only do this on a network you trust, and switch it back afterwards. Document this in the README.
- Note for later: phone cameras through `getUserMedia` need HTTPS. We avoid that by using `<input type="file" capture>`, which works over plain HTTP.

## Input handling
- Treat user text, AI text and uploaded files as untrusted.
- Render with `textContent` or escape. The frontend builds elements with `dom.js` `h()` and never uses `innerHTML` at all (a test enforces this). Every response carries a Content-Security-Policy: scripts and styles from `self` only (plus Google Fonts for styles and fonts), no inline scripts or styles, no framing.
- Two extra checks against other websites using your running app: the **Host** header must be localhost when the app is bound to this computer only (stops "DNS rebinding"), and a request that changes something must carry no `Origin` header or our own (stops cross-site requests).
- SQL: prepared statements only.
- Uploads: allow JPEG, PNG, WebP only, check the file's real type, limit to 8 MB, random file names, store under `data/images/` only. Serve with the correct `Content-Type` and `X-Content-Type-Options: nosniff`.
- JSON body limit: 25 MB for the two photo routes (start a session, "I cooked it"), 1 MB for everything else. Photos are shrunk in the browser first (about 150 to 300 KB each), and the 8 MB per photo rule is checked again on the server. Up to 4 photos at once, so the 25 MB total is a safety net, not the normal size.
- Rate limit on the routes that call a vendor (start a session, chat, refine, AI photo, key test): 30 requests per minute in total, and AI photos 10 per minute, so a bug or a loop cannot burn the user's credit. A hand-written limiter (`src/lib/rate-limit.js`), no extra package. The friendly message says how many seconds to wait.
- Cap the length of free text sent to the AI (about 2,000 characters) and chat history (last 30 messages).

## Cost safety
- Image generation only when the user presses the button; one image per press; default quality `low`.
- No background or scheduled AI calls.
- Show which model is selected in Settings, so the user knows what they are paying for.

## Privacy note to show on Settings
"Your keys and recipes stay on this computer. Text and photos you send are processed by Anthropic (Claude) and, for AI photos, OpenAI, under their terms."

## On a server (KEY_SOURCE=server)
- Deployed at https://recipes.faysalaziz.com behind Caddy (HTTPS and a basic-auth login). See `docs/deploy-security.md`.
- Keys come only from `CHEF_BUDDY_ANTHROPIC_KEY` and `CHEF_BUDDY_OPENAI_KEY`, which systemd reads from the root-only file `/etc/chef-buddy/secrets.env`. They are read from the real environment only, never from `.env`.
- The database is never asked for or given a key. `PUT /api/settings` with a key, `DELETE /api/settings/key/:provider` and a typed key on Test answer `400 keys_on_server`.
- `GET /api/settings` adds `keysOnServer: true`; the Settings page shows "Set on the server" with the masked key and Test, without the key field, Save or Remove.
- `ALLOWED_HOSTS` adds the public host name to the Host check. The Origin check is unchanged.
- Not done (out of scope for the demo): per-user accounts and data.
