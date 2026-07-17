import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

interface SettingsDropdownOption {
  value: string
  label: string
  icon?: ReactNode
}

interface SettingsDropdownProps {
  value: string
  options: SettingsDropdownOption[]
  onChange: (value: string) => void
  size?: 'md' | 'sm'
}

// Custom themed dropdown for simple value-pickers in Settings (Mena, Formát dátumu).
// Mirrors LanguageSwitcher's "full" variant so all three fields look and behave
// the same — including portaling to document.body, since these controls live
// inside containers with backdrop-filter (a new containing block breaks
// position: fixed/absolute popups otherwise).
export function SettingsDropdown({ value, options, onChange, size = 'md' }: SettingsDropdownProps) {
  const compact = size === 'sm'
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const current = options.find(o => o.value === value) ?? options[0]

  function openDropdown() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 180) })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      // Dropdown is portaled to <body>, so it isn't a DOM descendant of
      // wrapperRef — check both the trigger wrapper and the portaled dropdown
      // before treating a click as "outside" (otherwise mousedown would close
      // the menu before an option's onClick could fire).
      if (wrapperRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleSelect(v: string) {
    onChange(v)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: 'fit-content', minWidth: compact ? 140 : 170,
          padding: compact ? '0 10px' : '0 12px', height: compact ? 32 : 36,
          borderRadius: 8,
          cursor: 'pointer',
          background: 'var(--bg3)',
          border: '1px solid var(--border2)',
          color: 'var(--text)',
          fontSize: compact ? 12.5 : 13,
          fontWeight: 500,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {current?.icon && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{current.icon}</span>}
        <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap' }}>{current?.label}</span>
        <ChevronDown
          size={13}
          style={{ opacity: 0.55, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
        />
      </button>

      {open && dropPos && createPortal(
        <div ref={dropdownRef} style={{
          position: 'fixed',
          top: dropPos.top,
          left: dropPos.left,
          width: dropPos.width,
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 10,
          boxShadow: '0 8px 28px rgba(0,0,0,0.38)',
          overflow: 'hidden',
          zIndex: 9000,
          padding: '4px 0',
        }}>
          {options.map(({ value: v, label, icon }) => {
            const active = value === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => handleSelect(v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: compact ? '7px 12px' : '9px 14px', border: 'none', cursor: 'pointer',
                  background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                  color: active ? 'var(--violet)' : 'var(--text)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'background 0.1s',
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {icon && <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</span>}
                  {label}
                </span>
                {active && <Check size={14} />}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
