import { useState, useRef } from 'react'
import { useSwipeable } from 'react-swipeable'
import { Trash2 } from 'lucide-react'

interface SwipeableRowProps {
  onDelete: () => void
  children: React.ReactNode
  disabled?: boolean
}

export function SwipeableRow({ onDelete, children, disabled }: SwipeableRowProps) {
  const [offset, setOffset] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const THRESHOLD = 80

  const handlers = useSwipeable({
    onSwiping: (e) => {
      if (disabled) return
      if (e.dir === 'Left') {
        const delta = Math.min(e.absX, 100)
        setOffset(-delta)
      } else if (e.dir === 'Right' && revealed) {
        const delta = Math.max(-100 + e.absX, 0)
        setOffset(-delta + (delta === 0 ? 0 : 0))
        if (e.absX > 30) {
          setOffset(0)
          setRevealed(false)
        }
      }
    },
    onSwipedLeft: (e) => {
      if (disabled) return
      if (e.absX > THRESHOLD) {
        setOffset(-100)
        setRevealed(true)
      } else {
        setOffset(0)
        setRevealed(false)
      }
    },
    onSwipedRight: () => {
      setOffset(0)
      setRevealed(false)
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: false,
    delta: 10,
  })

  return (
    <div ref={containerRef} style={{ position: 'relative', overflow: 'hidden', borderRadius: '18px' }}>
      {/* Delete button behind */}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#DC2626',
          borderRadius: '18px',
        }}
      >
        <button
          onClick={onDelete}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            color: 'white',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          <Trash2 size={18} />
          <span style={{ fontSize: '11px', fontWeight: 600 }}>Zmazať</span>
        </button>
      </div>

      {/* Swipeable content */}
      <div
        {...handlers}
        style={{
          transform: `translateX(${offset}px)`,
          transition: Math.abs(offset) === 0 || Math.abs(offset) === 100 ? 'transform 0.2s ease' : 'none',
          position: 'relative',
          zIndex: 1,
          borderRadius: '18px',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  )
}
