'use client'

// Inline edit primitives. Wrap text with EditText to make it click-to-edit.
// Wrap media tiles with EditMedia to get a hover dashed-border + Replace
// popover. Wrap a section with EditBlock to get the section affordance pill.
//
// In `preview` mode the wrappers fall through to plain rendering with no
// affordances. So the same component tree is used for both modes.

import type { LandingMedia } from '@/hooks/queries/courses'
import { useEditor } from './EditorContext'
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'

// ── EditText ────────────────────────────────────────────────────────────────

export function EditText({
  path,
  defaultValue,
  as = 'span',
  style,
  className,
  multiline = false,
}: {
  path: string
  defaultValue: string
  as?: ElementType
  style?: CSSProperties
  className?: string
  multiline?: boolean
}) {
  const ed = useEditor()
  const ref = useRef<HTMLElement>(null)
  const [editing, setEditing] = useState(false)
  const value = ed.t(path, defaultValue)
  const Tag = as as ElementType

  // Keep DOM in sync with value when not editing (avoids React tripping over
  // contentEditable).
  useEffect(() => {
    if (editing) return
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value
    }
  }, [value, editing])

  if (ed.mode !== 'edit') {
    return (
      <Tag style={style} className={className}>
        {value}
      </Tag>
    )
  }

  const onBlur = () => {
    setEditing(false)
    const next = (ref.current?.innerText ?? '').replace(/\n+$/, '')
    if (next !== value) ed.setText(path, next)
  }

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      style={{
        ...style,
        outline: editing ? '2px solid #6366f1' : undefined,
        outlineOffset: 2,
        borderRadius: 3,
        cursor: editing ? 'text' : 'pointer',
        transition: 'outline-color 120ms ease',
      }}
      className={className}
      contentEditable={editing}
      suppressContentEditableWarning
      data-spaire-edit-text=""
      onClick={(e: React.MouseEvent<HTMLElement>) => {
        if (editing) return
        e.stopPropagation()
        setEditing(true)
        setTimeout(() => {
          ref.current?.focus()
          // Place caret at end
          const range = document.createRange()
          range.selectNodeContents(ref.current!)
          range.collapse(false)
          const sel = window.getSelection()
          sel?.removeAllRanges()
          sel?.addRange(range)
        }, 0)
      }}
      onBlur={onBlur}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLElement).blur()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          ;(e.target as HTMLElement).blur()
        }
      }}
    >
      {value}
    </Tag>
  )
}

// ── EditMedia ───────────────────────────────────────────────────────────────

export const EditMedia = forwardRef<
  HTMLDivElement,
  {
    id: string
    label: string
    style?: CSSProperties
    className?: string
    fit?: 'cover' | 'contain'
    /** Default visual when no media is uploaded. */
    children?: ReactNode
    /** When the host wants to render the uploaded media itself
     *  (e.g. the hero section that already has its own object-position),
     *  pass `renderMedia` and we'll skip the default <img>/<video> overlay.
     */
    renderMedia?: (media: LandingMedia) => ReactNode
  }
>(function EditMedia(
  { id, label, style, className, fit = 'cover', children, renderMedia },
  ref,
) {
  const ed = useEditor()
  const m = ed.m(id)
  const [hover, setHover] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = ed.uploaderForSlot?.(id) ?? ed.uploadMedia

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    setPopoverOpen(false)
    try {
      const next = await upload(f)
      ed.setMedia(id, { ...next, name: f.name })
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const onPasteUrl = () => {
    setPopoverOpen(false)
    const url = window.prompt('Paste an image or video URL:')
    if (!url) return
    const isVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
    ed.setMedia(id, { kind: isVideo ? 'video' : 'image', url, name: 'remote' })
  }

  const cover: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: fit,
    zIndex: 1,
  }

  return (
    <div
      ref={ref}
      style={{ ...style, position: 'relative', isolation: 'isolate' }}
      className={className}
      data-spaire-edit-media={id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setPopoverOpen(false)
      }}
    >
      {/* Default placeholder */}
      {children}
      {/* Uploaded media — host can render its own */}
      {m && (renderMedia ? renderMedia(m) : m.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.url} alt="" style={cover} />
      ) : (
        <video src={m.url} autoPlay muted loop playsInline style={cover} />
      ))}
      {ed.mode === 'edit' && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              pointerEvents: 'none',
              border: hover
                ? '2px dashed rgba(99,102,241,0.85)'
                : '2px dashed transparent',
              borderRadius: 'inherit',
              transition: 'border-color 150ms ease',
            }}
          />
          {hover && (
            <div
              style={{
                position: 'absolute',
                left: 12,
                top: 12,
                zIndex: 6,
                background: 'rgba(20,20,22,0.85)',
                color: 'white',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                padding: '4px 9px',
                borderRadius: 999,
                textTransform: 'uppercase',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {label}
            </div>
          )}
          {hover && (
            <div
              style={{
                position: 'absolute',
                right: 12,
                top: 12,
                zIndex: 6,
                display: 'flex',
                gap: 6,
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPopoverOpen((p) => !p)
                }}
                disabled={busy}
                style={pillBtn}
              >
                {busy ? 'Uploading…' : m ? 'Replace' : 'Add media'}
              </button>
              {m && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    ed.setMedia(id, null)
                  }}
                  style={{ ...pillBtn, background: 'rgba(255,80,80,0.92)' }}
                >
                  Remove
                </button>
              )}
            </div>
          )}
          {popoverOpen && (
            <div
              style={{
                position: 'absolute',
                right: 12,
                top: 52,
                zIndex: 7,
                width: 240,
                background: 'white',
                color: '#111',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12,
                padding: 10,
                boxShadow:
                  '0 16px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                  padding: '0 4px',
                }}
              >
                Replace {label}
              </div>
              <button
                type="button"
                style={popoverBtn}
                onClick={() => fileRef.current?.click()}
              >
                ⬆ Upload from device
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={onFile}
              />
              <button type="button" style={popoverBtn} onClick={onPasteUrl}>
                🔗 Paste URL
              </button>
              <button
                type="button"
                style={popoverBtn}
                onClick={() => {
                  ed.setMedia(id, null)
                  setPopoverOpen(false)
                }}
              >
                ↺ Use placeholder
              </button>
              {m?.name && (
                <div
                  style={{
                    fontSize: 11,
                    color: '#666',
                    marginTop: 6,
                    padding: '6px 8px',
                    background: '#f4f4f5',
                    borderRadius: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.name}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
})

const pillBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(20,20,22,0.92)',
  color: 'white',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)',
  fontFamily: 'Inter, system-ui, sans-serif',
}

const popoverBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  background: 'transparent',
  color: '#111',
  fontSize: 12.5,
  fontWeight: 500,
  textAlign: 'left',
  cursor: 'pointer',
  border: 'none',
}

// ── EditBlock ───────────────────────────────────────────────────────────────

export function EditBlock({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: ReactNode
}) {
  const ed = useEditor()
  const [hover, setHover] = useState(false)
  const visible = ed.isVisible(id)

  if (!visible && ed.mode === 'preview') return null
  if (ed.mode !== 'edit') return <>{children}</>

  return (
    <div
      style={{
        position: 'relative',
        outline: hover
          ? '1px solid rgba(99,102,241,0.55)'
          : '1px solid transparent',
        borderRadius: 6,
        opacity: visible ? 1 : 0.35,
        transition: 'outline-color 150ms ease',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-spaire-edit-block={id}
    >
      {hover && (
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 16,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(20,20,22,0.9)',
            color: 'white',
            borderRadius: 999,
            padding: '5px 8px 5px 12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {label}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              ed.setVisible(id, !visible)
            }}
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.10)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
              fontSize: 11,
            }}
            title={visible ? 'Hide section' : 'Show section'}
          >
            {visible ? '👁' : '⊘'}
          </button>
        </div>
      )}
      {children}
    </div>
  )
}
