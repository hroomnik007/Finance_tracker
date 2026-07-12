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

/**
 * Monogram avatars (Profile's preset picker) store a `monogram:<key>` sentinel
 * in the same `avatarUrl` field previously used for a raw emoji string — every
 * spot that renders `avatarUrl` as an emoji (Topbar, Avatar, MemberAvatar,
 * Profile) must check this first, or it prints the literal sentinel text.
 */
export const MONOGRAM_PREFIX = 'monogram:'

export const MONOGRAM_GRADIENTS: [string, [string, string]][] = [
  ['violet-fuchsia', ['var(--aurora-violet)', 'var(--aurora-fuchsia)']],
  ['emerald-cyan', ['var(--aurora-emerald)', 'var(--aurora-cyan)']],
  ['rose-amber', ['var(--aurora-rose)', 'var(--aurora-amber)']],
  ['cyan-violet', ['var(--aurora-cyan)', 'var(--aurora-violet)']],
  ['amber-fuchsia', ['var(--aurora-amber)', 'var(--aurora-fuchsia)']],
]

export function monogramGradientFor(value: string | null | undefined): [string, string] | null {
  if (!value || !value.startsWith(MONOGRAM_PREFIX)) return null
  const key = value.slice(MONOGRAM_PREFIX.length)
  return MONOGRAM_GRADIENTS.find(([k]) => k === key)?.[1] ?? null
}
