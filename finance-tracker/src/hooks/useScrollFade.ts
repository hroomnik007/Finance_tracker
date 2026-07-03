import { useEffect, useRef, useState } from 'react'

// Tracks whether a horizontally-scrollable element has more content to the
// right than currently visible, so callers can show/hide a fade-out overlay.
export function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [showFade, setShowFade] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const update = () => {
      const hasOverflow = el.scrollWidth > el.clientWidth + 1
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
      setShowFade(hasOverflow && !atEnd)
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(el)

    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      resizeObserver.disconnect()
    }
  }, [])

  return { ref, showFade }
}
