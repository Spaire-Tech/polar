'use client'

// Shared primitives for the coaching editor — ported from ui.jsx in the
// design handoff. All visuals come from coaching-editor.css; markup
// matches the design 1:1.

import { useEffect, useRef, type ReactNode } from 'react'

export function Btn({
  variant = 'default',
  size = 'md',
  icon,
  children,
  className,
  ...rest
}: {
  variant?: 'default' | 'primary' | 'ghost'
  size?: 'md' | 'sm' | 'icon'
  icon?: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ['ce-btn']
  if (variant === 'primary') cls.push('ce-btn-primary')
  if (variant === 'ghost') cls.push('ce-btn-ghost')
  if (size === 'sm') cls.push('ce-btn-sm')
  if (size === 'icon') cls.push('ce-btn-icon')
  if (className) cls.push(className)
  return (
    <button className={cls.join(' ')} {...rest}>
      {icon}
      {children}
    </button>
  )
}

export function Toggle({
  on,
  onChange,
}: {
  on: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      className={'ce-toggle' + (on ? ' on' : '')}
      onClick={() => onChange(!on)}
      aria-pressed={on}
    />
  )
}

export function Check({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      className={'ce-check' + (checked ? ' checked' : '')}
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      role="checkbox"
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12.5l4 4L19 7" />
      </svg>
    </button>
  )
}

const AVATAR_PALETTE = [
  '#d36a2a',
  '#1d9d6a',
  '#5856d6',
  '#0a84ff',
  '#af52de',
  '#ff9f0a',
  '#ff375f',
  '#30b0c7',
  '#34c759',
  '#bf5af2',
]

export function Avatar({
  name,
  size = 28,
  color,
}: {
  name: string
  size?: number
  color?: string
}) {
  const initials = name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0)
  const bg = color || AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
  return (
    <div
      className="ce-avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: bg,
      }}
    >
      {initials || '?'}
    </div>
  )
}

export function Pill({
  tone = 'default',
  className,
  children,
}: {
  tone?: 'default' | 'success' | 'warn' | 'solid'
  className?: string
  children: ReactNode
}) {
  const cls = 'ce-chip' + (tone !== 'default' ? ' ' + tone : '')
  return <span className={className ? `${cls} ${className}` : cls}>{children}</span>
}

export function Menu({
  open,
  onClose,
  children,
  anchor = 'right',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  anchor?: 'left' | 'right'
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      className="ce-menu"
      ref={ref}
      style={anchor === 'left' ? { left: 12, right: 'auto' } : undefined}
    >
      {children}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  if (!open) return null
  return (
    <div className="ce-modal-backdrop" onClick={onClose}>
      <div className="ce-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ce-modal-head">
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="ce-modal-body">{children}</div>
        {footer && <div className="ce-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function SectionHead({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="ce-section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ce-row">{actions}</div>}
    </div>
  )
}

export function EmptyState({
  glyph,
  title,
  body,
  action,
}: {
  glyph: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="ce-empty">
      <div className="glyph">{glyph}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  )
}
