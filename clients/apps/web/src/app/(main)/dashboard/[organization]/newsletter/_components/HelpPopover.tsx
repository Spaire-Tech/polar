import { useEffect, useRef } from 'react'

/**
 * Floating keyboard-shortcuts cheat sheet anchored to the help button
 * in the top bar. Dismisses on outside click; the parent owns the
 * open/closed state.
 */
export function HelpPopover({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current) return
      if (ref.current.contains(e.target as Node)) return
      onClose()
    }
    // Defer one tick so the click that opened us doesn't immediately
    // close us via the same event listener.
    const t = window.setTimeout(
      () => window.addEventListener('mousedown', fn),
      0,
    )
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousedown', fn)
    }
  }, [onClose])

  const groups: { title: string; rows: [string, string][] }[] = [
    {
      title: 'Editor',
      rows: [
        ['Insert block menu', '/'],
        ['Search & commands', '⌘K'],
        ['Save', '⌘S'],
        ['Undo', '⌘Z'],
        ['Redo', '⇧⌘Z'],
      ],
    },
    {
      title: 'Navigation',
      rows: [
        ['Write mode', '⌘1'],
        ['Style mode', '⌘2'],
        ['Publish', '⌘↵'],
        ['Close popover', 'Esc'],
      ],
    },
  ]

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Keyboard shortcuts"
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        width: 280,
        zIndex: 50,
        background: '#fff',
        border: '1px solid #e5e5ea',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(20,20,30,0.16)',
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1d1d1f', marginBottom: 8 }}>
        Keyboard shortcuts
      </div>
      {groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#86868b',
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            {g.title}
          </div>
          {g.rows.map(([label, key]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: '#3a3a3c',
                padding: '3px 0',
              }}
            >
              <span>{label}</span>
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                  color: '#86868b',
                  background: '#fafafa',
                  border: '1px solid #e5e5ea',
                  borderRadius: 4,
                  padding: '1px 6px',
                }}
              >
                {key}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
