# Rodinné financie — CLAUDE.md

## O projekte
PWA aplikácia na sledovanie rodinných financií. Mobile-first, privacy-first.
Inšpirovaná Monarch Money. Hostovaná na `pedani.eu` (Hetzner CX23).

## Tech Stack

### Frontend
- React 19 + TypeScript 6 + Vite 8
- Tailwind CSS 4 (Vite plugin)
- Recharts — grafy
- Vite PWA Plugin + Workbox — offline/PWA
- jsPDF + xlsx + papaparse — export (PDF, XLSX, CSV)
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

### Deploy
- Server: pedani.eu (Hetzner CX23), deploy cez SSH → `./deploy.sh frontend`
- `.npmrc` má `legacy-peer-deps=true` kvôli vite-plugin-pwa@1.2/vite@8 konfliktu
- Po každej zmene: `git add -A && git commit -m "<popis>" && git push origin main && git push gitea main` → SSH → `./deploy.sh frontend`

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

## Serverové poznámky (pedani.eu)
- NIKDY nespúšťať build/deploy príkazy ako root (sudo) — spôsobuje permission problémy
- Ak nastane EACCES/permission denied: `sudo chown -R deploy:deploy /var/www/finance-tracker-repo /var/www/finance-tracker`
- .env súbor pre frontend: `/var/www/finance-tracker-repo/finance-tracker/.env` s `VITE_API_URL=https://api.pedani.eu`
- Backend .env: `/var/www/finance-tracker-api/.env`
