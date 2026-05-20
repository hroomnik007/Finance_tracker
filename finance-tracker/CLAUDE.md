# Finvu 2026 v3 — CLAUDE.md

## O projekte
PWA aplikácia na sledovanie rodinných financií. Mobile-first, privacy-first.
Inšpirovaná Monarch Money. Hostovaná na `pedani.eu` (Hetzner CX23).
Aktuálna verzia: **Finvu 2026 v3** — design system z `colors_and_type.css` tokenov (DM Sans + DM Mono, CSS variables).

## Tech Stack

### Frontend
- React 19 + TypeScript 5.7 + Vite 8
- Tailwind CSS 4 (Vite plugin)
- Recharts — grafy
- Vite PWA Plugin + Workbox — offline/PWA
- jsPDF + xlsx + papaparse — export (PDF, XLSX, CSV)
- CSV import: Revolut, Tatra banka, SLSP, mBank, 365.bank (via CsvImportModal)
- i18n — SK (primárny jazyk) / EN

### Autentifikácia
- WebAuthn (passkeys)
- Google OAuth
- PIN login
- Demo login
- JWT — Bearer token v pamäti (nie localStorage)
- Refresh token — httpOnly cookie
- Token refresh queue pre súbežné 401 requesty

### Dátová vrstva
- REST API cez axios (`src/api/client.ts`)
- Backend: `https://api.pedani.eu` (Hetzner CX23)
- Dev: `http://localhost:3001` (VITE_API_URL env)
- `src/db/database.ts` je @deprecated — Dexie/IndexedDB nahradená API, možno zmazať

## Štruktúra projektu
```
finance-tracker/src/
├── api/          # axios klient + endpointy:
│   ├── client.ts        # axios inštancia, interceptory, token refresh
│   ├── auth.ts          # login, register, logout, refresh, WebAuthn, Google, PIN, demo, admin
│   ├── transactions.ts  # CRUD pre transakcie
│   ├── categories.ts    # CRUD pre kategórie
│   └── admin.ts         # admin endpointy
├── components/   # 16 React komponentov
├── pages/        # 16 stránok
├── hooks/        # 9 custom hookov
├── context/      # 2 kontexty (auth + app state)
├── i18n/         # SK + EN preklady
├── db/           # DEPRECATED — zmazať
├── types/        # TypeScript typy
└── utils/        # pomocné funkcie
    └── csv365bank.ts    # parser pre 365.bank CSV export
```

## Auth flows (implementované)
- login / register / logout / refreshToken / getMe
- verifyEmail / forgotPassword / resetPassword
- googleLogin / pinLogin / savePin / deletePin
- adminLogin / demoLogin
- WebAuthn register + authenticate (options + verify)
- updateAvatar / updateWeeklyEmail / updateUserSettings
- createSharedReport / getSharedReport
- deleteAccount

## Príkazy
```bash
cd finance-tracker
npm run dev       # dev server → http://localhost:5173 (API → localhost:3001)
npm run build     # produkčný build
npm run preview   # preview buildu
```

## Deployment
- Frontend: GitHub Actions → GitHub Pages
- Backend: Hetzner CX23, `https://api.pedani.eu`
- deploy.sh v root adresári

## Pravidlá pre Claude

### Kód
- Vždy TypeScript — žiadny `any`, žiadne implicitné typy
- Komponenty: funkcionálne + hooks, žiadne class components
- Tailwind triedy — žiadne inline styles ani externé CSS súbory
- Mobile-first — každý komponent najprv pre mobil
- Všetky UI texty cez i18n — žiadne hardcoded strings v SK ani EN

### API a dáta
- Všetky API volania cez `src/api/client.ts` — nikdy priamy fetch/axios mimo klienta
- `src/db/database.ts` je deprecated — nepoužívať, nereferencovať
- Token nikdy do localStorage — iba pamäť (access) + httpOnly cookie (refresh)
- `household_enabled` sa ukladá do DB (`users.household_enabled`) — nie len localStorage
- Stav domácnosti sa číta z `user.household_enabled` (AuthContext) — nie localStorage
- Avatar sa ukladá ako base64 data URL v DB (`users.avatar_url`), max 10MB
- Theme preference: ukladá sa do DB aj localStorage cache

### Deploy
- Server: pedani.eu (Hetzner CX23), deploy cez SSH → `./deploy.sh frontend`
- `.npmrc` má `legacy-peer-deps=true` kvôli vite-plugin-pwa@1.2/vite@8 konfliktu
- Po každej zmene: `git add -A && git commit -m "<popis>" && git push origin main && git push gitea main`
- git remotes: `origin` = GitHub (triggers Actions), `gitea` = self-hosted Gitea
- VŽDY pushuj na oba: `git push origin main && git push gitea main`
- GitHub Actions automaticky nasadí na pedani.eu pri každom push na origin/main

### Štýl práce
- Surgical changes — meniť len čo je potrebné, nič navyše
- Pred implementáciou: krátky plán čo sa zmení a prečo
- Po každej zmene: overiť že `npm run build` prebehne bez chýb
- Pri nejasnostiach: opýtať sa, nie hádať

### Čo netreba vysvetľovať každú session
- Projekt je PWA rodinný finance tracker, backend na api.pedani.eu
- Frontend volá REST API cez axios klienta, nie Dexie
- Auth: WebAuthn + Google OAuth + PIN + JWT/httpOnly cookies
- database.ts je deprecated
- Žiadny TweaksPanel — bol odstránený
- Notifikácie (NotificationCenter.tsx): generované z API, read stav sa persistuje do `localStorage` kľúča `finvu_read_notifications`
- Topbar má `NotificationCenter` ako self-contained komponent (vlastný state, vlastné API volania)

## Serverové poznámky (pedani.eu)
- NIKDY nespúšťať build/deploy príkazy ako root (sudo) — spôsobuje permission problémy
- Ak nastane EACCES/permission denied: `sudo chown -R deploy:deploy /var/www/finance-tracker-repo /var/www/finance-tracker`
- .env súbor pre frontend: `/var/www/finance-tracker-repo/finance-tracker/.env` s `VITE_API_URL=https://api.pedani.eu`
- Backend .env: `/var/www/finance-tracker-api/.env`

## Backend infraštruktúra

### Docker
- Backend beží ako Docker container: `finance-tracker-repo-backend-1`
- PostgreSQL beží ako separátny Docker container: `finance-tracker-postgres-1`
- Príkazy (BEZ pomlčky — nová syntax):
```bash
docker compose restart backend
docker compose logs backend --tail=50
docker compose up --build -d
```
- **NIKDY nepoužívať `docker-compose` (s pomlčkou)** — na tomto serveri nie je k dispozícii

### Nginx
- Config: `/etc/nginx/sites-enabled/api.pedani.eu.conf`
- `client_max_body_size 20M` — potrebné pre avatar upload (base64 ~5MB)
- Po zmene nginx configu: `sudo nginx -t && sudo systemctl reload nginx`

### Rate limiting (`backend/src/routes/auth.ts`)
- `registerLimiter`: 5 req / 15 min
- `loginLimiter`: 10 req / 15 min
- `refreshLimiter`: 200 req / 15 min — **MUSÍ byť vysoký**, inak F5 spôsobuje logout
- `generalLimiter`: 20 req / 15 min
- `refreshLimiter` **NESMIE** používať custom `keyGenerator` s `req.ip` priamo (IPv6 bug)

### Avatar upload
- Max veľkosť: 10MB (kontrolované v `auth.controller.ts` — `avatarUrl.length > 10 * 1024 * 1024`)
- Formát: base64 data URL poslaný ako JSON `{ avatarUrl: string }`
- Nginx limit: 20M, Express limit: 15mb

---

## Layout & UI pravidlá

### Grid a šírky
- Main content wrapper v App.tsx: `className="flex-1 overflow-y-auto w-full min-w-0"`
- Content div inside main: `className="w-full h-full p-6"`
- NIKDY nepoužívať `max-w-*` na page-level komponentoch (Dashboard, Income, atď.)
- Dashboard 2-stĺpcový layout: `grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-6 w-full`
  - Ľavý stĺpec: hlavný obsah (rastie)
  - Pravý stĺpec: kontextový panel (fixed 340–380px)

### Sidebar
- Expanded: šírka `240px`, main má `lg:ml-[240px]`
- Collapsed: šírka `64px`, main má `lg:ml-[64px]`
- Sidebar: `position: fixed`, `z-index` nad contentom
- Prechod: `transition-all duration-200` na sidebar aj main

### Farby a pozadie
- Page background: `#0f0a1e`
- Sticky greeting row: `background: #0f0a1e`, `position: sticky`, `top: 0`, `zIndex: 20`
- Greeting margin kompenzácia: `margin: -24px -24px 0 -24px`, `padding: 16px 24px 12px`

### Dashboard — sekcie (v3)
**Hero karta** (gradient wallet card):
- Poradie: ZOSTATOK label → veľké číslo + úspora badge (top-right) → tx pill → divider → PRÍJMY/VÝDAVKY 2-col grid
- Úspora badge: `↑ X % úspora`, padding 8px 16px, fontWeight 700, fontSize 13, `#34d399`, `rgba(52,211,153,0.2)` bg
- PRÍJMY/VÝDAVKY: % zmena vs predchádzajúci mesiac (↑/↓ badge), animované sumy cez `useCountUp`

**Ľavý stĺpec** (desktop grid): hero karta → heatmap + donut (grid-cols-2)
**Mobilný layout**: hero → donut → heatmap → pravý panel

**Donut graf** (`pieChartCard`):
- Hover segment alebo legend → segment sa vysunie + legenda stučnie (priority: click > legendHover > pieHover)
- Klik → uzamkne výber; klik znovu → odznačí
- Center: pri výbere → ikona + názov + suma + %; bez výberu → celková suma + "celkom"
- State: `activeIndex` (pie hover), `legendHoverIndex` (legend hover), `clickedIndex` (locked)

**Pravý panel** — karty:
1. **Nadchádzajúce platby** — fixné výdavky zoradené podľa dní do splatnosti
2. **Rozpočet** — category progress bars (green <70%, yellow 70–90%, red >90%)
3. Motivačná správa (ak relevantná)
4. Porovnanie mesiacov — aktuálny vs predchádzajúci
5. Mesačná výzva — progress bar voči minulému mesiacu
6. Sporenie — ciele (ak `savings_enabled`)

**Odstránené sekcie** (v3):
- Vývoj príjmov a výdavkov (AreaChart + BarChart)
- Predikcia výdavkov (ForecastCard + expensePrediction block)
- Posledné transakcie v pravom paneli
- Standalone Úspora karta (donut ring "51% Výborne!")
- Bento stat cards pod hero kartou

### Responsive pravidlo
- Desktop (lg+): sidebar + 2-stĺpcový grid
- Mobile: bottom pill nav, single column, FAB pre pridávanie

### Topbar
- Desktop: 2 sekcie — ľavá (greeting 22px bold + dátum) | pravá (toggle + monthNav + themeBtn + avatar)
- Mobile: 2 riadky — Row1: logo + greeting + avatar | Row2: monthNav + toggle (len na relevantných stránkach)
- Theme toggle: ☀️/🌙 button v Topbar (desktop aj mobile) — mení `data-theme` na `<html>` + localStorage

### Login/Register stránky
- Background: `var(--bg)` — NIE hardcoded `#0a0814` (kvôli light mode kompatibilite)
- Input polia: theme-aware — svetlé pozadie v light mode cez `inputStyle(focused, theme)` funkciu
- Theme toggle: `position: fixed, top: 16, right: 16` — dostupný pred prihlásením

### CsvImportModal
- Podporované banky: Revolut, Tatra banka, SLSP, mBank, 365.bank, Vlastný CSV
- 365.bank: semicolon delimiter, stĺpce `Dátum`/`Popis`/`Suma`/`Mena`/`Zostatok`
- Dostupný v: Príjmy, Variabilné výdavky, Fixné výdavky

### Kategórie
- Desktop header button: `Pridať kategóriu` (BEZ leading `+` — `Plus` ikona ho už zobrazuje)
- Celkové využitie rozpočtu: summary bar nad gridom — `totalSpent`/`totalLimit` zo všetkých kategórií s limitom

### Domácnosť
- Názov domácnosti sa zobrazuje s prefixom `"Rodina "` — napr. `"Rodina Bližňákovcov"`
- Default dashboard view: `family` keď `householdEnabled === true` a nie je uložená preferencia

## Known patterns & conventions
- **BottomSheet swipe-to-close**: drag handle + header area are touch targets. Swipe down >80px closes with 250ms slide-out animation. `translateY` state + `isDragging` ref control the gesture. `touchAction: 'none'` on panel prevents scroll conflict.
- **BottomSheet `onImportCsv` prop**: optional prop — when provided, shows a 36×36px `FileUp` icon button in the header (right of title, left of close). Only pass when NOT in edit mode. On click: close sheet first, open CSV modal after 150ms timeout.
- **Import CSV button — desktop**: outlined style — `height: 40px`, `padding: 0 20px`, `borderRadius: 12px`, `border: 1.5px solid var(--violet)`, `background: transparent`, hover `rgba(124,58,237,0.08)`. Same height as primary Pridať button.
- **Import CSV button — mobile**: removed from header row entirely. Accessible via BottomSheet header icon when user taps FAB.
- **Header row — mobile**: Income, VariableExpenses, FixedExpenses pages use `className="hidden lg:flex"` on the header row — completely hidden on mobile. FAB handles add action, BottomSheet header handles Import CSV.
- **dashView default**: initializes from `localStorage || 'family'`. Force-reset to `'personal'` only fires after `!isLoading && user && !householdEnabled` — never before user data is loaded. Complementary effect sets `'family'` when household becomes enabled and no saved preference exists.
- **Pie chart interaction**: outer `pieChartCard` div has `onClick={() => { setClickedIndex(null); setLegendHoverIndex(null) }}`. Pie wrapper stops propagation. Three states: `activeIndex` (pie hover), `legendHoverIndex` (legend hover), `clickedIndex` (locked click). Effective display index = `clickedIndex ?? legendHoverIndex ?? activeIndex`. Legend items highlight on hover AND click. Segment expands for all three states via `activeShape={renderPieShape}`.
- **Settings useEffect**: NEVER call `html.setAttribute('data-theme', ...)` in Settings mount useEffect. Theme is managed by App.tsx IIFE on load and Topbar/Login `toggleTheme`. Settings only applies accent color and compact mode on mount.
- **Theme toggle buttons in Settings**: column layout (icon 18px above label 11px), `minWidth: 56px`, `padding: 8px 12px`, `borderRadius: 12px`, violet border+bg when active, `var(--bg3)` when inactive.
- **MutationObserver for theme reactivity**: ExpenseHeatmap, Settings theme state, and Topbar theme state all use `MutationObserver` on `document.documentElement` watching `data-theme` attribute to stay in sync when theme changes from another component.
- **Login/Register light mode**: background uses `var(--bg)` not hardcoded `#0a0814`. Input styles use theme-aware colors via `inputStyle(focused, theme)` function. Google button background/color also theme-aware.

## Modules
- **BottomSheet** (`components/BottomSheet.tsx`): props: `open`, `onClose`, `title`, `children`, `footer?`, `onImportCsv?`. Mobile: slides up from bottom with drag-to-close. Desktop: centered modal. Drag handle + header are swipe targets on mobile.

## Key constraints
- `BottomSheet` `onImportCsv` must be `undefined` when in edit mode — import only makes sense when adding new records
- Never render both mobile and desktop Import CSV buttons simultaneously — use `hidden lg:flex` / `lg:hidden` pattern
- `dashView` force-reset to `'personal'` requires `user` to be loaded — add `&& user` guard to prevent premature reset on initial render
