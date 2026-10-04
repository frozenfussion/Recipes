#!/usr/bin/env bash
# Step 1: turn on the firewall. SSH is allowed FIRST, so the connection you are using stays open.
# Then only web traffic (80 and 443) is allowed in. Everything else from outside, including the
# app's port 3000, is blocked.
# Run with: sudo bash deploy/firewall.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Please run with sudo: sudo bash $0" >&2; exit 1; }

ufw allow OpenSSH            # port 22, so you are never locked out
ufw default deny incoming    # anything not listed below is refused
ufw default allow outgoing   # the server may still reach Anthropic, OpenAI, Let's Encrypt, updates
ufw allow 80/tcp             # HTTP: needed for the certificate check, then redirects to HTTPS
ufw allow 443/tcp            # HTTPS
ufw allow 443/udp            # HTTPS over HTTP/3 (QUIC), which Caddy also offers
ufw --force enable           # --force skips the "may disrupt SSH" question: SSH is allowed above

echo
ufw status verbose
echo
echo "Done. Leave this terminal open and check that you can still open a NEW SSH session, then tell Claude."
