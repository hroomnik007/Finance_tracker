import type { CSSProperties, ReactNode } from 'react'

interface GlassCardProps {
  children: ReactNode
  style?: CSSProperties
  className?: string
  onClick?: () => void
  radius?: number
  blur?: number
}

export function GlassCard({ children, style, className, onClick, radius = 20, blur = 16 }: GlassCardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--aurora-glass)',
        border: '1px solid var(--aurora-gline)',
        borderRadius: radius,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        boxShadow: 'var(--aurora-card-shadow)',
        padding: 16,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
