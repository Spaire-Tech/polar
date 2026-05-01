'use client'

// Webflow-style inline edit primitives for the Customize tab.
// EditText: click any text to edit in place.
// EditMedia: hover any media tile to upload/replace/remove.
// EditBlock: hover any section to see its label + visibility toggle.

import { useUploadLandingMedia } from '@/hooks/queries/courses'
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ElementType,
} from 'react'

// ── Editor context ──────────────────────────────────────────────────────────

export type EditorMode = 'edit' | 'preview'
export type EditorDevice = 'desktop' | 'tablet' | 'mobile'
export type EditorPanel = 'sections' | 'content' | 'media'

export type LandingMediaKind = 'image' | 'video'
export type LandingMedia = { kind: LandingMediaKind; url: string }

export type LandingOverrides = {
  text: Record<string, string>
  media: Record<string, LandingMedia | null>
  visible: Record<string, boolean>
}

type EditorContextValue = {
  mode: EditorMode
  setMode: (m: EditorMode) => void
  device: EditorDevice
  setDevice: (d: EditorDevice) => void
  panel: EditorPanel
  setPanel: (p: EditorPanel) => void
  overrides: LandingOverrides
  t: (path: string, fallback: string) => string
  setText: (path: string, value: string) => void
  m: (id: string) => LandingMedia | null
  setMedia: (id: string, value: LandingMedia | null) => void
  setVisible: (id: string, visible: boolean) => void
  uploadMedia: (file: File) => Promise<LandingMedia>
  isUploading: boolean
}

const EditorContext = createContext<EditorContextValue | null>(null)
export const useEditor = () => {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditor must be used inside EditorProvider')
  return ctx
}

export function EditorProvider({
  courseId,
  initialOverrides,
  onChange,
  children,
}: {
  courseId: string
  initialOverrides: LandingOverrides
  onChange: (next: LandingOverrides) => void
  children: React.ReactNode
}) {
  const [mode, setMode] = useState<EditorMode>('edit')
  const [device, setDevice] = useState<EditorDevice>('desktop')
  const [panel, setPanel] = useState<EditorPanel>('sections')
  const overridesRef = useRef(initialOverrides)
  const upload = useUploadLandingMedia()

  // Use a ref so we don't refetch initialOverrides on every render but still
  // commit changes immediately — onChange owns persistence.
  const setOverrides = (next: LandingOverrides) => {
    overridesRef.current = next
    onChange(next)
  }

  const t = (path: string, fallback: string) =>
    overridesRef.current.text[path] ?? fallback

  const setText = (path: string, value: string) => {
    setOverrides({
      ...overridesRef.current,
      text: { ...overridesRef.current.text, [path]: value },
    })
  }

  const m = (id: string) => overridesRef.current.media[id] ?? null

  const setMedia = (id: string, value: LandingMedia | null) => {
    setOverrides({
      ...overridesRef.current,
      media: { ...overridesRef.current.media, [id]: value },
    })
  }

  const setVisible = (id: string, visible: boolean) => {
    setOverrides({
      ...overridesRef.current,
      visible: { ...overridesRef.current.visible, [id]: visible },
    })
  }

  const uploadMedia = async (file: File): Promise<LandingMedia> => {
    const res = await upload.mutateAsync({ courseId, file })
    return { kind: res.kind, url: res.url }
  }

  // Note: re-render uses the snapshot in initialOverrides via React state if
  // parent passes a fresh prop. Children that read via t/m use the ref so
  // they always see latest. To trigger re-renders, force one on changes:
  const [, forceTick] = useState(0)
  const wrapped: EditorContextValue = {
    mode,
    setMode,
    device,
    setDevice,
    panel,
    setPanel,
    overrides: overridesRef.current,
    t,
    setText: (path, value) => {
      setText(path, value)
      forceTick((n) => n + 1)
    },
    m,
    setMedia: (id, value) => {
      setMedia(id, value)
      forceTick((n) => n + 1)
    },
    setVisible: (id, visible) => {
      setVisible(id, visible)
      forceTick((n) => n + 1)
    },
    uploadMedia,
    isUploading: upload.isPending,
  }

  return (
    <EditorContext.Provider value={wrapped}>{children}</EditorContext.Provider>
  )
}

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
  style?: React.CSSProperties
  className?: string
  multiline?: boolean
}) {
  const Tag = as as ElementType
  const ed = useEditor()
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLElement>(null)
  const value = ed.t(path, defaultValue)

  if (ed.mode !== 'edit') {
    return (
      <Tag style={style} className={className}>
        {value}
      </Tag>
    )
  }

  const onBlur = () => {
    setEditing(false)
    const v = (ref.current?.innerText ?? '').replace(/\n+$/, '')
    if (v !== value) ed.setText(path, v)
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
      data-edit-text=""
      onClick={() => {
        if (!editing) {
          setEditing(true)
          setTimeout(() => ref.current?.focus(), 0)
        }
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

export function EditMedia({
  id,
  label,
  style,
  className,
  fit = 'cover',
  children,
}: {
  id: string
  label: string
  style?: React.CSSProperties
  className?: string
  fit?: 'cover' | 'contain'
  children?: React.ReactNode
}) {
  const ed = useEditor()
  const m = ed.m(id)
  const [hover, setHover] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      const next = await ed.uploadMedia(f)
      ed.setMedia(id, next)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const cover: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: fit,
    zIndex: 1,
  }

  return (
    <div
      style={{ ...style, position: 'relative', isolation: 'isolate' }}
      className={className}
      data-edit-media={id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      {m?.kind === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.url} alt="" style={cover} />
      )}
      {m?.kind === 'video' && (
        <video src={m.url} autoPlay muted loop playsInline style={cover} />
      )}
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
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                style={pillBtn}
              >
                {busy ? 'Uploading…' : m ? 'Replace' : 'Add media'}
              </button>
              {m && (
                <button
                  type="button"
                  onClick={() => ed.setMedia(id, null)}
                  style={{ ...pillBtn, background: 'rgba(255,80,80,0.92)' }}
                >
                  Remove
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={onFile}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

const pillBtn: React.CSSProperties = {
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

// ── EditBlock ───────────────────────────────────────────────────────────────

export function EditBlock({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  const ed = useEditor()
  const [hover, setHover] = useState(false)
  const visible = ed.overrides.visible[id] !== false

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
      data-edit-block={id}
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
            padding: '5px 6px 5px 12px',
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
            onClick={() => ed.setVisible(id, !visible)}
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
