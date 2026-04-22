import { useEffect } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 fade-in flex items-end sm:items-center justify-center sm:px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />

      {/* Sheet — flex column so footer is always outside scroll area */}
      <div
        className="relative w-full slide-up rounded-t-[24px] sm:rounded-[24px] sm:max-w-[480px] lg:max-w-[520px] lg:modal-in flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-elevated)',
          maxHeight: '92svh',
        }}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.2)',
          }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-base font-semibold text-[#E2D9F3] overflow-visible">{title}</h2>
          <button
            onClick={onClose}
            className="btn-icon w-8 h-8 text-[#B8A3E8] hover:text-[#E2D9F3]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div
          className="px-6 py-5 overflow-y-auto flex-1"
          style={{ paddingBottom: footer ? '8px' : '24px' }}
        >
          {children}
        </div>

        {/* Footer — pinned outside scroll, always visible */}
        {footer && (
          <div
            className="flex-shrink-0 px-4 pt-3"
            style={{
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
              backgroundColor: 'var(--bg-surface)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
