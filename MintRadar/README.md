# MintRadar
Privacy-first Cashu mint monitoring PWA.
Built with React 18 + TypeScript + Vite + Tailwind + Nostr login (NIP-07).

## Stack
- React 18 + TypeScript + Vite 5
- Zustand + Dexie (IndexedDB) — all personal data stays in browser
- nostr-tools (NIP-07 login, DM notifications)
- TanStack Query v5
- vite-plugin-pwa

## Architecture
- Public dashboard: known mints fetched server-side
- Personal watchlist: stored locally in IndexedDB only
- Nostr login: NIP-07 browser extension, keys never leave browser
