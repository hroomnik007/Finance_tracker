# 💰 FinVu — Rodinné financie

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
| 🔐 Autentifikácia | Email/heslo, Google OAuth, WebAuthn, PIN, Demo účet |
| 👨‍👩‍👧 Domácnosti | Podpora viacerých domácností |
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
git clone https://github.com/hroomnik007/Finance_tracker.git
cd Finance_tracker/finance-tracker

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
