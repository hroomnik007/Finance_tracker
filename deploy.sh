#!/bin/bash
# Deploy script — build + deploy
# Usage: ./deploy.sh
# TODO: configure REMOTE_USER, REMOTE_HOST, REMOTE_PATH before use

set -e

REMOTE_USER="user"                   # TODO: replace with your server username
REMOTE_HOST="192.168.1.X"           # TODO: replace with your server IP
REMOTE_PATH="/var/www/financie/"    # TODO: replace with your server path

echo "🔨 Building..."
npm run build

echo "🚀 Deploying to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}..."
rsync -avz --delete dist/ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}"

echo "✅ Done! App is live at http://${REMOTE_HOST}"
