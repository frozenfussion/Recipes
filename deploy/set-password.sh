#!/usr/bin/env bash
# Step 2: the login for the website. Asks for a user name and a password (the password is not shown
# while you type), and saves only a bcrypt HASH of it in /etc/caddy/chef-buddy-auth.caddy.
# The password itself is never written anywhere. Run it again any time to change the password.
# Run with: sudo bash deploy/set-password.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Please run with sudo: sudo bash $0" >&2; exit 1; }
command -v caddy >/dev/null || { echo "Caddy is not installed. Run deploy/install-packages.sh first." >&2; exit 1; }

AUTH=/etc/caddy/chef-buddy-auth.caddy

read -r -p "User name for the website [chef]: " user
user=${user:-chef}
[[ $user =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Use only letters, digits, dot, dash or underscore." >&2; exit 1; }

echo "Now type the password twice. Nothing appears while you type; that is normal."
hash=$(caddy hash-password)
[[ $hash == \$2* ]] || { echo "Could not make a password hash." >&2; exit 1; }

# Readable by root and the caddy group only.
umask 027
printf 'basic_auth {\n\t%s %s\n}\n' "$user" "$hash" > "$AUTH"
chown root:caddy "$AUTH"
chmod 640 "$AUTH"
unset hash

echo "Saved the login for \"$user\" in $AUTH (hash only, readable by root and Caddy)."
# If our site is already set up, use the new password straight away.
if systemctl is-active --quiet caddy && grep -q chef-buddy-auth /etc/caddy/Caddyfile 2>/dev/null; then
  systemctl reload caddy && echo "Caddy reloaded: the new password works now."
fi
echo "Done. Tell Claude it finished (do not paste the password)."
