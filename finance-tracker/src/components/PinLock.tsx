import { useState, useEffect } from 'react'
import { Delete, Fingerprint } from 'lucide-react'

interface PinLockProps {
  onVerify: (pin: string) => Promise<boolean>
  onVerifyBiometric: () => Promise<boolean>
  lockMethod: 'pin' | 'biometric' | null
  onFallbackToLogin?: () => void
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function PinLock({ onVerify, onVerifyBiometric, lockMethod, onFallbackToLogin }: PinLockProps) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [checking, setChecking] = useState(false)
  const [biometricError, setBiometricError] = useState<string | null>(null)
  const [biometricPending, setBiometricPending] = useState(false)

  useEffect(() => {
    if (lockMethod === 'biometric') {
      triggerBiometric()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function triggerBiometric() {
    setBiometricError(null)
    setBiometricPending(true)
    const ok = await onVerifyBiometric()
    setBiometricPending(false)
    if (!ok) setBiometricError('Biometrická autentifikácia zlyhala')
  }

  async function handleKey(k: string) {
    if (checking) return
    if (k === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 4) return
    const next = pin + k
    setPin(next)
    if (next.length === 4) {
      setChecking(true)
      const ok = await onVerify(next)
      if (!ok) {
        setShake(true)
        setTimeout(() => { setShake(false); setPin(''); setChecking(false) }, 600)
      }
    }
  }

  if (lockMethod === 'biometric') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 40,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#E2D9F3', marginBottom: 4 }}>Finvu je uzamknuté</p>
          {biometricError && (
            <p style={{ fontSize: 13, color: '#F87171', marginTop: 8 }}>{biometricError}</p>
          )}
        </div>

        <button
          onClick={triggerBiometric}
          disabled={biometricPending}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            padding: '24px 40px', borderRadius: 20,
            background: 'rgba(124,58,237,0.12)', border: '1.5px solid rgba(124,58,237,0.4)',
            cursor: biometricPending ? 'wait' : 'pointer', color: '#E2D9F3',
            opacity: biometricPending ? 0.7 : 1, transition: 'opacity 0.15s',
          }}
        >
          <Fingerprint size={48} color="#7C3AED" />
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {biometricPending ? 'Overujem...' : 'Prihlásiť sa biometriou'}
          </span>
        </button>

        {onFallbackToLogin && (
          <button
            onClick={onFallbackToLogin}
            style={{ fontSize: 13, color: '#9D84D4', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Prihlásiť sa inak
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 40,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <p style={{ fontSize: 18, fontWeight: 600, color: '#E2D9F3', marginBottom: 4 }}>Zadaj PIN</p>
        <p style={{ fontSize: 13, color: '#9D84D4' }}>Finvu je uzamknuté</p>
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
              background: pin.length > i ? '#7C3AED' : 'transparent',
              border: '2px solid ' + (pin.length > i ? '#7C3AED' : '#4C3A8A'),
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
              onClick={() => handleKey(k)}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                background: k === '⌫' ? 'transparent' : 'rgba(255,255,255,0.04)',
                border: k === '⌫' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                color: '#E2D9F3', fontSize: k === '⌫' ? 20 : 24, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.1s',
              }}
              onPointerDown={e => (e.currentTarget.style.background = k === '⌫' ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.15)')}
              onPointerUp={e => (e.currentTarget.style.background = k === '⌫' ? 'transparent' : 'rgba(255,255,255,0.04)')}
            >
              {k === '⌫' ? <Delete size={22} /> : k}
            </button>
          )
        ))}
      </div>
    </div>
  )
}
