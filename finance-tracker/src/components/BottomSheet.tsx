import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
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

  return createPortal(
    <div
      className="fixed inset-0 fade-in flex items-end sm:items-center justify-center px-4 sm:px-0"
      style={{ zIndex: 200 }}
    >
      {/* Backdrop — rgba so it never goes fully black */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className="relative w-full max-h-[92svh] overflow-y-auto slide-up rounded-[24px] sm:max-w-[480px] lg:max-w-[520px]"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        {/* Sticky header */}
        <div
          className="flex items-center justify-between px-6 py-5 sticky top-0 z-10 rounded-t-[24px]"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-base font-semibold text-[#f1f5f9]">{title}</h2>
          <button onClick={onClose} className="btn-icon w-8 h-8 text-[#94a3b8] hover:text-[#f1f5f9]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 pb-8">{children}</div>
      </div>
    </div>,
    document.body
  )
}
