import { useEffect, useState } from 'react'
import { Icon } from '../../email-marketing/_components/Icon'
import { BlockType } from '../../email-marketing/_components/blockEditor/types'

export type Command = {
  id: string
  group: 'View' | 'Actions' | 'Insert' | 'Tools'
  name: string
  hint?: string
  icon: string
  shortcut?: string
  // Special-cased for insert items so the parent doesn't have to map id
  // strings back to block types.
  insertType?: BlockType
  run: () => void
}

/**
 * ⌘K command palette. Lists actions provided by the host (view
 * switching, publish, send test, block inserts, …) and runs the
 * selected one on Enter. Keyboard nav: ↑/↓ to move, Enter to run, Esc
 * to close. Fuzzy filter on `name` + `group`.
 *
 * The hotkey itself (⌘K) is registered by the host so it can survive
 * the palette being unmounted.
 */
export function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[]
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)

  const filtered = q.trim()
    ? commands.filter((c) =>
        (c.name + ' ' + c.group + ' ' + (c.hint ?? ''))
          .toLowerCase()
          .includes(q.trim().toLowerCase()),
      )
    : commands

  // Reset selected index on query change in the input handler rather
  // than in a syncing effect — keeps active in lockstep with q without
  // a cascading render.
  const onQueryChange = (next: string) => {
    setQ(next)
    setActive(0)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(filtered.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        const c = filtered[active]
        if (c) {
          e.preventDefault()
          c.run()
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, filtered, onClose])

  // Group while preserving the active-index path (`filtered` is the
  // flat list the arrow keys + Enter operate on).
  const grouped: Record<string, { cmd: Command; flatIndex: number }[]> = {}
  filtered.forEach((c, i) => {
    if (!grouped[c.group]) grouped[c.group] = []
    grouped[c.group].push({ cmd: c, flatIndex: i })
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,20,30,0.32)',
        backdropFilter: 'blur(4px)',
        display: 'grid',
        placeItems: 'flex-start center',
        paddingTop: 100,
        zIndex: 80,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 600,
          maxWidth: '90vw',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e5e5ea',
          boxShadow: '0 24px 60px rgba(20,20,30,0.24)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px',
            borderBottom: '1px solid #e5e5ea',
          }}
        >
          <Icon name="search" size={15} />
          <input
            autoFocus
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Type a command or search…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: '#1d1d1f',
            }}
          />
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
            esc
          </span>
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '24px 12px',
                textAlign: 'center',
                color: '#86868b',
                fontSize: 13,
              }}
            >
              No matches for “{q}”
            </div>
          ) : (
            Object.entries(grouped).map(([group, rows]) => (
              <div key={group}>
                <div
                  style={{
                    padding: '8px 12px 4px',
                    fontSize: 10.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontWeight: 600,
                    color: '#86868b',
                  }}
                >
                  {group}
                </div>
                {rows.map(({ cmd, flatIndex }) => (
                  <button
                    key={cmd.id}
                    type="button"
                    onMouseEnter={() => setActive(flatIndex)}
                    onClick={() => {
                      cmd.run()
                      onClose()
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 7,
                      border: 'none',
                      background:
                        flatIndex === active ? '#f4f4f7' : 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        display: 'grid',
                        placeItems: 'center',
                        background: '#fff',
                        border: '1px solid #e5e5ea',
                        color: '#3a3a3c',
                      }}
                    >
                      <Icon name={cmd.icon} size={13} />
                    </span>
                    <span
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <span style={{ fontSize: 13, color: '#1d1d1f' }}>
                        {cmd.name}
                      </span>
                      {cmd.hint && (
                        <span style={{ fontSize: 11.5, color: '#86868b' }}>
                          {cmd.hint}
                        </span>
                      )}
                    </span>
                    {cmd.shortcut && (
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
                        {cmd.shortcut}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
