import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useWatchlistStore } from '@/stores/watchlist.store'
import { fetchRemoteWatchlist, publishWatchlist } from '@/core/nostr/watchlistSync'
import { db } from '@/db'

export function useWatchlistSync() {
  const profile = useAuthStore(s => s.profile)
  const mints = useWatchlistStore(s => s.mints)
  const loadFromDb = useWatchlistStore(s => s.loadFromDb)

  // tracks which pubkey has completed initial sync this session
  const syncedForPubkey = useRef<string | null>(null)

  // Phase 1: on login, load Dexie → fetch remote → merge → publish merged state
  useEffect(() => {
    const pubkey = profile?.pubkey
    if (!pubkey || syncedForPubkey.current === pubkey) return

    const doSync = async () => {
      await loadFromDb()

      const remote = await fetchRemoteWatchlist(pubkey)
      if (remote.length > 0) {
        const local = await db.watchlist.toArray()
        const localUrls = new Set(local.map(e => e.url))
        const toAdd = remote.filter(u => !localUrls.has(u))
        if (toAdd.length > 0) {
          await Promise.all(
            toAdd.map(url =>
              db.watchlist.put({ url, addedAt: new Date(), notifyOnDown: false, notifyOnUp: false })
            )
          )
          await loadFromDb()
        }
      }

      syncedForPubkey.current = pubkey

      // publish the final merged state once
      const finalMints = useWatchlistStore.getState().mints
      await publishWatchlist(pubkey, finalMints)
    }

    void doSync()
  }, [profile?.pubkey, loadFromDb])

  // Phase 2: after initial sync, publish on every subsequent mints change
  useEffect(() => {
    const pubkey = profile?.pubkey
    if (!pubkey || syncedForPubkey.current !== pubkey) return
    void publishWatchlist(pubkey, mints)
  }, [mints, profile?.pubkey])
}
