import { resolveAssetUrl } from '../api/client'

/**
 * Photo avatars are data URLs (upload preview), absolute http(s) URLs, or
 * server-relative /uploads/… paths; anything else short is an emoji avatar.
 */
export function isPhotoUrl(url: string | null | undefined): url is string {
  return !!(url && (url.startsWith('data:') || url.startsWith('http') || url.startsWith('/')))
}

/** Resolve an avatar URL for use in an <img src>. */
export function avatarSrc(url: string): string {
  return resolveAssetUrl(url)
}
