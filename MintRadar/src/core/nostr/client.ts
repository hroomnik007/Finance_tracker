import { nip19 } from 'nostr-tools'

declare global {
  interface Window {
    nostr?: { getPublicKey(): Promise<string> }
  }
}

export interface NostrProfile {
  pubkey: string
  npub: string
  name?: string
  picture?: string
}

export function isNip07Available(): boolean {
  return typeof window !== 'undefined' && window.nostr !== undefined
}

export async function loginWithNip07(): Promise<NostrProfile> {
  if (!isNip07Available()) {
    throw new Error('NIP-07 extension not available')
  }
  // window.nostr is defined — checked above
  const pubkey = await window.nostr!.getPublicKey()
  const npub = nip19.npubEncode(pubkey)
  return { pubkey, npub }
}
