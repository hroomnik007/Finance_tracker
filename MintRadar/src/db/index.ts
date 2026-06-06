import Dexie, { type Table } from 'dexie'

interface Mint {
  url: string
  name?: string
  addedAt: Date
  isPublic: boolean
}

interface MintHistory {
  id?: number
  url: string
  online: boolean
  latencyMs?: number
  checkedAt: Date
}

interface WatchlistEntry {
  url: string
  addedAt: Date
  notifyOnDown: boolean
  notifyOnUp: boolean
}

const db = new Dexie('mintradar-v1') as Dexie & {
  mints: Table<Mint, string>
  mintHistory: Table<MintHistory, number>
  watchlist: Table<WatchlistEntry, string>
}

db.version(1).stores({
  mints: 'url, addedAt, isPublic',
  mintHistory: '++id, url, checkedAt',
  watchlist: 'url, addedAt',
})

export { db }
export type { Mint, MintHistory, WatchlistEntry }
