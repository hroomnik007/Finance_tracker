import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAUpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: 'var(--violet)', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '10px 16px', fontSize: 14, fontWeight: 500,
    }}>
      <span>Dostupná nová verzia.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)',
          color: 'white', borderRadius: 8, padding: '4px 12px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Aktualizovať
      </button>
    </div>
  )
}
