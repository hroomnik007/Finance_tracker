import { useEffect } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
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

      {/* Sheet */}
      <div
        className="relative w-full max-h-[92svh] overflow-y-auto slide-up sm:rounded-[24px] sm:max-w-[480px] lg:max-w-[520px] lg:modal-in"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-elevated)',
          borderRadius: '24px 24px 0 0',
        }}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.2)',
          }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
            borderRadius: '24px 24px 0 0',
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

        {/* Body */}
        <div className="px-6 py-5 pb-8 md:pb-6">{children}</div>
      </div>
    </div>
  )
}
