import { useEffect } from 'react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const isMobile = window.innerWidth < 768

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={isMobile ? 'slide-up' : 'modal-in'}
        style={{
          background: 'var(--bg2)',
          border: '1px solid rgba(139,92,246,0.2)',
          borderRadius: isMobile ? '24px 24px 0 0' : 20,
          width: isMobile ? '100%' : 440,
          maxHeight: '90svh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -8px 60px rgba(139,92,246,0.15)',
        }}
      >
        {/* Drag handle — mobile only */}
        {isMobile && (
          <div style={{
            width: 36,
            height: 4,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 2,
            margin: '12px auto 0',
            flexShrink: 0,
          }} />
        )}

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <h2 style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            fontFamily: "'DM Sans', sans-serif",
            margin: 0,
          }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 30, height: 30,
              borderRadius: '50%',
              background: 'var(--bg3)',
              border: 'none',
              color: 'var(--text3)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{
          padding: '20px 24px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '16px 24px',
            paddingBottom: isMobile
              ? 'calc(24px + env(safe-area-inset-bottom, 0px))'
              : '24px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
