import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useWatchlistStore } from '@/stores/watchlist.store'
import { SimplePool } from 'nostr-tools/pool'
import type { NostrEvent } from 'nostr-tools'

const NOTIFICATION_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://purplepag.es',
]

// Track previous online states to detect transitions
const prevStates = new Map<string, boolean>()

export function useWatchlistNotifications(
  probeData: Record<string, { online: boolean; latencyMs: number | null } | undefined>
) {
  const profile = useAuthStore(s => s.profile)
  const { mints: watchlist } = useWatchlistStore()
  const poolRef = useRef<SimplePool | null>(null)

  useEffect(() => {
    if (!poolRef.current) poolRef.current = new SimplePool()
    return () => { poolRef.current?.destroy(); poolRef.current = null }
  }, [])

  useEffect(() => {
    if (!profile?.pubkey) return
    if (!window.nostr) return

    const checkTransitions = async () => {
      for (const url of watchlist) {
        const current = probeData[url]
        if (!current) continue

        const prev = prevStates.get(url)
        const isOnline = current.online

        // Detect online → offline transition
        if (prev === true && isOnline === false) {
          console.log(`[notifications] mint down: ${url}`)
          await sendNostrDM(
            profile.pubkey,
            `⚠️ MintRadar Alert\n\nMint is down: ${url}\n\nCheck status: https://mintradar.pedani.eu`,
            poolRef.current!
          )
        }

        // Detect offline → online transition
        if (prev === false && isOnline === true) {
          console.log(`[notifications] mint recovered: ${url}`)
          await sendNostrDM(
            profile.pubkey,
            `✅ MintRadar Alert\n\nMint is back online: ${url}\n\nLatency: ${current.latencyMs}ms`,
            poolRef.current!
          )
        }

        prevStates.set(url, isOnline)
      }
    }

    checkTransitions()
  }, [probeData, watchlist, profile])
}

async function sendNostrDM(recipientPubkey: string, content: string, pool: SimplePool) {
  try {
    if (!window.nostr) return

    // Encrypt content using NIP-04 via extension
    const encrypted = await window.nostr.nip04?.encrypt(recipientPubkey, content)
    if (!encrypted) {
      console.warn('[notifications] nip04 encrypt not available')
      return
    }

    const event = {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', recipientPubkey]],
      content: encrypted,
    }

    const signed = await window.nostr.signEvent(event) as NostrEvent
    if (!signed) return

    await Promise.any(
      NOTIFICATION_RELAYS.map(relay =>
        pool.publish([relay], signed)
      )
    )

    console.log('[notifications] DM sent successfully')
  } catch (err) {
    console.warn('[notifications] failed to send DM:', err)
  }
}
