export type ThemePreference = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== 'system') return pref
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

// ── Accent color ─────────────────────────────────────────────────────────────
// The accent picker in Settings only used to set `--accent-color`, a CSS
// variable that almost nothing in the app actually reads — every button,
// active nav pill, "today" marker etc. is styled off `--aurora-violet`
// (and the older `--violet` v3 token). Applying the chosen color to those
// tokens too is what makes the picker actually change anything on screen.
// `--aurora-fuchsia` is left untouched so the existing purple→pink gradient
// on primary buttons/active pills becomes accent→pink instead of losing the
// gradient treatment entirely.
export const ACCENT_COLOR_KEY = 'accent_color'
export const DEFAULT_ACCENT_COLOR = '#7C3AED'

export function applyAccentColor(color: string) {
  const html = document.documentElement
  html.style.setProperty('--accent-color', color)
  html.style.setProperty('--aurora-violet', color)
  html.style.setProperty('--violet', color)
}

// ── Background color ─────────────────────────────────────────────────────────
// Revolut-style per-theme page background tint, applied to `--aurora-bg`
// only (never `--aurora-panel`, which must keep its own dedicated card/panel
// color so cards read as "above" the background).
export const BG_COLOR_KEY_DARK = 'bg_color_dark'
export const BG_COLOR_KEY_LIGHT = 'bg_color_light'
export const DEFAULT_BG_COLOR_DARK = '#0F1F3A'
export const DEFAULT_BG_COLOR_LIGHT = '#EAF1FB'

export function bgColorStorageKey(theme: ResolvedTheme): string {
  return theme === 'light' ? BG_COLOR_KEY_LIGHT : BG_COLOR_KEY_DARK
}

export function defaultBgColor(theme: ResolvedTheme): string {
  return theme === 'light' ? DEFAULT_BG_COLOR_LIGHT : DEFAULT_BG_COLOR_DARK
}

export function applyBackgroundColor(color: string) {
  document.documentElement.style.setProperty('--aurora-bg', color)
}
