interface ScrollFadeOverlayProps {
  visible: boolean
  background: string
  width?: number
}

// Right-edge gradient hint that a horizontally-scrollable row has more
// content — purely visual, sits above the scroll container via absolute
// positioning on a `position: relative` wrapper.
export function ScrollFadeOverlay({ visible, background, width = 48 }: ScrollFadeOverlayProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width,
        pointerEvents: 'none',
        background: `linear-gradient(to right, transparent, ${background})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.15s',
      }}
    />
  )
}
