import { useState } from 'react'
import { X, Delete } from 'lucide-react'

interface PinSetupModalProps {
  open: boolean
  onClose: () => void
  onSetPin: (pin: string) => Promise<void>
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

export function PinSetupModal({ open, onClose, onSetPin }: PinSetupModalProps) {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter')
  const [first, setFirst] = useState('')
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!open) return null

  function handleClose() {
    setStep('enter'); setFirst(''); setPin('')
    onClose()
  }

  async function handleKey(k: string) {
    if (saving) return
    if (k === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 4) return
    const next = pin + k
    setPin(next)
    if (next.length === 4) {
      if (step === 'enter') {
        setFirst(next)
        setTimeout(() => { setStep('confirm'); setPin('') }, 150)
      } else {
        if (next !== first) {
          setShake(true)
          setTimeout(() => { setShake(false); setPin(''); }, 600)
        } else {
          setSaving(true)
          await onSetPin(next)
          handleClose()
          setSaving(false)
        }
      }
    }
  }

  const title = step === 'enter' ? 'Zadaj nový PIN' : 'Potvrď PIN'
  const sub = step === 'enter' ? 'Zvoľ si 4-ciferný PIN kód' : 'Zadaj PIN znova pre potvrdenie'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={handleClose} />
      <div style={{
        position: 'relative', width: '100%', maxWidth: 340,
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 24, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#E2D9F3' }}>{title}</h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9D84D4', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '32px 24px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
          <p style={{ fontSize: 13, color: '#9D84D4', textAlign: 'center' }}>{sub}</p>

          <div style={{ display: 'flex', gap: 16 }} className={shake ? 'pin-shake' : ''}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: '50%',
                background: pin.length > i ? '#7C3AED' : 'transparent',
                border: '2px solid ' + (pin.length > i ? '#7C3AED' : '#4C3A8A'),
                transition: 'all 0.15s',
              }} />
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gap: 10 }}>
            {KEYS.map((k, i) => (
              k === '' ? <div key={i} /> : (
                <button
                  key={i}
                  onClick={() => handleKey(k)}
                  style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: k === '⌫' ? 'transparent' : 'rgba(255,255,255,0.04)',
                    border: k === '⌫' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    color: '#E2D9F3', fontSize: k === '⌫' ? 18 : 20, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onPointerDown={e => (e.currentTarget.style.background = k === '⌫' ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.15)')}
                  onPointerUp={e => (e.currentTarget.style.background = k === '⌫' ? 'transparent' : 'rgba(255,255,255,0.04)')}
                >
                  {k === '⌫' ? <Delete size={18} /> : k}
                </button>
              )
            ))}
          </div>
        </div>

        <style>{`
          .pin-shake { animation: pinShake 0.5s ease-in-out; }
          @keyframes pinShake {
            0%,100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-8px); }
            80% { transform: translateX(8px); }
          }
        `}</style>
      </div>
    </div>
  )
}
