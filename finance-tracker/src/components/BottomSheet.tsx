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

  // Fix 4: ESC closes the sheet
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
    <div className="fixed inset-0 z-50 fade-in flex items-end sm:items-center justify-center px-4 sm:px-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Sheet — px-4 on outer container ensures 16px margin on each side on mobile */}
      <div
        className="relative w-full max-h-[92svh] overflow-y-auto slide-up rounded-[24px] sm:rounded-[24px] sm:max-w-[480px] lg:max-w-[520px] lg:modal-in"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 sticky top-0 z-10 rounded-t-[24px]"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <h2 className="text-base font-semibold text-[#E2D9F3] pt-1 overflow-visible">{title}</h2>
          <button
            onClick={onClose}
            className="btn-icon w-8 h-8 text-[#B8A3E8] hover:text-[#E2D9F3]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 pb-8 md:px-6 md:pb-6">{children}</div>
      </div>
    </div>
  )
}
