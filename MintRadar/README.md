# MintRadar 🔭

Privacy-first Cashu mint monitoring PWA.

## What is MintRadar?

MintRadar tracks the health and availability of [Cashu](https://cashu.space) ecash mints — decentralized, privacy-preserving Bitcoin payment infrastructure.

## Why MintRadar?

- **Zero tracking** — no accounts, no emails, no server-side user data
- **Local-first** — your personal watchlist lives in your browser only
- **Nostr-native** — login with your Nostr identity (NIP-07), get notified via DMs
- **Open source** — MIT license, self-hostable

## Features

- 📡 Live status monitoring of public Cashu mints
- ⚡ Latency tracking and uptime history
- 🔍 NUT compatibility matrix per mint
- 👁 Personal watchlist (stored locally in IndexedDB)
- 🔐 Nostr login via NIP-07 browser extension
- 📊 Historical latency graphs (Recharts)
- 🔎 Search and sort mints by status, latency, name
- 📥 Export watchlist as JSON

## Stack

- React 18 + TypeScript + Vite 5
- Zustand + Dexie (IndexedDB) — personal data never leaves your browser
- nostr-tools — NIP-07 login, NIP-87 mint discovery
- TanStack Query v5 + Recharts
- Node.js/Express backend proxy (CORS, SSRF protection)
- PostgreSQL — public mint history only
- vite-plugin-pwa — installable PWA

## Architecture
```
Browser                          Server (Hetzner)
───────────────────────────────  ──────────────────────────────
Personal watchlist → IndexedDB   Public mint history → PostgreSQL
Nostr login → NIP-07 extension   Cron every 5min → probe mints
Mint probing → /api/mint/probe   Express proxy → bypass CORS
```

## Privacy

Personal watchlist data is stored **exclusively in your browser** (IndexedDB). The server only stores public mint URLs and their uptime history — no user data, no tracking, no analytics.

## Live

[mintradar.pedani.eu](https://mintradar.pedani.eu)

## License

MIT
