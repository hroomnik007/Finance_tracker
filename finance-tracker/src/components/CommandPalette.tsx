import { useState, useEffect, useRef } from 'react'
import type { Page } from '../App'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate: (page: Page) => void
  onAdd: (type: string) => void
  onToggleTheme: () => void
}

interface PaletteAction {
  kind: 'nav' | 'act'
  id: string
  label: string
  hint: string
  icon: string
  action: () => void
}

interface PaletteItem extends PaletteAction {
  _i: number
}

export function CommandPalette({ open, onClose, onNavigate, onAdd, onToggleTheme }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selIdx, setSelIdx] = useState(0)
  const inpRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelIdx(0)
      setTimeout(() => inpRef.current?.focus(), 50)
    }
  }, [open])

  const actions: PaletteAction[] = [
    { kind: 'nav', id: 'dashboard', label: 'Prehľad', hint: 'Dashboard', icon: '📊', action: () => onNavigate('dashboard') },
    { kind: 'nav', id: 'income', label: 'Príjmy', hint: 'Income', icon: '💰', action: () => onNavigate('income') },
    { kind: 'nav', id: 'variable-expenses', label: 'Variabilné výdavky', hint: 'Variable', icon: '🧾', action: () => onNavigate('variable-expenses') },
    { kind: 'nav', id: 'fixed-expenses', label: 'Fixné výdavky', hint: 'Fixed', icon: '🔒', action: () => onNavigate('fixed-expenses') },
    { kind: 'nav', id: 'categories', label: 'Kategórie', hint: 'Categories', icon: '🏷️', action: () => onNavigate('categories') },
    { kind: 'nav', id: 'household', label: 'Domácnosť', hint: 'Household', icon: '🏠', action: () => onNavigate('household') },
    { kind: 'nav', id: 'savings', label: 'Sporenie', hint: 'Savings', icon: '🐷', action: () => onNavigate('savings') },
    { kind: 'nav', id: 'settings', label: 'Nastavenia', hint: 'Settings', icon: '⚙️', action: () => onNavigate('settings') },
    { kind: 'act', id: 'add-exp', label: 'Pridať výdavok', hint: 'New expense', icon: '➕', action: () => onAdd('expense') },
    { kind: 'act', id: 'add-inc', label: 'Pridať príjem', hint: 'New income', icon: '➕', action: () => onAdd('income') },
    { kind: 'act', id: 'toggle-theme', label: 'Prepnúť tému', hint: 'Theme', icon: '🌓', action: onToggleTheme },
  ]

  const q = query.toLowerCase().trim()
  const filteredActions = q
    ? actions.filter(a => a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q))
    : actions

  const allItems: PaletteItem[] = filteredActions.map((a, i) => ({ ...a, _i: i }))

  const trigger = (item: PaletteItem) => {
    item.action()
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(i + 1, allItems.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); if (allItems[selIdx]) trigger(allItems[selIdx]) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allItems, selIdx])

  if (!open) return null

  const sectionTitle = (label: string) => (
    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', padding: '10px 16px 4px' }}>{label}</div>
  )

  let curSection: string | null = null
  const rows: React.ReactNode[] = []
  allItems.forEach((item, i) => {
    const section = item.kind === 'nav' ? 'Navigácia' : 'Akcie'
    if (section !== curSection) {
      rows.push(<div key={'s-' + section}>{sectionTitle(section)}</div>)
      curSection = section
    }
    const sel = selIdx === i
    rows.push(
      <div
        key={item.id}
        onClick={() => trigger(item)}
        onMouseEnter={() => setSelIdx(i)}
        style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '9px 16px', cursor: 'pointer',
          background: sel ? 'rgba(139,92,246,0.13)' : 'transparent',
          borderLeft: sel ? '2px solid var(--violet)' : '2px solid transparent',
          transition: 'background 0.08s',
        }}
      >
        <span style={{ fontSize: 15, width: 22, display: 'flex', justifyContent: 'center' }}>{item.icon}</span>
        <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text)', fontWeight: sel ? 500 : 400 }}>{item.label}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'DM Mono',monospace" }}>{item.hint}</span>
        {sel && <KbdKey label="↵" />}
      </div>
    )
  })

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,14,0.65)', backdropFilter: 'blur(6px)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(580px, 92vw)', background: 'var(--bg2)',
          border: '1px solid var(--border2)', borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)', overflow: 'hidden',
          animation: 'modal-in 0.18s cubic-bezier(0.34,1.1,0.64,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inpRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelIdx(0) }}
            placeholder="Hľadať alebo vykonať akciu…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 15, fontFamily: "'DM Sans', sans-serif" }}
          />
          <KbdKey label="esc" />
        </div>
        <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '4px 0 8px' }}>
          {rows.length > 0 ? rows : (
            <div style={{ padding: '28px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>🔍</p>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>Žiadne výsledky pre "{query}"</p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)', fontSize: 11, color: 'var(--text3)' }}>
          <div style={{ display: 'flex', gap: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><KbdKey label="↑↓" /> pohyb</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><KbdKey label="↵" /> vybrať</span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><KbdKey label="⌘K" /> otvoriť</span>
        </div>
      </div>
    </div>
  )
}

function KbdKey({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '1px 5px', borderRadius: 4, fontSize: 10, fontFamily: "'DM Mono', monospace",
      background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text3)',
    }}>{label}</span>
  )
}
