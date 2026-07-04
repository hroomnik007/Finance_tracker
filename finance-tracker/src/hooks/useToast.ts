import { useState, useCallback } from 'react'

export interface Toast {
  id: number
  message: string
  variant?: 'default' | 'achievement'
  icon?: string
  label?: string
}

export interface ShowToastOptions {
  variant?: Toast['variant']
  icon?: string
  label?: string
}

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, options?: ShowToastOptions) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, variant: options?.variant, icon: options?.icon, label: options?.label }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  return { toasts, showToast }
}
