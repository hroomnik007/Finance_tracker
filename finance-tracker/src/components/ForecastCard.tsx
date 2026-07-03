interface ForecastCardProps {
  progressPct: number
  monthLabel: string
  predictedBalanceLabel: string
  predictedBalanceText: string
  predictedBalanceColor: string
  paceText: string
}

const SIZE = 72
const RADIUS = 32
const STROKE = 6
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ForecastCard({
  progressPct,
  monthLabel,
  predictedBalanceLabel,
  predictedBalanceText,
  predictedBalanceColor,
  paceText,
}: ForecastCardProps) {
  const clamped = Math.min(Math.max(progressPct, 0), 100)
  const offset = CIRCUMFERENCE * (1 - clamped / 100)

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
          <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--bg4)" strokeWidth={STROKE} />
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none"
              stroke="var(--violet)" strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.4s' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 15, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>{Math.round(clamped)}%</p>
            <p style={{ fontSize: 9, color: 'var(--text3)', margin: 0 }}>{monthLabel}</p>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', margin: '0 0 6px' }}>{predictedBalanceLabel}</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 18, color: predictedBalanceColor, margin: '0 0 4px', letterSpacing: '-0.3px' }}>{predictedBalanceText}</p>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--text3)', margin: 0 }}>{paceText}</p>
        </div>
      </div>
    </div>
  )
}
