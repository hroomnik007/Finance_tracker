import { create } from 'zustand'

interface WatchlistState {
  mints: string[]
}

export const useWatchlistStore = create<WatchlistState>()(() => ({
  mints: [],
}))
