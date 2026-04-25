#!/bin/bash
# Deploy script for financie.pedani.eu + api.pedani.eu
# Usage:
#   ./deploy.sh            — deploy both frontend and backend
#   ./deploy.sh frontend   — only frontend
#   ./deploy.sh backend    — only backend

set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_SRC="${REPO_ROOT}/finance-tracker"
BACKEND_SRC="${REPO_ROOT}/backend"

FRONTEND_DEST="/var/www/finance-tracker/finance-tracker/dist"
BACKEND_DEST="/var/www/finance-tracker-api"

API_NAME="finance-tracker-api"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo ""; echo "▶  $*"; }
ok()   { echo "✓  $*"; }
fail() { echo "✗  $*" >&2; exit 1; }

# ── Argument parsing ──────────────────────────────────────────────────────────
TARGET="${1:-both}"
case "$TARGET" in
  frontend|backend|both) ;;
  *) fail "Unknown target '${TARGET}'. Use: frontend | backend | both" ;;
esac

# ── Pull latest code ──────────────────────────────────────────────────────────
log "Pulling latest code..."
cd "$REPO_ROOT"
git pull --ff-only
ok "Code up to date ($(git rev-parse --short HEAD))"

# ────────────────────────────────────────────────────────────────────────────
#  FRONTEND
# ────────────────────────────────────────────────────────────────────────────
deploy_frontend() {
    log "Building frontend..."
    cd "${FRONTEND_SRC}"
    rm -rf node_modules/.tmp .tsbuildinfo
    npm ci --prefer-offline --legacy-peer-deps
    npm run build
    ok "Frontend built → ${FRONTEND_SRC}/dist"

    log "Deploying frontend to ${FRONTEND_DEST}..."
    rm -rf "${FRONTEND_DEST:?}"/*
    cp -r "${FRONTEND_SRC}/dist/." "${FRONTEND_DEST}/"
    ok "Frontend files deployed"

    log "Reloading Nginx..."
    sudo nginx -t
    sudo systemctl reload nginx
    ok "Nginx reloaded"

    echo ""
    echo "  Frontend live at https://financie.pedani.eu"
}

# ────────────────────────────────────────────────────────────────────────────
#  BACKEND
# ────────────────────────────────────────────────────────────────────────────
deploy_backend() {
    log "Building backend..."
    cd "${BACKEND_SRC}"
    npm ci --prefer-offline
    npm run build
    ok "Backend built → ${BACKEND_SRC}/dist"

    log "Deploying backend to ${BACKEND_DEST}..."
    # Copy compiled output and package files (node_modules already installed)
    cp -r "${BACKEND_SRC}/dist/."        "${BACKEND_DEST}/dist/"
    cp    "${BACKEND_SRC}/package.json"  "${BACKEND_DEST}/"
    cp    "${BACKEND_SRC}/package-lock.json" "${BACKEND_DEST}/" 2>/dev/null || true

    # Install production dependencies in deployment dir
    cd "${BACKEND_DEST}"
    npm ci --omit=dev --prefer-offline
    ok "Backend files deployed"

    log "Running database migrations..."
    cd "${BACKEND_DEST}"
    # drizzle-kit reads DATABASE_URL from the .env in BACKEND_DEST
    npx drizzle-kit migrate
    ok "Migrations applied"

    log "Restarting backend via PM2..."
    if pm2 describe "${API_NAME}" > /dev/null 2>&1; then
        pm2 restart "${API_NAME}"
    else
        pm2 start "${BACKEND_DEST}/ecosystem.config.js" --env production
    fi
    pm2 save
    ok "PM2 process '${API_NAME}' running"

    echo ""
    echo "  Backend live at https://api.pedani.eu"
}

# ────────────────────────────────────────────────────────────────────────────
#  Run
# ────────────────────────────────────────────────────────────────────────────
START=$(date +%s)

case "$TARGET" in
  frontend) deploy_frontend ;;
  backend)  deploy_backend  ;;
  both)     deploy_frontend; deploy_backend ;;
esac

END=$(date +%s)
echo ""
echo "════════════════════════════════════════"
echo "  Deploy complete in $((END - START))s"
echo "════════════════════════════════════════"
