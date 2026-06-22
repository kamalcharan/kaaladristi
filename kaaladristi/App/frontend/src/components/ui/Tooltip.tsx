import { useState, useRef, useCallback } from 'react'
import type { ReactNode, CSSProperties } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  maxWidth?: number
}

const ARROW_SIZE = 4

function arrowStyle(position: NonNullable<TooltipProps['position']>): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    pointerEvents: 'none',
  }
  switch (position) {
    case 'top':
      return {
        ...base,
        bottom: -ARROW_SIZE,
        left: '50%',
        transform: 'translateX(-50%)',
        borderLeft: `${ARROW_SIZE}px solid transparent`,
        borderRight: `${ARROW_SIZE}px solid transparent`,
        borderTop: `${ARROW_SIZE}px solid var(--card)`,
      }
    case 'bottom':
      return {
        ...base,
        top: -ARROW_SIZE,
        left: '50%',
        transform: 'translateX(-50%)',
        borderLeft: `${ARROW_SIZE}px solid transparent`,
        borderRight: `${ARROW_SIZE}px solid transparent`,
        borderBottom: `${ARROW_SIZE}px solid var(--card)`,
      }
    case 'left':
      return {
        ...base,
        right: -ARROW_SIZE,
        top: '50%',
        transform: 'translateY(-50%)',
        borderTop: `${ARROW_SIZE}px solid transparent`,
        borderBottom: `${ARROW_SIZE}px solid transparent`,
        borderLeft: `${ARROW_SIZE}px solid var(--card)`,
      }
    case 'right':
      return {
        ...base,
        left: -ARROW_SIZE,
        top: '50%',
        transform: 'translateY(-50%)',
        borderTop: `${ARROW_SIZE}px solid transparent`,
        borderBottom: `${ARROW_SIZE}px solid transparent`,
        borderRight: `${ARROW_SIZE}px solid var(--card)`,
      }
  }
}

function tooltipPosition(position: NonNullable<TooltipProps['position']>): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    zIndex: 1000,
    pointerEvents: 'none',
    whiteSpace: 'normal',
  }
  switch (position) {
    case 'top':
      return { ...base, bottom: `calc(100% + ${ARROW_SIZE + 4}px)`, left: '50%', transform: 'translateX(-50%)' }
    case 'bottom':
      return { ...base, top: `calc(100% + ${ARROW_SIZE + 4}px)`, left: '50%', transform: 'translateX(-50%)' }
    case 'left':
      return { ...base, right: `calc(100% + ${ARROW_SIZE + 4}px)`, top: '50%', transform: 'translateY(-50%)' }
    case 'right':
      return { ...base, left: `calc(100% + ${ARROW_SIZE + 4}px)`, top: '50%', transform: 'translateY(-50%)' }
  }
}

export function Tooltip({ content, children, position = 'top', maxWidth = 220 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 300)
  }, [])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <span style={tooltipPosition(position)}>
          <span style={{
            display: 'block',
            background: 'var(--card)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-secondary)',
            fontSize: '11px',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.5,
            padding: '6px 10px',
            borderRadius: '6px',
            maxWidth: `${maxWidth}px`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}>
            {content}
          </span>
          <span style={arrowStyle(position)} />
        </span>
      )}
    </span>
  )
}
