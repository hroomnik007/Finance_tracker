import { useState, useRef, useEffect } from 'react'
import { Trash2 } from 'lucide-react'

interface SwipeableRowProps {
  onDelete: () => void
  children: React.ReactNode
  disabled?: boolean
  fullSwipeDelete?: boolean
}

const REVEAL_PX = 80
const FULL_SWIPE_RATIO = 0.5  // 50% of item width
const VELOCITY_THRESHOLD = 0.5 // px/ms

export function SwipeableRow({ onDelete, children, disabled, fullSwipeDelete = true }: SwipeableRowProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const onDeleteRef = useRef(onDelete)
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])

  const [offset, setOffset] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [deleteState, setDeleteState] = useState<'idle' | 'measure' | 'collapse'>('idle')
  const [collapseH, setCollapseH] = useState<number | undefined>()

  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  const lastX = useRef(0)
  const lastTime = useRef(0)
  const swipeVel = useRef(0)

  const getW = () => wrapRef.current?.offsetWidth ?? 320

  useEffect(() => {
    if (deleteState === 'measure') {
      const h = wrapRef.current?.offsetHeight ?? 64
      setCollapseH(h)
      requestAnimationFrame(() => setDeleteState('collapse'))
    }
    if (deleteState === 'collapse') {
      const t = setTimeout(() => onDeleteRef.current(), 200)
      return () => clearTimeout(t)
    }
  }, [deleteState])

  function triggerFullDelete() {
    navigator.vibrate?.(50)
    setDeleteState('measure')
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (disabled) return
    const t = e.touches[0]
    touchStartX.current = t.clientX
    touchStartY.current = t.clientY
    lastX.current = t.clientX
    lastTime.current = Date.now()
    isSwiping.current = false
    swipeVel.current = 0
    setTracking(true)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (disabled) return
    const t = e.touches[0]
    const dx = t.clientX - touchStartX.current
    const dy = t.clientY - touchStartY.current

    if (!isSwiping.current) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        isSwiping.current = true
      } else if (Math.abs(dy) > 8) {
        setTracking(false)
        return
      } else {
        return
      }
    }

    const now = Date.now()
    const dt = now - lastTime.current
    if (dt > 0) swipeVel.current = (t.clientX - lastX.current) / dt
    lastX.current = t.clientX
    lastTime.current = now

    let newOffset: number
    if (revealed) {
      newOffset = Math.min(0, Math.max(-getW(), -REVEAL_PX + dx))
    } else {
      if (dx > 0) return
      newOffset = Math.max(-getW(), dx)
    }

    e.preventDefault()
    setOffset(newOffset)
  }

  function handleTouchEnd() {
    setTracking(false)
    if (!isSwiping.current && !revealed) return

    const w = getW()
    if (
      fullSwipeDelete &&
      isSwiping.current &&
      (offset < -(w * FULL_SWIPE_RATIO) || swipeVel.current < -VELOCITY_THRESHOLD)
    ) {
      triggerFullDelete()
      return
    }

    if (isSwiping.current && offset < -40) {
      setOffset(-REVEAL_PX)
      setRevealed(true)
    } else {
      setOffset(0)
      setRevealed(false)
    }
    isSwiping.current = false
  }

  const pastHalf = fullSwipeDelete && offset < -(getW() * FULL_SWIPE_RATIO)
  const isCollapsing = deleteState === 'collapse'

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        height: isCollapsing ? 0 : collapseH,
        transition: isCollapsing ? 'height 0.2s ease, margin-bottom 0.2s ease' : undefined,
        marginBottom: isCollapsing ? 0 : undefined,
      }}
      onClick={() => { if (revealed) { setOffset(0); setRevealed(false) } }}
    >
      {/* Delete background */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: REVEAL_PX,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: pastHalf ? '#DC2626' : '#ef4444',
        borderRadius: '0 16px 16px 0',
        transition: 'background 0.15s',
      }}>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            background: 'none', border: 'none', color: 'white', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 8,
          }}
        >
          <Trash2 size={18} />
          <span style={{ fontSize: 11, fontWeight: 600 }}>Zmazať</span>
        </button>
      </div>

      {/* Swipeable content */}
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: tracking ? 'none' : 'transform 0.2s ease',
          position: 'relative', zIndex: 1, borderRadius: 16, touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
