# 💰 Rodinné financie

> PWA aplikácia na sledovanie rodinných financií — jednoduchá, rýchla a privacy-first.

[![Deploy to GitHub Pages](https://github.com/hroomnik007/Finance_tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/hroomnik007/Finance_tracker/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?logo=github)](https://hroomnik007.github.io/Finance_tracker/)

---

## 🚀 Live demo

👉 **[https://hroomnik007.github.io/Finance_tracker/](https://hroomnik007.github.io/Finance_tracker/)**

---

## ✨ Funkcie

| Funkcia | Popis |
|---|---|
| 📊 Prehľad | Mesačný dashboard s príjmami, výdavkami a zostatkom |
| 💳 Variabilné výdavky | Manuálne zadávanie s vlastnými kategóriami |
| 🔒 Fixné výdavky | Opakujúce sa výdavky definované používateľom |
| 🎯 Rozpočtové limity | Mesačný limit per kategória s progress barom |
| 📈 Grafy | Vizualizácia výdavkov podľa kategórií |
| 💾 Export / Import | Záloha a obnova dát cez JSON |
| 📱 PWA | Inštalovateľné na mobil (Android/iOS) |
| 🔐 Privacy-first | Všetky dáta zostávajú lokálne v prehliadači |

---

## 🛠️ Tech stack

- **[React 18](https://react.dev/)** + **[Vite 5](https://vitejs.dev/)** — frontend framework
- **[TypeScript](https://www.typescriptlang.org/)** — typová bezpečnosť
- **[Dexie.js](https://dexie.org/)** — IndexedDB wrapper (lokálne ukladanie dát)
- **[Tailwind CSS](https://tailwindcss.com/)** — styling
- **[Recharts](https://recharts.org/)** — grafy a vizualizácie
- **[Vite PWA Plugin](https://vite-pwa-org.netlify.app/)** — PWA podpora

---

## 📦 Inštalácia a spustenie

```bash
# Klonovanie repozitára
git clone https://github.com/hroomnik007/Finance_tracker.git
cd Finance_tracker

# Inštalácia závislostí
npm install

# Spustenie vývojového servera
npm run dev
```

Appka beží na `http://localhost:5173`

---

## 🏗️ Build

```bash
# Produkčný build
npm run build

# Lokálny preview produkčného buildu
npm run preview
```

---

## 📱 Inštalácia ako PWA

1. Otvor appku v Chrome/Safari na mobile
2. Klikni **"Pridať na plochu"** (Add to Home Screen)
3. Appka sa správa ako natívna — funguje aj offline

---

## 🔐 Ochrana súkromia

Všetky dáta sú uložené **výhradne lokálne** v tvojom prehliadači (IndexedDB). Žiadne dáta sa neodosielajú na žiadny server. Export/Import JSON slúži na manuálnu zálohu.

---

## 📄 Licencia

Tento projekt je určený na súkromné použitie.
