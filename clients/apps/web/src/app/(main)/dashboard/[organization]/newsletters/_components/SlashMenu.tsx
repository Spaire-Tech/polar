import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import {
  BlockType,
  newsletterBlockLibrary,
} from '../../email-marketing/_components/blockEditor/types'

/**
 * "/" or "+ Add block" insertion popover. Renders the four sections
 * (Text / Media / Structure / Advanced), filters by query, and calls
 * onPick with the chosen BlockType.
 *
 * Positions itself with a viewport clamp — if the menu would overflow
 * the bottom, it flips above the anchor. The host owns whether to
 * render this at all; clicking outside dismisses via the global
 * mousedown listener.
 */
export function SlashMenu({
  x,
  y,
  onPick,
  onClose,
}: {
  x: number
  y: number
  onPick: (type: BlockType) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement | null>(null)

  // Viewport clamp — flip above the trigger if we'd overflow.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.bottom > window.innerHeight - 16) {
      el.style.top = `${Math.max(16, y - rect.height - 20)}px`
    }
  }, [y])

  // Click-outside dismiss. mousedown beats click so it fires before any
  // re-render races with the host's selection state.
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (!ref.current) return
      if (ref.current.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('mousedown', fn)
    return () => window.removeEventListener('mousedown', fn)
  }, [onClose])

  // Escape closes; enter inserts the first match.
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Enter') {
      const first = filterSections(newsletterBlockLibrary, q).flatMap(
        (s) => s.items,
      )[0]
      if (first) {
        e.preventDefault()
        onPick(first.type)
      }
    }
  }

  const sections = filterSections(newsletterBlockLibrary, q)

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'fixed',
        left: Math.min(Math.max(8, x), window.innerWidth - 308),
        top: y,
        width: 300,
        zIndex: 60,
        background: '#fff',
        border: '1px solid var(--line, #e5e5ea)',
        borderRadius: 12,
        boxShadow:
          '0 12px 32px rgba(20,20,30,0.16), 0 2px 6px rgba(20,20,30,0.06)',
        overflow: 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '8px 8px 0' }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder="Search blocks…"
          style={{
            width: '100%',
            border: '1px solid var(--line, #e5e5ea)',
            borderRadius: 8,
            padding: '7px 11px',
            fontSize: 13,
            outline: 'none',
            background: '#fafafa',
          }}
        />
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto', padding: '4px 6px 8px' }}>
        {sections.length === 0 ? (
          <div
            style={{
              padding: '20px 8px',
              fontSize: 12.5,
              color: '#86868b',
              textAlign: 'center',
            }}
          >
            No blocks match “{q}”
          </div>
        ) : (
          sections.map((s) => (
            <div key={s.section}>
              <div
                style={{
                  padding: '10px 8px 4px',
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                  color: '#86868b',
                }}
              >
                {s.section}
              </div>
              {s.items.map((it) => (
                <button
                  key={it.type}
                  type="button"
                  onClick={() => onPick(it.type)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 8px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f4f4f7'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      display: 'grid',
                      placeItems: 'center',
                      background: '#fafafa',
                      border: '1px solid var(--line, #e5e5ea)',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={it.icon} size={14} />
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, color: '#1d1d1f', fontWeight: 500 }}>
                      {it.label}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#86868b' }}>
                      {it.desc}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function filterSections(
  sections: typeof newsletterBlockLibrary,
  q: string,
): typeof newsletterBlockLibrary {
  const needle = q.trim().toLowerCase()
  if (!needle) return sections
  return sections
    .map((s) => ({
      ...s,
      items: s.items.filter((it) =>
        (it.label + ' ' + it.desc).toLowerCase().includes(needle),
      ),
    }))
    .filter((s) => s.items.length > 0)
}
