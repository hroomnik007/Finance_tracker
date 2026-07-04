interface StreakBadgeProps {
  count: number
  size?: 'sm' | 'lg'
  onClick?: () => void
}

export function StreakBadge({ count, size = 'lg', onClick }: StreakBadgeProps) {
  if (count <= 0) return null
  const isLg = size === 'lg'
  const interactive = !!onClick
  return (
    <button
      type="button"
      onClick={onClick}
      title={interactive ? `Séria ${count} dní — klikni pre detail` : `Sledujete financie ${count} dní v rade!`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: isLg ? '4px 9px' : '2px 6px',
        borderRadius: 99,
        background: 'linear-gradient(135deg,rgba(251,146,60,0.18),rgba(248,113,113,0.15))',
        border: '1px solid rgba(251,146,60,0.3)',
        fontSize: isLg ? 11 : 10, fontWeight: 700, color: '#FB923C',
        cursor: interactive ? 'pointer' : 'default', userSelect: 'none',
        fontFamily: "'DM Mono', monospace",
        flexShrink: 0,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ display: 'inline-block', animation: 'flame 1.4s ease-in-out infinite', transformOrigin: 'bottom center' }}>
        🔥
      </span>
      {count}
    </button>
  )
}
