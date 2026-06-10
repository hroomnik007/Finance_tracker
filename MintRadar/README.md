# MintRadar ⚡

> A modern, responsive web application for discovering and monitoring Cashu mints.

---

## 🌟 Overview

**MintRadar** monitors Cashu ecash mints in real-time. It automatically discovers mints via **Nostr NIP-87**, tracks their availability, latency, supported NUTs, and software version — all **without tracking users**.

**Live Demo:** [https://mintradar.pedani.eu](https://mintradar.pedani.eu)

---

## ✨ Features

### 🟢 Live Monitoring
- Tests all known mints every 5 minutes
- Real online/offline status with color indicators
- Latency tracking (green <150ms / yellow <400ms / red)

### 📊 Uptime & History
- 24-hour uptime percentage
- Latency sparklines and historical charts
- Automatically hides mints that have been offline for more than 24 hours

### 🔍 NUT Compatibility
- Clear overview of all Cashu NUTs (NUT-00 to NUT-20)
- Click to see description and specification link

### 🏆 Trust Score
- Comprehensive trust score (Uptime 50% + NUTs 30% + Latency 20%)
- Interactive gauge with detailed breakdown

### 👁 Watchlist
- Local favorite mint tracking (IndexedDB)
- Requires Nostr login
- Export/import as JSON

### 🔔 Nostr DM Notifications
- Notifications on mint downtime or recovery
- Sent directly from the browser (NIP-07) — server never sees your keys

### ⚡ Mint Discovery
- Automatic discovery of new mints via Nostr (kind 38172)
- Manual mint addition available

### ✍️ Reviews
- Decentralized mint reviews via Nostr (kind 38000)

---

## 🔒 Privacy First

| Feature          | How it works                                |
|------------------|---------------------------------------------|
| Watchlist        | Stored only in browser (IndexedDB)          |
| Nostr keys       | NIP-07 extension — server never sees them  |
| Analytics        | None                                        |
| Cookies          | None                                        |
| Fonts            | Self-hosted (DM Sans)                       |

---

## 🛠 Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **State:** TanStack Query + Zustand + Dexie
- **Charts:** Recharts
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **Nostr:** nostr-tools
- **Deployment:** Docker + Nginx

---

## 📥 Browser Extension Support

To write reviews you need a Nostr browser extension:

- **[Alby](https://getalby.com/alby-extension)** — recommended (Lightning + Nostr)
- **[nos2x](https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp)** — Chrome / Edge
- **[nos2x-fox](https://addons.mozilla.org/en-US/firefox/addon/nos2x-fox/)** — Firefox

---

## 🔗 Useful Links

- [Live Demo](https://mintradar.pedani.eu)
- [Cashu Protocol](https://cashu.space)
- [Nostr Protocol](https://nostr.com)
- [NIP-87 — Mint Discovery](https://github.com/nostr-protocol/nips/blob/master/87.md)

---

**Built with ⚡ for the Cashu & Nostr community**
