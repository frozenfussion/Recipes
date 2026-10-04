# 07 · Settings and security

## Where keys live
- The user types the Claude key and the OpenAI key on the Settings page.
- The server stores them in the `settings` table of `data/chefbuddy.db`. The whole `data/` folder is git-ignored.
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
- Render with `textContent` or escape. No raw `innerHTML` with dynamic data. Add a basic Content-Security-Policy header (no inline scripts if feasible).
- SQL: prepared statements only.
- Uploads: allow JPEG, PNG, WebP only, check the file's real type, limit to 8 MB, random file names, store under `data/images/` only. Serve with the correct `Content-Type` and `X-Content-Type-Options: nosniff`.
- JSON body limit: set explicitly (about 25 MB for photo uploads, lower for other routes).
- Basic rate limit on the AI routes (for example 30 requests per minute) so a bug or a loop cannot burn the user's credit. Show a friendly message when hit.
- Cap the length of free text sent to the AI (about 2,000 characters) and chat history (last 30 messages).

## Cost safety
- Image generation only when the user presses the button; one image per press; default quality `low`.
- No background or scheduled AI calls.
- Show which model is selected in Settings, so the user knows what they are paying for.

## Privacy note to show on Settings
"Your keys and recipes stay on this computer. Text and photos you send are processed by Anthropic (Claude) and, for AI photos, OpenAI, under their terms."

## Before deploying anywhere public (future phase)
Add login, HTTPS, move keys out of the database, per-user data, stricter rate limits, backups. Do not expose the current version to the internet.
