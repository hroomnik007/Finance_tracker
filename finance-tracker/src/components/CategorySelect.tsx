import { useState, useRef, useEffect, useId, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

interface CategoryOption {
  id?: string
  name: string
  icon: string
}

interface CategorySelectProps {
  categories: CategoryOption[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  extraOption?: { value: string; label: string }
  disabled?: boolean
}

export function CategorySelect({ categories, value, onChange, placeholder, extraOption, disabled }: CategorySelectProps) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const options = [
    ...categories.map(c => ({ value: c.id ?? '', label: c.name, icon: c.icon })),
    ...(extraOption ? [{ value: extraOption.value, label: extraOption.label, icon: '➕' }] : []),
  ]
  const selectedIndex = options.findIndex(o => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  function openDropdown() {
    if (disabled) return
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 6, left: r.left, width: r.width })
    }
    setHighlighted(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  function closeDropdown() {
    setOpen(false)
    btnRef.current?.focus()
  }

  function selectOption(idx: number) {
    const opt = options[idx]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      const insideWrapper = wrapperRef.current?.contains(target)
      const insideList = listRef.current?.contains(target)
      if (!insideWrapper && !insideList) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true })
  }, [open])

  function handleTriggerKeyDown(e: KeyboardEvent) {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      openDropdown()
    }
  }

  function handleListKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(i => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectOption(highlighted)
      btnRef.current?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeDropdown()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        className="input-field"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        {selected ? <span style={{ fontSize: 16, flexShrink: 0 }}>{selected.icon}</span> : null}
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected ? 'var(--text)' : 'var(--text3)' }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} style={{ opacity: 0.55, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
      </button>

      {open && dropPos && createPortal(
        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          ref={listRef}
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            maxHeight: 260,
            overflowY: 'auto',
            background: 'var(--bg2)',
            border: '1px solid var(--border2)',
            borderRadius: 10,
            boxShadow: '0 8px 28px rgba(0,0,0,0.38)',
            zIndex: 9000,
            padding: '4px 0',
          }}
        >
          {options.map((opt, idx) => {
            const active = opt.value === value
            const isHighlighted = idx === highlighted
            return (
              <div
                key={opt.value || `opt-${idx}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setHighlighted(idx)}
                onClick={() => { selectOption(idx); btnRef.current?.focus() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', cursor: 'pointer',
                  background: isHighlighted ? 'var(--bg3)' : 'transparent',
                  color: active ? 'var(--violet)' : 'var(--text)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{opt.icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
