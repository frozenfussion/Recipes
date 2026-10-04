# Deploying Chef Buddy: what we did and why

Chef Buddy runs on an Ubuntu 24.04 server at **https://recipes.faysalaziz.com**. This is a demo for
students, so the goal was the **minimum sensible security**: a few simple layers, each of which
blocks a whole class of problems. This page explains each layer in plain words.

```
Internet ──► firewall (ufw) ──► Caddy (HTTPS + login) ──► Chef Buddy on 127.0.0.1:3000
             only 22, 80, 443    the only way in          runs as a normal user
```

All config files are in [`deploy/`](../deploy/). Anything that needs root is a script you run with
`sudo bash deploy/<script>.sh`, in this order:

| Step | Script | What it does |
|---|---|---|
| 0 | `install-packages.sh` | Installs Node.js 24 LTS (NodeSource) and Caddy (official repo) |
| 1 | `firewall.sh` | Turns on ufw: SSH, 80 and 443 only |
| 2 | `set-password.sh` | Asks for the website login and saves only a hash of the password |
| 3 | `install-app.sh` | Installs and starts the app service, the nightly backup and Caddy |
| 4 | `set-keys.sh` | Asks for the API keys and puts them in a root-only file |

Before step 3, as the normal user: `npm ci --omit=dev`.

## 1. The app runs as a service, as a normal user, only on 127.0.0.1

File: [`deploy/chef-buddy.service`](../deploy/chef-buddy.service)

- **systemd** starts the app when the server boots and restarts it if it crashes. No terminal has to stay open.
- It runs as the normal user `aziz`, **not root**. If someone found a bug in the app, they would get
  the rights of an ordinary user, not control of the whole server.
- It listens on **127.0.0.1:3000** only. 127.0.0.1 means "this machine". Other computers cannot
  connect to it at all, so the only way to reach the app is through Caddy.
- Extra hardening: the app cannot gain more rights (`NoNewPrivileges`), sees the system as read-only
  (`ProtectSystem=strict`, `ProtectHome=read-only`) and can write only to its `data/` folder.
- `ALLOWED_HOSTS=recipes.faysalaziz.com` lets the app answer to its public name. Every other host
  name is still refused (this is the app's protection against "DNS rebinding"), and changes coming
  from other websites are still refused (protection against "CSRF").

Useful commands:
```
sudo systemctl status chef-buddy      # is it running?
sudo journalctl -u chef-buddy -f      # its log, live
sudo systemctl restart chef-buddy     # after git pull
```

## 2. Caddy is the front door, with automatic HTTPS

File: [`deploy/Caddyfile`](../deploy/Caddyfile)

- **Caddy** receives every request from the internet and passes it to the app on 127.0.0.1:3000
  (a "reverse proxy").
- It gets a free **HTTPS certificate** from Let's Encrypt by itself and renews it before it expires.
  HTTPS encrypts everything between the browser and the server, including the login.
- `http://` is redirected to `https://`, and the **HSTS** header tells browsers to always use HTTPS
  for this site.
- Uploads bigger than 26 MB are refused at the door (the app allows 25 MB of photos per request).
- `flush_interval -1` passes the chat reply on as it streams in, instead of all at the end.

## 3. Firewall: only SSH, 80 and 443

File: [`deploy/firewall.sh`](../deploy/firewall.sh)

- **ufw** refuses every incoming connection except: 22 (SSH), 80 (HTTP, needed for the certificate
  check and the redirect) and 443 (HTTPS, over TCP and UDP for HTTP/3).
- SSH is allowed **before** the firewall is switched on, so the session in use is never cut off.
- Port 3000 is closed twice: the app only listens on 127.0.0.1, and the firewall blocks it as well.
- Outgoing connections are allowed, so the server can reach Claude, OpenAI, Let's Encrypt and
  the update servers.

## 4. A login in front of everything

File: [`deploy/set-password.sh`](../deploy/set-password.sh)

- The app itself has no login, so Caddy asks for one (**HTTP basic auth**) before any page, API
  call or image is served.
- The script runs `caddy hash-password`, which asks for the password without showing it, and saves
  only a **bcrypt hash** in `/etc/caddy/chef-buddy-auth.caddy` (readable by root and Caddy only).
  The password itself is never written anywhere: not in the repo, not in a log, not in chat.
- bcrypt is slow on purpose, so even a stolen hash is very hard to turn back into the password.
- Caddy hides the login header in its logs.
- One shared login is enough for a demo. To change the password, run the script again.

## 5. API keys in a root-only file, not in the database

Files: [`deploy/set-keys.sh`](../deploy/set-keys.sh), `src/config.js`, `src/lib/settings.js`

On a PC the keys are typed on the Settings page and stored in the database (fine for one person on
their own computer). On the server that changes:

- The keys live in `/etc/chef-buddy/secrets.env`, owned by **root**, mode **600** (only root can
  read it). `set-keys.sh` asks for them with hidden input, so they never appear on screen, in the
  shell history or in a log.
- **systemd** reads that file as root when it starts the app and passes the keys in as environment
  variables (`EnvironmentFile=`). The app's user cannot open the file itself.
- The service sets `KEY_SOURCE=server`. Then the app takes keys **only** from
  `CHEF_BUDDY_ANTHROPIC_KEY` and `CHEF_BUDDY_OPENAI_KEY`, ignores any key in the database, and
  refuses to save or remove a key from the Settings page.
- The Settings page shows **"Set on the server: sk-ant-…a1b2"** (masked), and **Test** still works.
- So the database and the backups never hold a key.
- On a PC nothing changes: without `KEY_SOURCE=server`, keys are typed on the Settings page as before.
- The app's start message says which keys are set (`Claude set, OpenAI NOT set`), never the keys.

## 6. SSH and automatic updates

- **Automatic security updates** were already on (`unattended-upgrades`, daily, security
  updates). Nothing was changed.
- **SSH** was left exactly as it was, by the owner's choice: login with user name and password,
  and root login allowed.

## 7. Nightly backup of the data folder

Files: [`deploy/chef-buddy-backup.service`](../deploy/chef-buddy-backup.service),
[`deploy/chef-buddy-backup.timer`](../deploy/chef-buddy-backup.timer), `scripts/backup.js`

- Every night at about 03:30 (server time) a **systemd timer** runs `npm run backup` as `aziz`.
- It copies the database with SQLite's `VACUUM INTO`, which gives a complete, consistent copy even
  while the app is writing, plus the `data/images/` folder, into
  `~/backups/chef-buddy/<date-time>/`.
- It keeps the newest **14** backups and deletes older ones.
- The backups are on the same server.

```
sudo systemctl start chef-buddy-backup    # make a backup now
ls ~/backups/chef-buddy                    # list backups
systemctl list-timers chef-buddy-backup    # when is the next one?
```
To restore: stop the app, copy `chefbuddy.db` and `images/` from a backup folder into `data/`,
start the app.

## Updating the app

```
cd ~/projects/recipes
git pull
npm ci --omit=dev
sudo systemctl restart chef-buddy
```
If a file in `deploy/` changed, run `sudo bash deploy/install-app.sh` again.

## How it was checked

| Check | Result |
|---|---|
| `https://recipes.faysalaziz.com` | Valid Let's Encrypt certificate |
| `http://` | 308 redirect to `https://` |
| Any page or API call without the login | 401 |
| Port 3000 on the public IP | Connection refused |
| `ss -tlnp` | 3000 only on 127.0.0.1 |
| `secrets.env` as the normal user | Permission denied |
| Database | No API key rows |
| `npm test` | All tests pass |
