import { useEffect } from 'react'
import { useTranslation } from '../i18n'

interface ConfirmDialogProps {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, message, onConfirm, onCancel }: ConfirmDialogProps) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onCancel} />
      <div
        className="relative mx-4 w-full max-w-sm p-6 modal-in"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '24px',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <p className="text-sm text-[#B8A3E8] text-center mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="btn-secondary flex-1 justify-center py-2.5"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="btn-danger flex-1 justify-center py-2.5 rounded-2xl"
          >
            {t.common.delete}
          </button>
        </div>
      </div>
    </div>
  )
}
