export type CardSeverity = 'red' | 'warning' | null

export function severityCardStyle(severity: CardSeverity) {
  return {
    background: severity ? `color-mix(in srgb, var(--${severity}) 8%, var(--bg2))` : 'var(--bg2)',
    border: severity ? `1px solid color-mix(in srgb, var(--${severity}) 35%, var(--border))` : '1px solid var(--border)',
    borderRadius: 16,
    padding: 16,
  }
}
