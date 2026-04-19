import { useState } from 'react'
import { Delete } from 'lucide-react'

interface PinLockProps {
  onVerify: (pin: string) => Promise<boolean>
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function PinLock({ onVerify }: PinLockProps) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [checking, setChecking] = useState(false)

  async function handleKey(k: string) {
    if (checking) return
    if (k === '⌫') {
      setPin(p => p.slice(0, -1))
      return
    }
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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0D0A1A',
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
        className={shake ? 'pin-shake' : ''}
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

      <style>{`
        .pin-shake {
          animation: pinShake 0.5s ease-in-out;
        }
        @keyframes pinShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  )
}
