import { parse, IPv4, IPv6 } from 'ipaddr.js'
import { lookup } from 'dns/promises'

const BLOCKED_RANGES = [
  'loopback', 'private', 'linkLocal', 'uniqueLocal',
  'unspecified', 'reserved', 'carrierGradeNat', 'broadcast'
] as const

function isBlockedAddress(addr: IPv4 | IPv6): boolean {
  const range = addr.range()
  if ((BLOCKED_RANGES as readonly string[]).includes(range)) return true

  // Handle IPv4-mapped IPv6 addresses (::ffff:x.x.x.x)
  if (addr.kind() === 'ipv6') {
    const v6 = addr as IPv6
    if (v6.isIPv4MappedAddress()) {
      const v4 = v6.toIPv4Address()
      const v4range = v4.range()
      if ((BLOCKED_RANGES as readonly string[]).includes(v4range)) return true
    }
  }

  return false
}

export async function isSafeUrl(rawUrl: string): Promise<boolean> {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:') return false
    if (rawUrl.length > 500) return false

    const hostname = url.hostname

    // Block if hostname is already an IP address
    try {
      const addr = parse(hostname)
      if (isBlockedAddress(addr)) return false
    } catch {
      // Not a raw IP — continue to DNS lookup
    }

    // Resolve DNS and check all returned addresses
    const addresses = await lookup(hostname, { all: true })
    for (const addr of addresses) {
      try {
        const parsed = parse(addr.address)
        if (isBlockedAddress(parsed)) return false
      } catch {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}
