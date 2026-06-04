#!/usr/bin/env bash
# setup-vps.sh — Run this ONCE on a fresh Ubuntu/Debian VPS to deploy the bot-worker.
#
# What it does:
#   1. Installs Node.js 20 LTS (via NodeSource)
#   2. Installs PM2 globally
#   3. Installs pm2-logrotate so logs don't fill the disk
#   4. Starts the bot-manager via PM2
#   5. Saves PM2 process list + enables auto-start on server reboot
#
# Usage:
#   chmod +x setup-vps.sh
#   ./setup-vps.sh

set -e

BOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== [1/5] Installing Node.js 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "Node version: $(node -v)"
echo "NPM  version: $(npm -v)"

echo ""
echo "=== [2/5] Installing PM2 ==="
sudo npm install -g pm2

echo ""
echo "=== [3/5] Installing pm2-logrotate (auto-rotate logs) ==="
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

echo ""
echo "=== [4/5] Starting bot-manager ==="
cd "$BOT_DIR"
pm2 start ecosystem.config.cjs

echo ""
echo "=== [5/5] Saving PM2 state + enabling auto-start on reboot ==="
pm2 save

# Generate and install the startup script for this OS
STARTUP_CMD=$(pm2 startup | tail -1)
echo "Running: $STARTUP_CMD"
eval "$STARTUP_CMD"

echo ""
echo "=== DONE ==="
echo ""
echo "Useful commands:"
echo "  pm2 status          — see if bot is running"
echo "  pm2 logs bot-manager — see live logs"
echo "  pm2 restart bot-manager — restart manually"
echo "  pm2 stop bot-manager    — stop"
