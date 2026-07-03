import { useState, useEffect, useRef } from 'react'
import { Delete } from 'lucide-react'
import { useTranslation } from '../i18n'

interface PinLockProps {
  onVerify: (pin: string) => Promise<boolean>
  onFallbackToLogin?: () => void
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function PinLock({ onVerify, onFallbackToLogin }: PinLockProps) {
  const { t } = useTranslation()
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [checking, setChecking] = useState(false)
  const checkingRef = useRef(checking)
  checkingRef.current = checking
  const lastTapRef = useRef(0)

  function submitPin(candidate: string) {
    setChecking(true)
    onVerify(candidate).then(ok => {
      if (!ok) {
        setShake(true)
        setTimeout(() => { setShake(false); setPin(''); setChecking(false) }, 600)
      }
    })
  }

  function handleKey(k: string) {
    if (checkingRef.current) return
    const now = Date.now()
    if (now - lastTapRef.current < 80) return
    lastTapRef.current = now

    if (k === '⌫') { setPin(p => p.slice(0, -1)); return }
    // Enter is a no-op: the 4th digit (however entered) already triggers
    // verification via the effect below.
    if (k === 'Enter') return
    setPin(prev => (prev.length >= 4 ? prev : prev + k))
  }

  // Trigger verification once 4 digits have actually committed to state —
  // never inside the setPin updater itself. React 18 StrictMode double-invokes
  // updater functions (to surface impure updaters), which previously caused
  // onVerify to fire twice for the same PIN when the submit was scheduled
  // from inside the updater.
  useEffect(() => {
    if (pin.length !== 4) return
    const timer = setTimeout(() => submitPin(pin), 100)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key)
      else if (e.key === 'Backspace') handleKey('⌫')
      else if (e.key === 'Enter') handleKey('Enter')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 40,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{t.pin.enterPin}</p>
        <p style={{ fontSize: 13, color: 'var(--text2)' }}>{t.pin.appLocked}</p>
      </div>

      <div
        style={{ display: 'flex', gap: 16 }}
        className={shake ? 'pin-lock-shake' : ''}
      >
        {[0,1,2,3].map(i => (
          <div
            key={i}
            style={{
              width: 18, height: 18, borderRadius: '50%',
              background: pin.length > i ? 'var(--violet)' : 'transparent',
              border: '2px solid ' + (pin.length > i ? 'var(--violet)' : 'var(--border2)'),
              transition: 'all 0.15s',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12 }}>
        {KEYS.map((k, i) => (
          k === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              disabled={checking}
              onClick={() => handleKey(k)}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: k === '⌫' ? 'transparent' : 'var(--bg3)',
                border: k === '⌫' ? 'none' : '1px solid var(--border2)',
                color: 'var(--text)', fontSize: k === '⌫' ? 20 : 24, fontWeight: 600,
                cursor: checking ? 'default' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.1s',
                opacity: checking ? 0.6 : 1,
              }}
              onPointerDown={e => (e.currentTarget.style.background = 'rgba(124,58,237,0.15)')}
              onPointerUp={e => (e.currentTarget.style.background = k === '⌫' ? 'transparent' : 'var(--bg3)')}
            >
              {k === '⌫' ? <Delete size={22} /> : k}
            </button>
          )
        ))}
      </div>

      {onFallbackToLogin && (
        <button
          onClick={onFallbackToLogin}
          style={{ fontSize: 13, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Prihlásiť sa inak
        </button>
      )}
    </div>
  )
}
