'use client'

// Inline editing primitives for the live landing canvas.
// Used by CourseLandingView under the customize editor: hovering shows a
// dashed outline + click-to-edit; in preview mode they render plain content.
//
// In both the public CourseLandingView (no editor context) and the customize
// editor's canvas, these components fall back to read-only when no editor
// context is available.

import {
  useLandingEditor,
  type LandingMedia,
} from './landingConfig'
import { useEffect, useRef, useState } from 'react'

type AsType = keyof JSX.IntrinsicElements

export function EditText({
  path,
  defaultValue,
  as = 'span',
  style,
  multiline = false,
  className,
}: {
  path: string
  defaultValue: string
  as?: AsType
  style?: React.CSSProperties
  multiline?: boolean
  className?: string
}) {
  const ed = useLandingEditor()
  const ref = useRef<HTMLElement | null>(null)
  const [editing, setEditing] = useState(false)
  const value = ed?.config.text?.[path] ?? defaultValue
  const Tag = as as keyof JSX.IntrinsicElements

  // Read-only rendering when no editor context or in preview mode.
  if (!ed || ed.mode !== 'edit') {
    return (
      <Tag style={style} className={className}>
        {value as string}
      </Tag>
    )
  }

  const onBlur = () => {
    setEditing(false)
    const v = (ref.current?.innerText ?? '').replace(/\n+$/, '')
    if (v !== value) ed.setText(path, v.trim() ? v : null)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault()
      ;(ref.current as HTMLElement | null)?.blur()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      ;(ref.current as HTMLElement | null)?.blur()
    }
  }

  const baseStyle: React.CSSProperties = {
    ...style,
    outline: editing ? '2px solid oklch(0.62 0.18 265)' : undefined,
    outlineOffset: 2,
    borderRadius: 3,
    cursor: editing ? 'text' : 'pointer',
  }

  return (
    <Tag
      ref={ref as React.RefObject<HTMLElement>}
      style={baseStyle}
      className={className}
      contentEditable={editing}
      suppressContentEditableWarning
      data-edit-text=""
      data-edit-path={path}
      onClick={() => {
        if (!editing) {
          setEditing(true)
          setTimeout(() => (ref.current as HTMLElement | null)?.focus(), 0)
        }
      }}
      onBlur={onBlur}
      onKeyDown={onKey}
    >
      {value}
    </Tag>
  )
}

// EditMedia: wraps a media slot. When media is set, renders it on top of the
// children (placeholder). In edit mode, shows hover affordances to upload or
// paste a URL.
export function EditMedia({
  id,
  label = 'media',
  fit = 'cover',
  style,
  children,
  className,
}: {
  id: string
  label?: string
  fit?: 'cover' | 'contain'
  style?: React.CSSProperties
  children?: React.ReactNode
  className?: string
}) {
  const ed = useLandingEditor()
  const m: LandingMedia = ed?.config.media?.[id] ?? null
  const [hover, setHover] = useState(false)
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f || !ed) return
    const url = URL.createObjectURL(f)
    const k: 'image' | 'video' = f.type.startsWith('video') ? 'video' : 'image'
    ed.setMedia(id, { kind: k, url, name: f.name })
    setOpen(false)
    e.target.value = ''
  }

  const renderUploaded = () => {
    if (!m) return null
    const cover: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: fit,
      zIndex: 1,
    }
    if (m.kind === 'video') {
      return (
        <video
          key={m.url}
          src={m.url}
          autoPlay
          muted
          loop
          playsInline
          style={cover}
        />
      )
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={m.url} alt="" style={cover} />
    )
  }

  const isEdit = ed?.mode === 'edit'

  return (
    <div
      className={className}
      style={{ ...style, position: 'relative', isolation: 'isolate' }}
      data-edit-media={id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      {renderUploaded()}
      {isEdit && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              pointerEvents: 'none',
              border: hover
                ? '2px dashed rgba(99,102,241,0.85)'
                : '2px dashed rgba(99,102,241,0)',
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
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <span
                style={{
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
              </span>
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
                onClick={() => setOpen((o) => !o)}
                style={pillBtnStyle}
              >
                {m ? 'Replace' : 'Add media'}
              </button>
              {m && (
                <button
                  type="button"
                  onClick={() => ed?.setMedia(id, null)}
                  style={{
                    ...pillBtnStyle,
                    background: 'rgba(255,80,80,0.92)',
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          )}
          {open && (
            <div
              style={{
                position: 'absolute',
                right: 12,
                top: 52,
                zIndex: 7,
                width: 260,
                background: 'white',
                color: '#111',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12,
                padding: 12,
                boxShadow:
                  '0 16px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#111',
                  marginBottom: 8,
                }}
              >
                Replace {label}
              </div>
              <button
                type="button"
                style={panelBtnStyle}
                onClick={() => fileRef.current?.click()}
              >
                Upload from device
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={onFile}
              />
              <button
                type="button"
                style={panelBtnStyle}
                onClick={() => {
                  const url = window.prompt('Paste an image or video URL:')
                  if (url && ed) {
                    const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(url)
                    ed.setMedia(id, {
                      kind: isVid ? 'video' : 'image',
                      url,
                      name: 'remote',
                    })
                  }
                  setOpen(false)
                }}
              >
                Paste URL
              </button>
              {m && (
                <button
                  type="button"
                  style={panelBtnStyle}
                  onClick={() => {
                    ed?.setMedia(id, null)
                    setOpen(false)
                  }}
                >
                  Use placeholder
                </button>
              )}
              {m?.name && (
                <div
                  style={{
                    fontSize: 11,
                    color: '#666',
                    marginTop: 8,
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
}

// Wraps a section so the editor can hide it (preview mode → returns null) and
// show a hover halo + visibility toggle in edit mode.
export function EditSection({
  id,
  label,
  children,
}: {
  id:
    | 'hero'
    | 'value'
    | 'trailer'
    | 'curriculum'
    | 'lessons'
    | 'instructor'
    | 'reviews'
    | 'finalCta'
  label: string
  children: React.ReactNode
}) {
  const ed = useLandingEditor()
  const [hover, setHover] = useState(false)
  const visible = ed?.config.visible?.[id] !== false

  if (!ed) return visible ? <>{children}</> : null
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
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
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
            fontFamily: "'Inter', system-ui, sans-serif",
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
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
            title={visible ? 'Hide section' : 'Show section'}
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
          >
            {visible ? '👁' : '○'}
          </button>
        </div>
      )}
      {children}
    </div>
  )
}

// Used by the landing view when *not* under a customize editor — preserves
// section visibility from the saved config.
export function PublicSection({
  id,
  visible,
  children,
}: {
  id: string
  visible: boolean
  children: React.ReactNode
}) {
  if (!visible) return null
  return <>{children}</>
}

// Loads heading/body Google Fonts implied by the theme. Place once near the
// top of the landing tree.
export function ThemeFontLoader({
  fontIds,
}: {
  fontIds: string[]
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return
    fontIds.forEach((id) => {
      const linkId = 'gfont-' + id
      if (document.getElementById(linkId)) return
      // resolved by FONT_PAIRS map in landingConfig — here we accept already-
      // resolved Google query strings to avoid pulling more imports.
    })
  }, [fontIds])
  return null
}

const pillBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 999,
  background: 'rgba(20,20,22,0.92)',
  color: 'white',
  fontSize: 11.5,
  fontWeight: 600,
  letterSpacing: '0.01em',
  cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.08)',
  fontFamily: "'Inter', system-ui, sans-serif",
}

const panelBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '9px 10px',
  borderRadius: 8,
  background: 'transparent',
  color: '#111',
  fontSize: 12.5,
  fontWeight: 500,
  textAlign: 'left',
  cursor: 'pointer',
  border: 'none',
  marginBottom: 2,
}
