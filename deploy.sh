#!/bin/bash
# Deploy script — build + rsync to Raspberry Pi
# Usage: ./deploy.sh

set -e

REMOTE_USER="pi"
REMOTE_HOST="<IP_RASPBERRY>"         # TODO: replace with your RPi IP or Tailscale IP
REMOTE_PATH="/var/www/financie/"

echo "🔨 Building..."
npm run build

echo "🚀 Deploying to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}..."
rsync -avz --delete dist/ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"

echo "✅ Done! App is live at http://${REMOTE_HOST}"
