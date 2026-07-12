import { Delete } from 'lucide-react'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

interface PinKeypadProps {
  length: number
  digits: number
  shake?: boolean
  disabled?: boolean
  onKey: (key: string) => void
}

export function PinKeypad({ length, digits, shake, disabled, onKey }: PinKeypadProps) {
  return (
    <>
      <div
        className={shake ? 'pin-lock-shake' : ''}
        style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 36 }}
      >
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 14, height: 14, borderRadius: '50%',
              background: i < digits ? 'linear-gradient(135deg,var(--aurora-violet),var(--aurora-fuchsia))' : 'transparent',
              border: i < digits ? '1.5px solid transparent' : '1.5px solid var(--aurora-gline)',
              transition: 'all 0.15s',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 16, justifyContent: 'center' }}>
        {KEYS.map((k, i) => (
          k === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onKey(k === '⌫' ? 'backspace' : k)}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--aurora-glass)',
                border: '1px solid var(--aurora-gline)',
                color: 'var(--aurora-hi)', fontSize: 21, fontWeight: 600,
                fontFamily: "'Outfit', sans-serif",
                cursor: disabled ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.1s',
                opacity: disabled ? 0.6 : 1,
              }}
              onPointerDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,0.18)' }}
              onPointerUp={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--aurora-glass)' }}
              onPointerLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--aurora-glass)' }}
            >
              {k === '⌫' ? <Delete size={20} color="var(--aurora-lo)" /> : k}
            </button>
          )
        ))}
      </div>
    </>
  )
}
