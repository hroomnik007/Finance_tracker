# MintRadar — Claude Code Context

## Project
Privacy-first Cashu mint monitoring PWA.
Live: https://mintradar.pedani.eu
GitHub: https://github.com/hroomnik007/MintRadar

## Server
- VPS: 178.104.169.40, user: deploy
- Frontend: /var/www/mintradar/dist (served by Nginx)
- Repo: /var/www/mintradar-repo
- Backend: Node/Express, port 3002, Docker
- DB: PostgreSQL in Docker (mintradar DB, user: mintradar)

## Stack
- Frontend: React 18 + TypeScript + Vite 5 + TanStack Query v5 + Zustand + Dexie (IndexedDB) + Recharts + vite-plugin-pwa
- Backend: Node.js/Express + TypeScript + pg (PostgreSQL) + nostr-tools
- Auth: Nostr NIP-07 (nos2x-fox, Alby)
- Fonts: DM Sans (self-hosted variable font)
- CSS: CSS variables (var(--bg), var(--bg2), var(--accent) #17E87F, var(--border), var(--text), var(--text2), var(--text3))

## Architecture
- Personal watchlist → IndexedDB only (never on server, cleared on logout)
- Public mint history → PostgreSQL (mint_history table)
- Mint discovery → NIP-87 kind:38172 server cron every 6h + client-side after Nostr login
- Backend proxy → /api/* proxied by Nginx to localhost:3002
- Cron every 5min → probes all mints in DB → writes to mint_history
- Nostr DM notifications → browser-side via NIP-07 when watchlist mint goes down/up
- Reviews → NIP-87 kind:38000 events, read/write directly from browser via Nostr relays

## DB Tables
- mints(url TEXT PRIMARY KEY, added_at TIMESTAMP, is_known BOOLEAN, icon_url TEXT)
- mint_history(id, url, online BOOLEAN, latency_ms INT, checked_at TIMESTAMP)

## Backend API
- GET /health — health check
- GET /api/mints/known — all mints with degraded flag (TTL cached 60s)
- GET /api/mints/history?url=... — history for one mint (last 24h)
- POST /api/mint/probe — probe single mint URL { url: string }
- POST /api/mint/submit — submit new mint URL { url: string }, rate limited 500/hr
- POST /api/mints/discover — batch insert discovered URLs { urls: string[] }, no rate limit

## Cron jobs
- Every 5min: probe all mints in DB → write to mint_history
- Every 6h: NIP-87 discovery from 7 relays → INSERT new mints

## Discovery relays (backend + frontend)
wss://relay.damus.io, wss://nos.lol, wss://relay.primal.net,
wss://relay.cashumints.space, wss://relay.azzamo.net,
wss://purplepag.es, wss://relay.snort.social

## Key features
- Dashboard: 4-5 column mint grid, latency/uptime color coding, stats bar, submit mint form
- Mint Detail: MOTD, Get in Touch with copy buttons, NUT compatibility grid with modal, latency chart, Trust Score gauge with breakdown, Add to Wallet + QR code, URLs list, NIP-87 reviews
- Watchlist: IndexedDB only, Nostr login required, export JSON, DM notifications
- Nostr: NIP-07 login, profile fetch (kind:0), reviews (kind:38000), DM notifications (kind:4)

## Deploy workflow (ALWAYS do all steps)
Backend (only if backend changed):
1. Commit + push local changes: git add -A && git commit -m "..." && git push origin main
2. On server pull + build: ssh deploy@178.104.169.40 "cd /var/www/mintradar-repo && git pull origin main && cd backend && npm run build"
3. Rebuild + restart Docker image: ssh deploy@178.104.169.40 "cd /var/www/mintradar-repo && docker compose build backend && docker compose up -d backend"
   NOTE: `docker compose restart` does NOT pick up code changes — always use `build` + `up -d`

Frontend:
4. Build frontend: npm run typecheck && npm run build
5. Deploy: rsync -avz --delete dist/ deploy@178.104.169.40:/var/www/mintradar/dist/
6. Reload nginx: ssh deploy@178.104.169.40 "sudo systemctl reload nginx"
7. Commit: git add -A && git commit -m "type: description" && git push origin main

## Key rules
- NEVER modify anything not explicitly requested
- ALWAYS run typecheck before build
- ALWAYS rsync dist after build
- ALWAYS commit and push after deploy
- Conventional commits: feat:, fix:, refactor:, docs:, chore:
- Security: always audit new code for SSRF, rate limits, XSS
