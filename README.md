<img width="72" height="72" alt="pwa-72x72" src="https://github.com/user-attachments/assets/51a1a231-48ab-4caf-9bb3-b241da102812" />

# Finvu — Rodinné financie / Family Finance Tracker

> PWA aplikácia na sledovanie rodinných financií — jednoduchá, rýchla, s cloudovou synchronizáciou.

## ✨ Funkcie

| Funkcia | Popis |
|---|---|
| 📊 Prehľad | Mesačný dashboard s príjmami, výdavkami a zostatkom |
| 💳 Variabilné výdavky | Manuálne zadávanie s vlastnými kategóriami a rozpočtovými limitmi |
| 🔒 Fixné výdavky | Opakujúce sa výdavky definované používateľom |
| 📈 Grafy | Vizualizácia výdavkov podľa kategórií (Recharts) |
| 💾 Export | JSON, CSV, XLSX export transakcií s plnou históriou |
| 📥 Import | CSV import transakcií (365.bank formát a vlastný) |
| 📱 PWA | Inštalovateľné na mobil (Android/iOS) |
| 🔐 Autentifikácia | Email/heslo, Google OAuth, PIN, Demo účet |
| 👨‍👩‍👧 Domácnosti | Podpora viacerých domácností |
| 🐷 Sporenie | Ciele sporenia s sledovaním pokroku |
| 🌍 i18n | Slovenčina / Angličtina |

## 🛠️ Tech stack

### Frontend
- **React 19** + **Vite 8** — frontend framework
- **TypeScript** — typová bezpečnosť
- **Tailwind CSS 4** — styling
- **Recharts** — grafy a vizualizácie
- **Vite PWA Plugin** — PWA podpora
- **axios** — HTTP klient s JWT interceptormi

### Backend
- **Node.js / Express** — REST API
- **PostgreSQL** — databáza
- **Docker** — kontajnerizácia
- **JWT** — autentifikácia (httpOnly cookies)

### Infraštruktúra
- **Hetzner CX23** — VPS (Debian 13)
- **Nginx** — reverse proxy + SSL
- **GitHub Actions** — CI/CD pipeline
- **Let's Encrypt** — SSL certifikáty

## 🌐 Live

| | URL |
|---|---|
| Frontend | https://finvu.pedani.eu |
| API | https://api.pedani.eu |

## 📦 Lokálny vývoj

```bash
# Klonovanie
git clone https://github.com/hroomnik007/Finvu.git
cd Finvu/finance-tracker

# Inštalácia
npm install --legacy-peer-deps

# Vývojový server
npm run dev
```

Vyžaduje `.env` s `VITE_API_URL=https://api.pedani.eu`

## 🏗️ Build + Deploy

```bash
# Produkčný build
npm run build

# Deploy prebieha automaticky cez GitHub Actions pri push na main
```

## 📄 Licencia

Súkromné použitie.

---

<p align="center">
  <img src="finance-tracker/public/icon-192.png" width="80" alt="Finvu" />
</p>

# Finvu — Family Finance Tracker

> A PWA application for tracking family finances — simple, fast, with cloud synchronization.

## ✨ Features

| Feature | Description |
|---|---|
| 📊 Dashboard | Monthly overview with income, expenses and balance |
| 💳 Variable expenses | Manual entry with custom categories and budget limits |
| 🔒 Fixed expenses | User-defined recurring expenses |
| 🐷 Savings | Savings goals with progress tracking |
| 📈 Charts | Expense visualization by category (Recharts) |
| 💾 Export | JSON, CSV, XLSX export with full history |
| 📥 Import | CSV import (365.bank format and custom) |
| 📱 PWA | Installable on mobile (Android/iOS) |
| 🔐 Authentication | Email/password, Google OAuth, PIN, Demo account |
| 👨‍👩‍👧 Households | Multi-household support |
| 🌍 i18n | Slovak / English |

## 🛠️ Tech stack

### Frontend
- **React 19** + **Vite 8** — frontend framework
- **TypeScript** — type safety
- **Tailwind CSS 4** — styling
- **Recharts** — charts and visualizations
- **Vite PWA Plugin** — PWA support
- **axios** — HTTP client with JWT interceptors

### Backend
- **Node.js / Express** — REST API
- **PostgreSQL** — database
- **Docker** — containerization
- **JWT** — authentication (httpOnly cookies)

### Infrastructure
- **Hetzner CX23** — VPS (Debian 13)
- **Nginx** — reverse proxy + SSL
- **GitHub Actions** — CI/CD pipeline
- **Let's Encrypt** — SSL certificates

## 🌐 Live

| | URL |
|---|---|
| Frontend | https://finvu.pedani.eu |
| API | https://api.pedani.eu |

## 📦 Local development

```bash
git clone https://github.com/hroomnik007/Finvu.git
cd Finvu/finance-tracker
npm install --legacy-peer-deps
npm run dev
```

Requires `.env` with `VITE_API_URL=https://api.pedani.eu`

## 🏗️ Build + Deploy

```bash
npm run build
# Deploy runs automatically via GitHub Actions on push to main
```

## 📄 License

Private use.
