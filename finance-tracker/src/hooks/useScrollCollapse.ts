import { useEffect, useRef, useState } from 'react'

const IDLE_EXPAND_MS = 500
// Ignore sub-pixel/noise scroll deltas so momentum-scroll jitter near a
// standstill doesn't flip the state back and forth.
const SCROLL_THRESHOLD = 4

/**
 * Tracks whether the user is actively scrolling *any* scrollable element on
 * the page (this app nests independent `overflowY: auto` containers per
 * page rather than scrolling `window`, so we listen on `window` with
 * `capture: true` — the `scroll` event doesn't bubble, but it does reach
 * capture-phase ancestor listeners, which lets one listener cover every
 * page's scroll container without prop-drilling refs around).
 *
 * Returns `true` while the user is scrolling down, flipping back to `false`
 * immediately on scroll-up or after a short idle period once scrolling
 * stops. Always `false` (never collapses) under prefers-reduced-motion.
 */
export function useScrollCollapse(): boolean {
  const [collapsed, setCollapsed] = useState(false)
  const lastScrollTops = useRef(new WeakMap<EventTarget, number>())
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    function handleScroll(e: Event) {
      const target = e.target
      if (!(target instanceof Element)) return

      const scrollTop = target.scrollTop
      const last = lastScrollTops.current.get(target) ?? scrollTop
      lastScrollTops.current.set(target, scrollTop)
      const delta = scrollTop - last

      if (idleTimer.current) clearTimeout(idleTimer.current)

      if (delta < -SCROLL_THRESHOLD) {
        setCollapsed(false)
      } else if (delta > SCROLL_THRESHOLD) {
        setCollapsed(true)
      }
      // Any scroll activity (even below the threshold) postpones the
      // idle-expand so the bar doesn't snap open mid-gesture.
      idleTimer.current = setTimeout(() => setCollapsed(false), IDLE_EXPAND_MS)
    }

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [])

  return collapsed
}
