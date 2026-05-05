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

### Stack
- **React 19** + **TypeScript 5.7** + **Tailwind CSS 4** + **Vite 8**
- **REST API** at `api.pedani.eu` — axios client in `src/api/client.ts` with JWT Bearer + httpOnly cookie refresh
- **State management**: React Context only — `AuthContext` + `SettingsContext`. No Zustand, no Redux.
- **Routing**: hash-based (`window.location.hash`), no React Router. `App.tsx` reads hash and renders one of the page components.
- **Charts**: Recharts
- **Icons**: lucide-react
- **Offline DB**: Dexie (IndexedDB wrapper)

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
- **Hash-based routing** — no React Router. `App.tsx` reads `window.location.hash` and renders one of the page components. Navigation changes `window.location.hash`. Valid hashes: `dashboard`, `income`, `variable-expenses`, `fixed-expenses`, `categories`, `settings`, `household`.
- **AuthContext** (`context/AuthContext.tsx`) — source of truth for auth state. `user: AuthUser | null` holds the backend user object including `avatarUrl`. `refreshUser()` re-fetches `/api/auth/me` and updates state. All avatar rendering should use `user.avatarUrl` from this context.
- **SettingsContext** (`context/SettingsContext.tsx`) — localStorage-backed `AppSettings` (currency, language, dateFormat) + `profileName`/`profileAvatar` as secondary localStorage fallback. `profileAvatar` may be stale — prefer `user.avatarUrl` from AuthContext.
- **i18n**: `useTranslation()` returns `t` (Slovak or English) based on `settings.language`. All UI strings go through this — no hardcoded Slovak/English text in JSX.
- **Formatters**: `useFormatters()` provides `formatAmount()` and `formatDate()` respecting settings.

### Auth & Persistence
- JWT access token in memory only (`src/api/client.ts` `accessToken` variable, set via `setAccessToken()`). Set as `Authorization: Bearer` on every request via axios interceptor.
- Refresh token in httpOnly cookie `rt`. On 401, interceptor automatically calls `/api/auth/refresh` and retries.
- On app mount: `AuthContext` calls `/api/auth/refresh` before rendering. `isLoading` flag is `true` while this is in progress — `App.tsx` renders a spinner until `isLoading === false`. Do NOT redirect to login until `isLoading === false`.
- **Auth methods**: password login, demo login, Google OAuth (`@react-oauth/google`), PIN login (`/api/auth/pin-login`), WebAuthn passkeys (`@simplewebauthn/browser`)
- Theme preference: save to backend (`PATCH /api/users/me`) + localStorage cache (`theme_preference`)
- Rodinné financie toggle: save to backend + localStorage cache
- Dashboard view (Moje/Rodinné): localStorage only, key: `finvu_dashboard_view`

### Avatar system
`user.avatarUrl` (from `AuthContext`) is the canonical avatar value. It can hold:
- An emoji string (e.g. `"👤"`) — render as centered text in the circle
- A data URL (`"data:image/..."`) — render as `<img>`
- A URL string — render as `<img>`
- `null` / `undefined` — render first letter of `user.name`

When Profile saves a new avatar it calls `updateAvatar(avatarUrl)` → `PATCH /api/auth/avatar` → then `refreshUser()` to re-sync `AuthContext`. Any component that reads `user.avatarUrl` from `useAuth()` will re-render automatically.

### PIN — two separate systems
1. **App-lock PIN** (`usePinLock` hook, `components/PinLock.tsx`): stored in `localStorage` key `pin_hash` (SHA-256 hash). Locks the UI after 5 min idle. Entirely client-side.
2. **Login PIN** (`/api/auth/pin-login`): bcrypt hash stored in `users.pin_hash` in DB. Used on the login page to authenticate without password. Set via `PATCH /api/auth/pin`.

### Category budget limits
`budgetLimit` is stored server-side in `categories.budget_limit` (numeric). The `useCategories` hook merges server value with a localStorage fallback (`category_budget_limits`) for backwards compatibility. Server value always takes precedence.

## Design System v2.0

### Fonts
- **DM Sans** — UI text (300/400/500/600/700)
- **DM Mono** — numbers, dates, amounts, labels (`.mono`, `.amount`, `.label-mono` classes)

### Color palette — "Dusk Purple" dark theme (default)
CSS variables used everywhere — never hardcode colors:

| Variable | Purpose |
|---|---|
| `--bg` | page background |
| `--bg2` | card / panel background |
| `--bg3` | input / elevated surface |
| `--bg4` | subtle highlight |
| `--border` | default border |
| `--border2` | stronger border |
| `--text` | primary text |
| `--text2` | secondary text |
| `--text3` | muted / placeholder |
| `--violet` | accent (`#7C3AED`) |
| `--violet2` | lighter violet |
| `--violet-glow` | glow shadow for violet elements |
| `--green` | positive / income |
| `--red` | negative / expense |
| `--card-shadow` | box-shadow for cards |
| `--sidebar-w` | 200px |
| `--sidebar-collapsed-w` | 56px |

Old variable names (`--bg-primary`, `--bg-card`, `--text-primary`, etc.) are kept as compat aliases — existing components don't need changes.

### Theme switching
Light/dark/system support via `data-theme` attribute on `<html>`:
- `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`
- CSS selectors: `:root[data-theme="dark"]` and `[data-theme="light"]`
- On app init, theme is applied synchronously from `localStorage` before first render (IIFE in `App.tsx`) to avoid flash
- Compact mode: `html.compact` class (separate from theme)

### Spacing & shape
- Card border-radius: 12–16px
- Input border-radius: 10px
- Accent: `#7C3AED` (violet)

## Layout

### Desktop (≥1024px)
Three-column layout:
```
<div flex row>
  <AppNav 200px>          ← sidebar (flex item, NOT position:fixed)
  <12px gap>
  <main flex column>      ← fills remaining space
    <Topbar fixed>
    <scrollable content>
  </main>
  <right panel ~280px>    ← on Dashboard, Príjmy, Variabilné, Fixné, Kategórie
</div>
```

**Topbar** (single row, fixed):
- Left: "Dobrý deň/večer [name] 👋 · deň D.M.YYYY" in DM Mono
- Center/right: Moje/Rodinné toggle (only when household enabled) | `‹ Mesiac YYYY ›` navigator (only on relevant modules)

**AppNav (sidebar)**:
- Expanded: 200px; collapsed: 56px
- Top: logo
- Nav items: Prehľad, Príjmy, Výdavky (expandable: Variabilné / Fixné), Kategórie, Domácnosť
- Bottom: Nastavenia nav item only — NO user avatar at bottom of sidebar
- Collapsed Výdavky hover → `position:fixed` popup submenu

### Mobile (<1024px)
- No sidebar — **BottomNav** with 4 tabs: Prehľad, Príjmy, Výdavky, Nastavenia
  - Full-width bar (`border-top`), no floating pill
  - Tab items: icon in 32×32 rounded box (active = violet bg) + label
- **Topbar** (two rows, fixed):
  - Row 1: `[Logo]` `[Greeting + date]` `[Avatar]`
  - Row 2: `[‹ Month ›]` `[Moje/Rodinné toggle if household enabled]`
- **FAB (+) button**: `position:fixed`, `bottom: calc(72px + env(safe-area-inset-bottom, 16px))`, `right: 20px` — visible only on mobile
- Module "+ Pridať ..." action buttons: sticky top-right on desktop, hidden on mobile (FAB used instead)
- Desktop and mobile views must be mutually exclusive: use `md:hidden` / `hidden md:block` (or `lg:hidden` / `hidden lg:block`) — never render both simultaneously

## Modules

- **Prehľad / Dashboard**: hero gradient card (Zostatok + Príjmy/Výdavky inside), secondary stats row (Denný priemer, Najväčší výdavok, Transakcií), Príjmy/Výdavky chart toggle, right panel with Nadchádzajúce platby + Rozpočty + Posledné transakcie
- **Príjmy**: stat cards (2-col grid on mobile), Pravidelné príjmy section (hidden when empty), transaction list with member filter
- **Variabilné výdavky**: stat cards (2-col grid on mobile), category pill filters, date-grouped transaction list
- **Fixné výdavky**: stat cards, upcoming payments list
- **Kategórie**: 2-column grid on desktop — cards with icon + name + amount + limit + progress bar + percentage; mobile: list with FAB
- **Domácnosť**: member cards (2-col grid) with per-member Príjmy/Výdavky, household summary card
- **Nastavenia**: tabs — Všeobecné | Vzhľad & Téma | Bezpečnosť (PIN, Biometria/WebAuthn, Zmeniť heslo) | Notifikácie | Dáta | Rodinné financie (toggle only) | Nebezpečná zóna | Zmazať účet
- **Profil modal**: Avatar + name + email + streak badge | 5 buttons: Upraviť profil, Zmeniť heslo, Nastaviť PIN, Exportovať dáta, Odhlásiť sa

### Navigation from Profile modal
- "Zmeniť heslo" → navigate to `#settings` + scroll to `#bezpecnost-section`
- "Nastaviť PIN" → open PIN setup modal (4-digit, numpad, confirm step, stored as SHA-256 hash in `localStorage` key `pin_hash`)
- "Exportovať dáta" → navigate to `#settings` + scroll to `#data-section`
- "Odhlásiť sa" → logout + redirect to `#login`

## Login & Register pages
- Full dark background (`#0a0814`)
- Large logo (~80px), "Finvu" 32px bold, "FINANCIE POD KONTROLOU" uppercase muted subtitle
- No card wrapper around form — fields directly on background
- NO "Zapamätať si prihlásenie" checkbox
- "Prihlásiť sa →" with arrow, violet gradient button
- "alebo" divider
- Google button: dark background (`#1a1535`), dark border
- Register: same style, additional fields (Meno, Potvrď heslo, GDPR checkbox), Google button present

## Known patterns & conventions
- **Currency formatting**: always normalize `-0` to `0` before formatting
- **Empty states**: show illustration + title + description only — NO "Pridať" button inside empty state card
- **Duplicate rendering**: desktop and mobile views must be mutually exclusive — never render both simultaneously
- **Delete-all operations**: use paginated loop with `limit=200` (API max), not a single large request
- **useEffect deps**: always explicit — never missing dependency array, never causing infinite loops
- **Infinite loop prevention**: never call `setState` inside render body, never create circular `useEffect` dependencies
- **Stat cards on mobile**: 2-column grid layout

## PWA
- `manifest.json` icons: `icon-192.png` and `icon-512.png` in `public/`
- `theme_color`: `#8B5CF6`
- `display: standalone`

## Git workflow
- Two remotes: `origin` (GitHub) and `gitea`
- Always push to both: `git push origin main && git push gitea main`
- Commit format: `"fix: description"` or `"feat: description"`

## Key constraints
- CORS: production only allows `financie.pedani.eu` and `finvu.pedani.eu`
- NEVER run deploy commands as root — causes permission issues under `deploy` user
- `.npmrc` in `finance-tracker/` has `legacy-peer-deps=true` (vite-plugin-pwa / vite@8 conflict)
- TypeScript 5.7 (not 6) in frontend — `erasableSyntaxOnly` is a TS6-only option, don't use it

## Banned patterns
- No hardcoded dark colors — always use CSS variables
- No localStorage as primary storage for user preferences — backend is source of truth
- No inline event handlers that cause re-renders
- No `setState` calls without proper `useEffect` dependency arrays
- No `limit > 200` in API calls (backend max is 200)
- No direct DOM manipulation — use React state
