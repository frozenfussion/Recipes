#!/usr/bin/env bash
# Step 0: install Node.js 24 LTS (NodeSource) and Caddy (official repo), then show
# the current firewall, SSH and automatic-update settings. Changes nothing else.
# Run with: sudo bash deploy/install-packages.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Please run with sudo: sudo bash $0" >&2; exit 1; }

apt-get update
apt-get install -y ca-certificates curl gnupg
mkdir -p -m 755 /etc/apt/keyrings

echo "== Node.js 24 from NodeSource =="
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
chmod 644 /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" \
  > /etc/apt/sources.list.d/nodesource.list

echo "== Caddy from its official repo =="
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | gpg --dearmor --yes -o /etc/apt/keyrings/caddy-stable-archive-keyring.gpg
chmod 644 /etc/apt/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
  > /etc/apt/sources.list.d/caddy-stable.list

apt-get update
apt-get install -y nodejs caddy
# Caddy starts with a demo page on port 80. Stop it until our own config is installed.
systemctl stop caddy

echo
echo "== Installed =="
node -v; npm -v; caddy version

# Read-only report for the next steps.
echo
echo "== Firewall (ufw) =="
ufw status verbose || true
echo
echo "== SSH: effective settings =="
sshd -T 2>/dev/null | grep -Ei '^(port|permitrootlogin|passwordauthentication|kbdinteractiveauthentication|pubkeyauthentication) ' || true
echo "-- /etc/ssh/sshd_config.d/50-cloud-init.conf:"
cat /etc/ssh/sshd_config.d/50-cloud-init.conf 2>/dev/null || echo "(none)"
echo "-- keys authorised for root: $(grep -cs . /root/.ssh/authorized_keys || true)"
echo
echo "== Automatic security updates =="
systemctl is-enabled unattended-upgrades || true
cat /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null || true
grep -E '^\s*"\$\{distro_id\}:\$\{distro_codename\}-security"|Automatic-Reboot' /etc/apt/apt.conf.d/50unattended-upgrades || true
echo
echo "Done. Tell Claude it finished."
