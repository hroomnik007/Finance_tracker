# Finvu — Financie pod kontrolou

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

<p align="center">
  <img src="finance-tracker/public/logo.svg" alt="Finvu logo" width="80" height="80" />
</p>

<p align="center">
  <strong>Moderná PWA aplikácia na správu rodinných financií</strong><br/>
  Sledujte príjmy, výdavky, sporenie a rozpočet pre celú domácnosť na jednom mieste.
</p>

<p align="center">
  <a href="https://finvu.pedani.eu">🌐 finvu.pedani.eu</a>
</p>

---

## Funkcie

- **Dashboard** — prehľad príjmov, výdavkov a zostatku s heatmapou a donut grafom
- **Variabilné výdavky** — kategorizácia, import z banky (Revolut, Tatra banka, SLSP, mBank, 365.bank)
- **Fixné výdavky** — opakujúce sa platby s upozorneniami pred splatnosťou
- **Sporenie** — ciele s progress trackingom, pozastavenie/obnovenie, deep link
- **Domácnosť** — zdieľané financie, prehľad podľa členov domácnosti
- **Rozpočet** — limity na kategórie, auto-limit z fixných výdavkov, vizuálny progress
- **5 jazykov** — SK, CS, PL, HU, EN s automatickou detekciou jazyka prehliadača
- **PWA** — inštalovateľné na mobile aj desktop, offline podpora
- **Dark / Light mode**
- **Export** — PDF, XLSX, CSV

---

## Demo

| | |
|---|---|
| URL | https://finvu.pedani.eu |
| Email | `demo@finvu.sk` |
| Heslo | `demo123` |

Demo účet je predvyplnený realistickými dátami: príjmy, výdavky, sporenie, domácnosť s členmi.

---

## Tech stack

### Frontend
- **React 19** + **TypeScript 5.7** + **Vite 8**
- **Tailwind CSS 4**
- **i18n** — vlastný typovaný systém (5 jazykov, 413 kľúčov)
- **Recharts** — grafy
- **PWA** — Vite PWA Plugin + Workbox (Service Worker)
- **Export** — jsPDF, xlsx, papaparse

### Backend
- **Node.js** + **Express** + **TypeScript**
- **PostgreSQL** + **Drizzle ORM**
- **JWT** (access token v pamäti) + **httpOnly cookie** (refresh token)
- **WebAuthn** Google OAuth, PIN login

### Infraštruktúra
- **Docker** + **Docker Compose** (backend + PostgreSQL)
- **GitHub Actions** — automatický CI/CD deploy na každý push na `main`
- **VPS server** (backend API)
- Frontend: https://finvu.pedani.eu

---

## Lokálny vývoj

### Požiadavky

- Node.js 22+
- Docker + Docker Compose

### Frontend

```bash
cd finance-tracker
cp .env.example .env          # nastaviť VITE_API_URL=http://localhost:3001
npm install
npm run dev                   # → http://localhost:5173
```

### Backend

```bash
cd backend
cp .env.example .env          # nastaviť DATABASE_URL, JWT_SECRET, atď.
docker compose up -d postgres # spustiť iba databázu
npm install
npm run migrate               # spustiť migrácie
npm run dev                   # → http://localhost:3001
```

### Databázové migrácie

```bash
# Lokálne
npm run migrate

# Produkcia (v Docker kontajneri)
docker exec <backend-container> node dist/scripts/migrate.js
```

Migrácie sú číslované SQL súbory v `backend/migrations/` a spúšťajú sa automaticky pri deployi.

---

## Deployment

Každý push na `main` spustí automatický build a deploy.

---

## Self-hosting

### Požiadavky

- VPS s min. **2 GB RAM** (odporúčané 4 GB)
- **Docker** + **Docker Compose** (v2)
- **Nginx** ako reverse proxy
- Vlastná doména a SSL certifikát (Certbot)

### Inštalácia krok za krokom

**1. Klonovanie repozitára**

```bash
git clone https://github.com/hroomnik/finvu.git
cd finvu
```

**2. Konfigurácia prostredí**

```bash
# Backend
cp backend/.env.example backend/.env
nano backend/.env

# Frontend
cp finance-tracker/.env.example finance-tracker/.env
nano finance-tracker/.env   # nastaviť VITE_API_URL=https://api.vasadomena.sk
```

**3. Spustenie kontajnerov**

```bash
docker compose up -d
```

**4. Spustenie databázových migrácií**

```bash
docker exec finvu-backend-1 node dist/scripts/migrate.js
```

**5. Nginx — príklad konfigurácie**

```nginx
# /etc/nginx/sites-available/api.vasadomena.sk
server {
    listen 443 ssl;
    server_name api.vasadomena.sk;

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    ssl_certificate /etc/letsencrypt/live/api.vasadomena.sk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.vasadomena.sk/privkey.pem;
}
```

**6. SSL certifikát (Certbot)**

```bash
certbot --nginx -d api.vasadomena.sk -d vasadomena.sk
```

### Premenné prostredia

#### Backend (`backend/.env`)

| Premenná | Povinná | Popis |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (`postgresql://user:pass@postgres:5432/db`) |
| `JWT_ACCESS_SECRET` | ✅ | Tajný kľúč pre access tokeny (min. 32 znakov) |
| `JWT_REFRESH_SECRET` | ✅ | Tajný kľúč pre refresh tokeny (min. 32 znakov) |
| `JWT_ADMIN_SECRET` | ✅ | Tajný kľúč pre admin tokeny (min. 32 znakov) |
| `ADMIN_USERNAME` | ✅ | Meno admin účtu |
| `ADMIN_PASSWORD` | ✅ | Heslo admin účtu (min. 12 znakov) |
| `PORT` | — | Port backendu (predvolene `3001`) |
| `NODE_ENV` | — | `production` alebo `development` |
| `BCRYPT_ROUNDS` | — | Počet bcrypt kôl (predvolene `12`) |
| `APP_URL` | — | URL frontendu (predvolene `https://finvu.pedani.eu`) |
| `SMTP_HOST` | — | SMTP server pre e-maily |
| `SMTP_PORT` | — | SMTP port (predvolene `587`) |
| `SMTP_USER` | — | SMTP prihlasovacie meno |
| `SMTP_PASS` | — | SMTP heslo |
| `SMTP_FROM` | — | Odosielateľ e-mailov |
| `GOOGLE_CLIENT_ID` | — | Google OAuth Client ID (ak chcete Google login) |
| `WEBAUTHN_ORIGIN` | — | WebAuthn origin (`https://vasadomena.sk`) |
| `WEBAUTHN_RP_ID` | — | WebAuthn relying party ID (`vasadomena.sk`) |

#### Frontend (`finance-tracker/.env`)

| Premenná | Povinná | Popis |
|---|---|---|
| `VITE_API_URL` | ✅ | URL backendu (`https://api.vasadomena.sk`) |

### Poznámka k licencii (AGPL-3.0)

Tento projekt je licencovaný pod **GNU AGPL v3**. Ak prevádzkujete upravenú verziu ako sieťovú službu, **ste povinní zverejniť zdrojový kód** svojich úprav za rovnakých podmienok. Pozrite [LICENSE](LICENSE) pre detaily.

---

## Autentifikácia

Podporované metódy:

| Metóda | Popis |
|---|---|
| Email + heslo | Štandardná registrácia |
| Google OAuth | Prihlásenie cez Google účet |
| PIN | Rýchle prihlásenie PIN kódom |
| Demo | Testovací účet bez registrácie |

---
## License

This project is licensed under the GNU Affero General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
