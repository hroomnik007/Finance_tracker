<p align="center">
  <img src="finance-tracker/public/icon-192.png" width="80" alt="Finvu" />
</p>

# Finvu — Rodinné financie / Family Finance Tracker

> PWA aplikácia na sledovanie rodinných financií — jednoduchá, rýchla, s cloudovou synchronizáciou.
> A PWA application for tracking family finances — simple, fast, with cloud synchronization.

---

## ✨ Funkcie / Features

| Funkcia | Popis | Feature | Description |
|---|---|---|---|
| 📊 Prehľad | Mesačný dashboard s príjmami, výdavkami a zostatkom | Dashboard | Monthly overview with income, expenses and balance |
| 💳 Variabilné výdavky | Manuálne zadávanie s vlastnými kategóriami a limitmi | Variable expenses | Manual entry with custom categories and budget limits |
| 🔒 Fixné výdavky | Opakujúce sa výdavky definované používateľom | Fixed expenses | User-defined recurring expenses |
| 🐷 Sporenie | Ciele sporenia s sledovaním pokroku | Savings | Savings goals with progress tracking |
| 📈 Grafy | Vizualizácia výdavkov podľa kategórií (Recharts) | Charts | Expense visualization by category (Recharts) |
| 💾 Export | JSON, CSV, XLSX export transakcií s plnou históriou | Export | JSON, CSV, XLSX export with full history |
| 📥 Import | CSV import transakcií (365.bank formát a vlastný) | Import | CSV import (365.bank format and custom) |
| 📱 PWA | Inštalovateľné na mobil (Android/iOS) | PWA | Installable on mobile (Android/iOS) |
| 🔐 Autentifikácia | Email/heslo, Google OAuth, PIN, Demo účet | Authentication | Email/password, Google OAuth, PIN, Demo account |
| 👨‍👩‍👧 Domácnosti | Podpora viacerých domácností | Households | Multi-household support |
| 🌍 i18n | Slovenčina / Angličtina | i18n | Slovak / English |

---

## 🛠️ Tech stack

### Frontend
- **React 19** + **Vite 8** — frontend framework
- **TypeScript** — typová bezpečnosť / type safety
- **Tailwind CSS 4** — styling
- **Recharts** — grafy a vizualizácie / charts and visualizations
- **Vite PWA Plugin** — PWA podpora / PWA support
- **axios** — HTTP klient s JWT interceptormi / HTTP client with JWT interceptors

### Backend
- **Node.js / Express** — REST API
- **PostgreSQL** — databáza / database
- **Docker** — kontajnerizácia / containerization
- **JWT** — autentifikácia (httpOnly cookies) / authentication (httpOnly cookies)

### Infraštruktúra / Infrastructure
- **Hetzner CX23** — VPS (Debian 13)
- **Nginx** — reverse proxy + SSL
- **GitHub Actions** — CI/CD pipeline
- **Let's Encrypt** — SSL certifikáty / SSL certificates

---

## 🌐 Live

| | URL |
|---|---|
| Frontend | https://finvu.pedani.eu |
| API | https://api.pedani.eu |

---

## 📦 Lokálny vývoj / Local development

```bash
# Klonovanie / Clone
git clone https://github.com/hroomnik007/Finvu.git
cd Finvu/finance-tracker

# Inštalácia / Install
npm install --legacy-peer-deps

# Vývojový server / Dev server
npm run dev
```

Vyžaduje / Requires `.env` s / with `VITE_API_URL=https://api.pedani.eu`

## 🏗️ Build + Deploy

```bash
# Produkčný build / Production build
npm run build

# Deploy prebieha automaticky cez GitHub Actions pri push na main
# Deploy runs automatically via GitHub Actions on push to main
```

## 📄 Licencia / License
Súkromné použitie / Private use.
