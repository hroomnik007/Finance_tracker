# MintRadar ⚡

> A modern, responsive web application for discovering and monitoring Cashu mints.

---

## 🌟 Overview

**MintRadar** monitors Cashu ecash mints in real-time. It automatically discovers mints via **Nostr NIP-87** and **audit.8333.space**, tracks their availability, latency, supported NUTs, and software version — all **without tracking users**.

**Live Demo:** [https://mintradar.pedani.eu](https://mintradar.pedani.eu)

---

## ✨ Features

### 🟢 Live Monitoring
- Tests all known mints every 5 minutes
- Real online/offline status with color indicators
- Latency measured server-side from Frankfurt, DE (displayed in neutral white — no color coding)
- "Show my latency" button for client-side latency test directly in the browser

### 📊 Uptime & History
- 24-hour uptime percentage with color indicators (green/yellow/red)
- Latency sparklines and historical charts powered by PostgreSQL data
- Automatically hides mints that have been offline for more than 24 hours

### 🔍 NUT Compatibility
- Overview of 14 tracked Cashu NUTs (NUT-04, NUT-05, NUT-07 to NUT-12, NUT-14, NUT-15, NUT-17, NUT-19, NUT-20, NUT-29)
- Click any NUT card to see description, supported features, and link to specification
- Min/max amount limits displayed for NUT-04 (Mint tokens) and NUT-05 (Melt tokens)

### 🏆 Trust Score
- Composite trust score with interactive breakdown modal:
  - **Uptime 45%** — based on 24h availability
  - **NUT Support 30%** — number of supported NUT specifications
  - **Version freshness 15%** — recency of mint software vs. latest Nutshell releases
  - **Contact info 5%** — number of contact methods provided (email, Twitter, Nostr, website)
  - **Audit reliability 5%** — error rate from audit.8333.space
- Each breakdown row has a hover tooltip explaining the scoring

### 🛡 Audit Stats
- Integration with **audit.8333.space** — real third-party mint audits
- Displays mint ops, melt ops, and error counts per mint
- Audit reliability score feeds into Trust Score

### 👁 Watchlist
- Local favorite mint tracking (IndexedDB) — requires Nostr login
- Synced across devices as **NIP-44 encrypted kind:10003** events to Nostr relays when logged in
- Export as **JSON** or **CSV**
- Sort by Status, Latency, Name, or Trust Score with ascending/descending toggle

### 🔔 Nostr DM Notifications
- Notifications on mint downtime or recovery
- Sent directly from the browser (NIP-07) — server never sees your keys

### ⚡ Mint Discovery
- Automatic discovery via **Nostr kind 38172** (relays: damus.io, nos.lol, primal.net, cashumints.space, azzamo.net, snort.social, purplepag.es)
- Additional discovery via **audit.8333.space API**
- Manual mint submission by **URL** or **Nostr npub** (resolves the mint URL from the profile)
- Dashboard sort by Status, Latency, Name, or Trust Score with ascending/descending toggle

### ✍️ Reviews
- Decentralized mint reviews via Nostr (kind 38000)

---

## 🔒 Privacy First

| Feature          | How it works                                                                          |
|------------------|---------------------------------------------------------------------------------------|
| Watchlist        | Stored in browser (IndexedDB) + optionally synced as NIP-44 encrypted kind:10003     |
| Nostr keys       | NIP-07 extension — server never sees them                                             |
| Analytics        | None                                                                                  |
| Cookies          | None                                                                                  |
| Fonts            | Self-hosted (DM Sans)                                                                 |

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
