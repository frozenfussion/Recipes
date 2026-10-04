#!/usr/bin/env bash
# Step 4: put the API keys in /etc/chef-buddy/secrets.env (owner root, mode 600), then restart
# the app so it picks them up. Keys are typed with hidden input: they do not appear on screen,
# in your shell history, or in any log. Press Enter on a key to keep the one already saved.
# Run with: sudo bash deploy/set-keys.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Please run with sudo: sudo bash $0" >&2; exit 1; }

FILE=/etc/chef-buddy/secrets.env
install -d -o root -g root -m 700 /etc/chef-buddy
[[ -f $FILE ]] || install -o root -g root -m 600 /dev/null "$FILE"

# Current value of NAME in the file (empty if none).
current() { sed -n "s/^$1=//p" "$FILE" | tail -n 1; }

ask() {
  local name=$1 label=$2 value
  # Prompt and newline go to the screen (stderr); only the key is returned.
  read -r -s -p "$label key (Enter = keep current): " value; echo >&2
  value=$(printf '%s' "$value" | tr -d '[:space:]')
  if [[ -z $value ]]; then value=$(current "$name"); fi
  if [[ -n $value && ! $value =~ ^[A-Za-z0-9_-]{10,300}$ ]]; then
    echo "That does not look like a $label key (letters, digits, - and _ only). Nothing was changed." >&2
    exit 1
  fi
  printf '%s' "$value"
}

anthropic=$(ask CHEF_BUDDY_ANTHROPIC_KEY "Claude (Anthropic)")
openai=$(ask CHEF_BUDDY_OPENAI_KEY "OpenAI (optional)")

# Write a new file next to the old one, then swap, so a half-written file is never used.
umask 077
tmp=$(mktemp /etc/chef-buddy/.secrets.XXXXXX)
printf 'CHEF_BUDDY_ANTHROPIC_KEY=%s\nCHEF_BUDDY_OPENAI_KEY=%s\n' "$anthropic" "$openai" > "$tmp"
chown root:root "$tmp"
chmod 600 "$tmp"
mv "$tmp" "$FILE"
unset anthropic openai

ls -l "$FILE"
if systemctl is-enabled --quiet chef-buddy 2>/dev/null; then
  systemctl restart chef-buddy
  sleep 2
  # The app's start message says "set" or "NOT set" for each key, never the key itself.
  journalctl -u chef-buddy -n 5 --no-pager -o cat | grep "API keys" | tail -n 1 || true
fi
echo "Done. Tell Claude it finished (do not paste the keys)."
