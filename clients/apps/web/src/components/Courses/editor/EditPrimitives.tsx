'use client'

// Inline edit primitives. Wrap text with EditText to make it click-to-edit.
// Wrap media tiles with EditMedia to get a hover dashed-border + Replace
// popover. Wrap a section with EditBlock to get the section affordance pill.
//
// In `preview` mode the wrappers fall through to plain rendering with no
// affordances. So the same component tree is used for both modes.

import type { LandingMedia } from '@/hooks/queries/courses'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ToastAction } from '../../Toast'
import { toast } from '../../Toast/use-toast'
import { useEditor } from './EditorContext'
import { applyTextFormatStyle, TextFormatToolbar } from './TextFormatToolbar'

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
  // Read the raw stored text (may be empty if the user cleared it). The
  // empty-state branch below decides whether to fall back to defaultValue or
  // show the "+ Add" stub.
  const stored = ed.overrides.text[path]
  const value = stored ?? defaultValue
  const isEmpty = stored === ''
  const fmt = ed.overrides.textFormat[path]
  const Tag = as as ElementType

  // Merge user-applied formatting on top of the parent's inline style. Order
  // matters: the parent style sets the template's intent, the format
  // overrides ride on top.
  const mergedStyle = applyTextFormatStyle(style, fmt)

  // Keep DOM in sync with value when not editing (avoids React tripping over
  // contentEditable).
  useEffect(() => {
    if (editing) return
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value
    }
  }, [value, editing])

  if (ed.mode !== 'edit') {
    // Preview / public rendering. Empty stored value means the user
    // deliberately removed this text — render nothing so the layout reflows
    // and there's no ghost of the original element.
    if (isEmpty) return null
    return (
      <Tag style={mergedStyle} className={className}>
        {value}
      </Tag>
    )
  }

  // Edit mode, but the text has been cleared. Render a small "+ Add" stub
  // in its place so the user can bring the text back. Doesn't try to
  // reproduce the parent's layout — it's intentionally small so the rest of
  // the section visibly reflows around the absence.
  if (isEmpty && !editing) {
    return (
      <EmptyTextSlot
        onRestore={() => {
          // Restore the template default AND enter editing in the same
          // event so React batches into a single render; deferring focus
          // to the next tick lets the Tag attach to ref before we focus.
          ed.setText(path, defaultValue)
          setEditing(true)
          setTimeout(() => {
            ref.current?.focus()
            if (!ref.current) return
            const range = document.createRange()
            range.selectNodeContents(ref.current)
            range.collapse(false)
            const sel = window.getSelection()
            sel?.removeAllRanges()
            sel?.addRange(range)
          }, 0)
        }}
      />
    )
  }

  const onBlur = () => {
    setEditing(false)
    const next = (ref.current?.innerText ?? '').replace(/\n+$/, '')
    if (next !== value) ed.setText(path, next)
  }

  return (
    <>
      <Tag
        ref={ref as React.Ref<HTMLElement>}
        style={{
          ...mergedStyle,
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
      {editing ? (
        <TextFormatToolbar
          path={path}
          anchor={ref.current as HTMLElement | null}
        />
      ) : null}
    </>
  )
}

// Replacement chrome for a cleared EditText. Reads as "this text was removed
// — bring it back" without trying to mimic the original element's heading or
// body styling (which would imply the original is still there). The button is
// inline-block so it lays out wherever the original sat without forcing a
// full-width row.
function EmptyTextSlot({ onRestore }: { onRestore: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onRestore()
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        background: 'rgba(99,102,241,0.08)',
        color: 'rgba(99,102,241,0.95)',
        border: '1px dashed rgba(99,102,241,0.4)',
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily: 'Inter, system-ui, sans-serif',
        cursor: 'pointer',
        lineHeight: 1.4,
        verticalAlign: 'middle',
      }}
    >
      <span aria-hidden style={{ fontSize: 12 }}>
        +
      </span>
      <span>Add text</span>
    </button>
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
    /** Default visual when no media is uploaded.
     *  Pass via `placeholder` so it disappears once the user uploads media.
     *  `children` always renders (use it for labels / controls that should
     *  stay on top of the uploaded media). */
    placeholder?: ReactNode
    /** Always-rendered overlays (labels, controls) on top of the media. */
    children?: ReactNode
    /** When the host wants to render the uploaded media itself
     *  (e.g. the hero section that already has its own object-position),
     *  pass `renderMedia` and we'll skip the default <img>/<video> overlay.
     */
    renderMedia?: (media: LandingMedia) => ReactNode
    /** Suppress the hover Replace/Remove pill + label overlay. Use this when
     *  the host renders its own controls (e.g. the hero's add-image /
     *  add-trailer buttons) so they don't get duplicated. */
    chromeless?: boolean
    /** Optional URL the host already has on hand (e.g. challenge.thumbnail_url,
     *  uploaded via a sibling flow). Renders as the base layer when no
     *  per-slot media override exists, ahead of the placeholder. The user
     *  can still upload a per-slot override that takes precedence — the
     *  fallback just keeps creator-uploaded thumbnails visible on the
     *  public landing without forcing a separate Replace action.
     */
    fallbackImageUrl?: string | null
  }
>(function EditMedia(
  {
    id,
    label,
    style,
    className,
    fit = 'cover',
    placeholder,
    children,
    renderMedia,
    chromeless,
    fallbackImageUrl,
  },
  ref,
) {
  const ed = useEditor()
  const m = ed.m(id)
  const [hover, setHover] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  // When true, an inline draggable overlay lets the user reposition the
  // image's object-position. The result persists to `m.objectPosition`
  // through ed.setMedia and propagates to every other render site that
  // reads from this slot.
  const [reposMode, setReposMode] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const replaceBtnRef = useRef<HTMLButtonElement>(null)
  const [popoverPos, setPopoverPos] = useState<{
    top: number
    left: number
  } | null>(null)

  // Recompute the popover position (anchored to the Replace button) whenever
  // it opens or the layout shifts. Using a portal + position:fixed lets the
  // popover escape clipped ancestors (e.g. the rounded section thumb).
  useLayoutEffect(() => {
    if (!popoverOpen) return
    const measure = () => {
      const r = replaceBtnRef.current?.getBoundingClientRect()
      if (!r) return
      const POP_W = 240
      const margin = 8
      const left = Math.max(
        margin,
        Math.min(r.right - POP_W, window.innerWidth - POP_W - margin),
      )
      setPopoverPos({ top: r.bottom + 8, left })
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [popoverOpen])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!popoverOpen) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (replaceBtnRef.current?.contains(target)) return
      const pop = document.querySelector(`[data-spaire-edit-media-pop="${id}"]`)
      if (pop && pop.contains(target)) return
      setPopoverOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [popoverOpen, id])

  // Reset load-error state whenever the media URL changes so a successful
  // re-upload clears any prior failure banner.
  useEffect(() => {
    setLoadError(null)
  }, [m?.url])

  const upload = ed.uploaderForSlot?.(id) ?? ed.uploadMedia

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    setPopoverOpen(false)
    try {
      const next = await upload(f)
      if (!next?.url) {
        // eslint-disable-next-line no-console
        console.error('[EditMedia] upload returned empty url', { id, next })
        toast({
          title: `Upload failed for ${id}`,
          description: 'Server returned an empty url. See console for details.',
        })
        return
      }
      ed.setMedia(id, { ...next, name: f.name })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // eslint-disable-next-line no-console
      console.error('[EditMedia] upload failed', { id, file: f.name }, err)
      toast({
        title: `Upload failed for ${id}`,
        description: message,
      })
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
    objectPosition: m?.objectPosition ?? '50% 50%',
    zIndex: 1,
  }

  return (
    <div
      ref={ref}
      style={{ position: 'relative', isolation: 'isolate', ...style }}
      className={className}
      data-spaire-edit-media={id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        // Note: do NOT close the popover on mouseleave. Opening the OS file
        // picker moves the cursor outside the container, which would unmount
        // the popover (and the <input>) before the user picks a file — the
        // upload would silently never fire. The popover closes when an
        // action completes or when the user clicks elsewhere.
      }}
    >
      {/* File input is rendered unconditionally (outside the popover) so it
          stays mounted while the OS file picker is open. */}
      {ed.mode === 'edit' && !chromeless && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          hidden
          onChange={onFile}
        />
      )}
      {/* Placeholder — hidden once media is uploaded so the upload is the
          only visual at the base of the stack. fallbackImageUrl wins
          over the placeholder when set: it lets a sibling upload flow
          (e.g. challenge.thumbnail_url) seed the slot without forcing
          the creator to re-upload here. */}
      {!m && fallbackImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallbackImageUrl}
          alt=""
          style={cover}
        />
      )}
      {!m && !fallbackImageUrl && placeholder}
      {/* Uploaded media — host can render its own */}
      {m &&
        (renderMedia ? (
          renderMedia(m)
        ) : m.kind === 'image' ? (
          // Keying on the URL forces React to remount the <img> when the
          // media URL changes (e.g. after a Replace), bypassing browser
          // image caching that would otherwise show the previous frame.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={m.url}
            src={m.url}
            alt=""
            style={cover}
            onError={(e) => {
              const img = e.currentTarget
              // eslint-disable-next-line no-console
              console.error('[EditMedia] image failed to load', {
                id,
                url: m.url,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
              })
              setLoadError(
                `Image blocked or unreachable. Open ${m.url} in a new tab to test.`,
              )
            }}
          />
        ) : (
          <video
            key={m.url}
            src={m.url}
            autoPlay
            muted
            loop
            playsInline
            style={cover}
            onError={(e) => {
              const v = e.currentTarget
              // eslint-disable-next-line no-console
              console.error('[EditMedia] video failed to load', {
                id,
                url: m.url,
                code: v.error?.code,
                message: v.error?.message,
                networkState: v.networkState,
                readyState: v.readyState,
              })
              setLoadError(
                `Video blocked or unreachable (code ${v.error?.code ?? '?'}).`,
              )
            }}
          />
        ))}
      {loadError && ed.mode === 'edit' && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            bottom: 12,
            zIndex: 8,
            maxWidth: 'calc(100% - 24px)',
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(220, 38, 38, 0.95)',
            color: 'white',
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.4,
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}
          title={m?.url}
        >
          ⚠ {loadError}
        </div>
      )}
      {/* Always-on overlays (labels, controls) sit on top of the media. */}
      {children}
      {ed.mode === 'edit' && !chromeless && (
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
          {hover && !reposMode && (
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
                ref={replaceBtnRef}
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
              {m && m.kind === 'image' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setReposMode(true)
                    setPopoverOpen(false)
                  }}
                  style={pillBtn}
                  title="Drag to reposition the image inside this frame"
                >
                  Reposition
                </button>
              )}
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
          {reposMode && m && m.kind === 'image' && (
            <ReposOverlay
              media={m}
              onChange={(next) =>
                ed.setMedia(id, { ...m, objectPosition: next })
              }
              onDone={() => setReposMode(false)}
            />
          )}
          {popoverOpen &&
            popoverPos &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                data-spaire-edit-media-pop={id}
                style={{
                  position: 'fixed',
                  top: popoverPos.top,
                  left: popoverPos.left,
                  zIndex: 1000,
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
              </div>,
              document.body,
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

// ── ReposOverlay ────────────────────────────────────────────────────────────

// Inline drag-to-reposition overlay. Sits on top of the actual rendered
// image at the same size, so what the user sees while dragging IS what
// will show on the public landing — no separate mini-positioner widget.
// Emits the new object-position on every move and persists on release.
function clampPct(value: number) {
  return Math.min(100, Math.max(0, value))
}
function parsePos(value: string | undefined): { x: number; y: number } {
  const fallback = { x: 50, y: 50 }
  if (!value) return fallback
  const parts = value.trim().split(/\s+/)
  if (parts.length !== 2) return fallback
  const x = parseFloat(parts[0])
  const y = parseFloat(parts[1])
  if (Number.isNaN(x) || Number.isNaN(y)) return fallback
  return { x: clampPct(x), y: clampPct(y) }
}
function fmtPos(x: number, y: number) {
  return `${x.toFixed(1)}% ${y.toFixed(1)}%`
}

function ReposOverlay({
  media,
  onChange,
  onDone,
}: {
  media: LandingMedia
  onChange: (next: string) => void
  onDone: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(() => parsePos(media.objectPosition))
  const [dragging, setDragging] = useState(false)

  const setFromPoint = (clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clampPct(((clientX - rect.left) / rect.width) * 100)
    const y = clampPct(((clientY - rect.top) / rect.height) * 100)
    setPos({ x, y })
    onChange(fmtPos(x, y))
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      e.preventDefault()
      setFromPoint(e.clientX, e.clientY)
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  // Esc / Enter / Outside-click → finish reposition mode. The position was
  // already committed via onChange on every move, so this is purely UI.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onDone()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  return (
    <>
      {/* Click target — covers the image itself */}
      <div
        ref={containerRef}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setFromPoint(e.clientX, e.clientY)
          setDragging(true)
        }}
        onTouchStart={(e) => {
          const t = e.touches[0]
          if (t) setFromPoint(t.clientX, t.clientY)
        }}
        onTouchMove={(e) => {
          const t = e.touches[0]
          if (t) setFromPoint(t.clientX, t.clientY)
        }}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 7,
          cursor: dragging ? 'grabbing' : 'grab',
          background:
            'radial-gradient(circle at var(--rp-x) var(--rp-y), rgba(99,102,241,0.18) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.55) 100%)',
          // CSS custom prop for the radial highlight; updated via inline style
          ...({
            '--rp-x': `${pos.x}%`,
            '--rp-y': `${pos.y}%`,
          } as CSSProperties),
        }}
      />
      {/* Cross-hair indicator */}
      <div
        style={{
          position: 'absolute',
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          width: 14,
          height: 14,
          marginLeft: -7,
          marginTop: -7,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.95)',
          border: '2px solid #6366f1',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          zIndex: 8,
          pointerEvents: 'none',
        }}
      />
      {/* Help text + Done button — top-right */}
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: 12,
          zIndex: 9,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px 6px 12px',
          borderRadius: 999,
          background: 'rgba(20,20,22,0.92)',
          color: 'white',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 600 }}>
          Drag to reposition · {pos.x.toFixed(0)}% × {pos.y.toFixed(0)}%
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDone()
          }}
          style={{
            ...pillBtn,
            background: 'white',
            color: '#111',
            padding: '5px 11px',
          }}
        >
          Done
        </button>
      </div>
    </>
  )
}

// ── EditBlock ───────────────────────────────────────────────────────────────

export function EditBlock({
  id,
  label,
  children,
  marginTop = 0,
}: {
  id: string
  label: string
  children: ReactNode
  // Extra gap above this section, driven by overrides.spacingBefore. Applied
  // in preview/public render only — in edit mode the inter-section
  // SpacingHandle owns the gap so the handle stays interactive at the
  // boundary.
  marginTop?: number
}) {
  const ed = useEditor()
  const [hover, setHover] = useState(false)
  const visible = ed.isVisible(id)

  // useSortable must be called unconditionally (hook rules). We branch on
  // ed.mode AFTER the hook call below so preview/edit switches don't change
  // hook order on an unmount.
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  if (!visible && ed.mode === 'preview') return null
  if (ed.mode !== 'edit') {
    // Wrap in a thin marginTop div so the saved inter-section spacing
    // applies to the public render too. When marginTop is 0 this is a
    // no-op wrapper — semantically identical to the previous Fragment.
    return marginTop > 0 ? (
      <div style={{ marginTop }}>{children}</div>
    ) : (
      <>{children}</>
    )
  }

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    ed.deleteSection(id)
    toast({
      title: `${label} removed`,
      description: 'Use Undo to bring it back, or add it from the catalog.',
      action: (
        <ToastAction altText="Undo" onClick={() => ed.undo()}>
          Undo
        </ToastAction>
      ),
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'relative',
        outline:
          hover && !isDragging
            ? '1px solid rgba(99,102,241,0.55)'
            : '1px solid transparent',
        borderRadius: 6,
        opacity: isDragging ? 0.45 : visible ? 1 : 0.35,
        transition:
          // dnd-kit drives the transform transition; keep our own ease on the
          // outline color so hover still feels snappy.
          [transition, 'outline-color 150ms ease'].filter(Boolean).join(', '),
        transform: CSS.Transform.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-spaire-edit-block={id}
    >
      {hover && !isDragging && (
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
            padding: '5px 8px 5px 8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <button
            type="button"
            aria-label="Drag to reorder"
            title="Drag to reorder"
            // Listeners + attributes are passed to the HANDLE only, not the
            // whole block — that way clicking anywhere else in the section
            // (text fields, images) never accidentally starts a drag.
            {...attributes}
            {...listeners}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.10)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            <BlockDragIcon />
          </button>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: 'ui-monospace, monospace',
              padding: '0 4px',
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
            style={blockPillBtn}
            title={visible ? 'Hide section' : 'Show section'}
          >
            {visible ? '👁' : '⊘'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            style={blockPillBtn}
            title="Delete section"
            aria-label="Delete section"
          >
            <BlockTrashIcon />
          </button>
        </div>
      )}
      {children}
    </div>
  )
}

const blockPillBtn: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.10)',
  color: 'white',
  border: '1px solid rgba(255,255,255,0.12)',
  cursor: 'pointer',
  fontSize: 11,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}

function BlockDragIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="4" r="0.6" fill="currentColor" />
      <circle cx="10" cy="4" r="0.6" fill="currentColor" />
      <circle cx="6" cy="8" r="0.6" fill="currentColor" />
      <circle cx="10" cy="8" r="0.6" fill="currentColor" />
      <circle cx="6" cy="12" r="0.6" fill="currentColor" />
      <circle cx="10" cy="12" r="0.6" fill="currentColor" />
    </svg>
  )
}

function BlockTrashIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4h10" />
      <path d="M6.5 4V2.5h3V4" />
      <path d="M4.5 4l.6 8.5a1.2 1.2 0 0 0 1.2 1.1h3.4a1.2 1.2 0 0 0 1.2-1.1L11.5 4" />
      <path d="M7 6.5v5M9 6.5v5" />
    </svg>
  )
}
