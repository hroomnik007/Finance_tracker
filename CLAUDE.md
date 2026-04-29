# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

```
/                        ← repo root (this CLAUDE.md)
├── backend/             ← Express + TypeScript API
├── finance-tracker/     ← React 19 PWA (has its own CLAUDE.md)
├── landing/             ← static landing page
├── nginx/               ← Nginx site configs for pedani.eu
├── deploy.sh            ← build + deploy script (run on server)
└── docker-compose.yml   ← backend Docker service only
```

## Commands

### Frontend (`cd finance-tracker`)
```bash
npm run dev       # dev server → http://localhost:5173  (API → localhost:3001)
npm run build     # tsc -b && vite build
npm run lint      # eslint
```

### Backend (`cd backend`)
```bash
npm run dev            # tsx watch src/index.ts  (hot-reload)
npm run build          # tsc → dist/
npm run start          # node dist/index.js  (production)
npm run db:generate    # drizzle-kit generate  (create migration from schema diff)
npm run db:migrate     # tsx src/scripts/migrate.ts  (custom SQL migrations in /migrations)
npm run db:migrate-drizzle  # drizzle-kit migrate  (applies drizzle/ folder migrations)
npm run db:seed-demo   # seed demo account
```

### Deploy (on server — `ssh deploy@pedani.eu`)
```bash
cd /var/www/finance-tracker-repo
./deploy.sh backend    # pull → npm ci → tsc → docker-compose up --build -d → drizzle-kit migrate
./deploy.sh frontend   # pull → npm ci → vite build → copy to /var/www/finance-tracker/dist → nginx reload
./deploy.sh            # both
```

After any change: `git add -A && git commit -m "..." && git push origin main && git push gitea main`
Git remotes: `origin` = GitHub (triggers Actions for frontend), `gitea` = self-hosted backup.

## Architecture

### Backend (`backend/src/`)
- **Express** app defined in `index.ts`; routers mounted at `/api/{auth,transactions,categories,admin,reports}`
- **Drizzle ORM** (`src/db/`) — schema in `schema.ts`, DB instance in `index.ts`
- **Two parallel migration systems**:
  - `drizzle/` — drizzle-kit generated migrations, applied via `drizzle-kit migrate` (used in `deploy.sh`)
  - `migrations/` — hand-written SQL files tracked via `_migrations` table, applied via `npm run db:migrate`
  - New schema changes need entries in **both**: add column to `schema.ts`, then add a SQL file to `migrations/` (e.g. `004_my_change.sql`), and run `npm run db:generate` to sync drizzle's own migration folder
- **Auth flow**: `issueTokens()` signs a 15-min JWT access token (returned in body) + 30-day refresh token (httpOnly cookie `rt`). Access token stored in memory only (never localStorage)
- **Docker deployment**: backend runs as a Docker container (`finance-tracker-repo-backend-1`) built from `backend/Dockerfile`. PostgreSQL is a separate Docker container (`finance-tracker-postgres-1`). The old PM2 approach in `DEPLOYMENT.md` is outdated.
- `backend/.env` contains real secrets (DB URL, JWT secrets). `/var/www/finance-tracker-api/.env` is a stale placeholder — ignore it.

### Frontend (`finance-tracker/src/`)
- **Hash-based routing** — no React Router. `App.tsx` reads `window.location.hash` and renders one of the page components. Navigation changes `window.location.hash`. Valid hashes: `dashboard`, `income`, `variable-expenses`, `fixed-expenses`, `categories`, `settings`.
- **AuthContext** (`context/AuthContext.tsx`) — source of truth for auth state. `user: AuthUser | null` holds the backend user object including `avatarUrl`. `refreshUser()` re-fetches `/api/auth/me` and updates state. All avatar rendering should use `user.avatarUrl` from this context.
- **SettingsContext** (`context/SettingsContext.tsx`) — localStorage-backed `AppSettings` (currency, language, dateFormat) + `profileName`/`profileAvatar` as secondary localStorage fallback. `profileAvatar` may be stale — prefer `user.avatarUrl` from AuthContext.
- **i18n**: `useTranslation()` returns `t` (Slovak or English) based on `settings.language`. All UI strings go through this — no hardcoded Slovak/English text in JSX.
- **Formatters**: `useFormatters()` provides `formatAmount()` and `formatDate()` respecting settings.

### Avatar system
`user.avatarUrl` (from `AuthContext`) is the canonical avatar value. It can hold:
- An emoji string (e.g. `"👤"`) — render as centered text in the circle
- A data URL (`"data:image/..."`) — render as `<img>`
- A URL string — render as `<img>`
- `null` / `undefined` — render first letter of `user.name`

When Profile saves a new avatar it calls `updateAvatar(avatarUrl)` → `PATCH /api/auth/avatar` → then `refreshUser()` to re-sync `AuthContext`. Any component that reads `user.avatarUrl` from `useAuth()` will re-render automatically.

### PIN — two separate systems
1. **App-lock PIN** (`usePinLock` hook, `components/PinLock.tsx`): SHA-256 hash stored in `localStorage` key `pin_hash`. Locks the UI after 5 min idle. Entirely client-side.
2. **Login PIN** (`/api/auth/pin-login`): bcrypt hash stored in `users.pin_hash` in DB. Used on the login page to authenticate without password. Set via `PATCH /api/auth/pin`.

### Category budget limits
`budgetLimit` is stored server-side in `categories.budget_limit` (numeric). The `useCategories` hook merges server value with a localStorage fallback (`category_budget_limits`) for backwards compatibility. Server value always takes precedence.

## Design System v2.0 (Phase 1)

### Fonts
- **DM Sans** — UI text (300/400/500/600/700)
- **DM Mono** — numbers, dates, amounts, labels (`.mono`, `.amount`, `.label-mono` classes)

### CSS Variables
New semantic variables: `--bg`, `--bg2`, `--bg3`, `--bg4`, `--border`, `--border2`, `--text`, `--text2`, `--text3`, `--violet`, `--violet2`, `--violet-glow`, `--green`, `--red`, `--card-shadow`, `--sidebar-w` (200px), `--sidebar-collapsed-w` (56px).

Old variable names (`--bg-primary`, `--bg-card`, `--text-primary`, etc.) are kept as compat aliases pointing to new vars — existing components don't need changes.

### Theme switching
Uses `data-theme` attribute on `<html>`: `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`. CSS selectors: `:root[data-theme="dark"]` and `[data-theme="light"]`. Compact mode still uses `html.compact` class.

### Layout (desktop)
`<div flex row> → <AppNav> → <div 12px gap> → <main flex column> → <Topbar> + <scrollable div>`

AppNav is a **flex item** (not `position:fixed`). Main fills remaining space. Gap creates visual sidebar separation.

### AppNav
- Expanded: `var(--sidebar-w)` = 200px; collapsed: `var(--sidebar-collapsed-w)` = 56px
- Bottom section: Nastavenia nav item → Profile row (avatar + name when expanded)
- Collapsed Výdavky hover → `position:fixed` popup submenu

### Topbar
- Mobile: logo + avatar button (replaces old fixed mobile topbar)
- Desktop: page title + date in DM Mono

### BottomNav (mobile)
- Full-width bar (`border-top`), no floating pill
- Tab items: icon in 32×32 rounded box (active = violet bg) + label

## Key constraints
- CORS: production only allows `financie.pedani.eu` and `finvu.pedani.eu`
- NEVER run deploy commands as root — causes permission issues under `deploy` user
- `.npmrc` in `finance-tracker/` has `legacy-peer-deps=true` (vite-plugin-pwa / vite@8 conflict)
- TypeScript 5.7 (not 6) in frontend — `erasableSyntaxOnly` is a TS6-only option, don't use it
