#!/usr/bin/env bash
# Step 3: install the app service, the nightly backup and the Caddy config, and start them.
# Needs deploy/set-password.sh to have run first (Caddy will not start without the login file).
# Safe to run again after you change a file in deploy/.
# Run with: sudo bash deploy/install-app.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Please run with sudo: sudo bash $0" >&2; exit 1; }

APP_USER=aziz
REPO=/home/aziz/projects/recipes
HERE=$(cd "$(dirname "$0")" && pwd)
[[ $HERE == "$REPO/deploy" ]] || { echo "Expected the repo at $REPO (the service files use that path)." >&2; exit 1; }
[[ -f /etc/caddy/chef-buddy-auth.caddy ]] || { echo "No login yet. Run: sudo bash deploy/set-password.sh" >&2; exit 1; }
[[ -d $REPO/node_modules ]] || { echo "Run 'npm ci --omit=dev' in $REPO first (as $APP_USER, not root)." >&2; exit 1; }

# Folders the app and the backup may write to (the services can write nowhere else).
install -d -o "$APP_USER" -g "$APP_USER" -m 700 "$REPO/data"
install -d -o "$APP_USER" -g "$APP_USER" -m 700 /home/$APP_USER/backups /home/$APP_USER/backups/chef-buddy

# The keys file: root only. Created empty here; deploy/set-keys.sh fills it.
install -d -o root -g root -m 700 /etc/chef-buddy
if [[ ! -f /etc/chef-buddy/secrets.env ]]; then
  install -o root -g root -m 600 /dev/null /etc/chef-buddy/secrets.env
fi

# systemd units
install -o root -g root -m 644 "$HERE/chef-buddy.service" "$HERE/chef-buddy-backup.service" \
  "$HERE/chef-buddy-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable chef-buddy.service chef-buddy-backup.timer
systemctl restart chef-buddy.service
systemctl start chef-buddy-backup.timer

# Caddy: keep the original config once, check ours, then switch to it.
[[ -f /etc/caddy/Caddyfile.orig ]] || cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.orig
caddy validate --config "$HERE/Caddyfile" --adapter caddyfile
install -o root -g root -m 644 "$HERE/Caddyfile" /etc/caddy/Caddyfile
systemctl enable caddy
systemctl restart caddy

sleep 3
echo
echo "== Status =="
systemctl --no-pager --lines=5 status chef-buddy.service || true
echo
systemctl --no-pager list-timers chef-buddy-backup.timer || true
echo
echo "== Listening ports (3000 must show 127.0.0.1 only) =="
ss -tlnp | grep -E ':(80|443|3000)\b' || true
echo
echo "Caddy is now getting the HTTPS certificate (this can take up to a minute)."
echo "Done. Tell Claude it finished."
